#!/bin/bash
# backend/testy/test-helpers.sh
# Enhanced helper functions for authentication test suite
# Aligned with JWT service, middleware, and handler implementation

# ============================================
# COLORS FOR OUTPUT
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================
# TEST COUNTERS
# ============================================
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# ============================================
# TOKEN STORAGE
# ============================================
# Memory fallback for when cookies aren't accessible
CURRENT_ACCESS_TOKEN=""
CURRENT_REFRESH_TOKEN=""

# ============================================
# DISPLAY FUNCTIONS
# ============================================

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_section() {
    echo -e "\n${CYAN}--- $1 ---${NC}\n"
}

print_test() {
    echo -e "${YELLOW}TEST: $1${NC}" >&2
}

print_success() {
    echo -e "${GREEN}✓ PASS: $1${NC}\n" >&2
}

print_failure() {
    echo -e "${RED}✗ FAIL: $1${NC}" >&2
    if [ -n "$2" ]; then
        echo -e "${RED}  Details: $2${NC}\n" >&2
    else
        echo "" >&2
    fi
}

print_info() {
    echo -e "${BLUE}ℹ INFO: $1${NC}" >&2
}

print_warning() {
    echo -e "${MAGENTA}⚠ WARNING: $1${NC}" >&2
}

increment_test() {
    ((TOTAL_TESTS++))
}

# ============================================
# JWT DECODING UTILITIES
# ============================================

# Decode JWT payload (requires jq for pretty output)
decode_jwt() {
    local token=$1
    if [ -z "$token" ]; then
        echo "{}"
        return 1
    fi
    
    # Extract payload (second part between dots)
    local payload=$(echo "$token" | cut -d'.' -f2)
    
    # Add padding if needed (JWT base64 is unpadded)
    local pad=$((4 - ${#payload} % 4))
    if [ $pad -lt 4 ]; then
        payload="${payload}$(printf '%*s' $pad '' | tr ' ' '=')"
    fi
    
    # Decode base64
    if command -v jq &> /dev/null; then
        echo "$payload" | base64 -d 2>/dev/null | jq -r '.' 2>/dev/null || echo "{}"
    else
        echo "$payload" | base64 -d 2>/dev/null || echo "{}"
    fi
}

# Extract expiry timestamp from JWT
get_jwt_expiry() {
    local token=$1
    if command -v jq &> /dev/null; then
        decode_jwt "$token" | jq -r '.exp // empty'
    else
        decode_jwt "$token" | grep -o '"exp":[0-9]*' | cut -d':' -f2
    fi
}

# Get token age in seconds
get_token_age() {
    local token=$1
    local iat=$(decode_jwt "$token" | jq -r '.iat // empty' 2>/dev/null)
    if [ -z "$iat" ]; then
        iat=$(decode_jwt "$token" | grep -o '"iat":[0-9]*' | cut -d':' -f2)
    fi
    
    if [ -n "$iat" ]; then
        local now=$(date +%s)
        echo $((now - iat))
    else
        echo "0"
    fi
}

# Extract user_id from JWT
get_jwt_user_id() {
    local token=$1
    if command -v jq &> /dev/null; then
        decode_jwt "$token" | jq -r '.user_id // .sub // empty'
    else
        decode_jwt "$token" | grep -o '"user_id":"[^"]*"' | cut -d'"' -f4
    fi
}

# ============================================
# COOKIE EXTRACTION (CRITICAL FOR HTTPONLY)
# ============================================

# Extract cookie value from Set-Cookie headers OR cookie jar
# This is the MOST CRITICAL function for testing HttpOnly cookies
get_cookie_value() {
    local cookie_name=$1
    local value=""
    
    # STRATEGY 1: Extract from most recent Set-Cookie header
    # This is the PRIMARY source immediately after a request
    if [ -n "${OUTPUT_DIR}" ]; then
        local latest_headers="${OUTPUT_DIR}/headers_${TOTAL_TESTS}.txt"
        if [ -f "$latest_headers" ]; then
            # Use grep + sed to extract cookie value
            # Pattern: Set-Cookie: cookie_name=VALUE; Path=/; ...
            value=$(grep -i "^Set-Cookie:" "$latest_headers" | \
                    grep -i "${cookie_name}=" | \
                    head -1 | \
                    sed -E "s/.*${cookie_name}=([^;[:space:]]+).*/\1/" | \
                    tr -d '\r\n' | \
                    xargs)  # xargs trims whitespace
        fi
    fi
    
    # STRATEGY 2: Parse Netscape cookie jar format
    # Used for persistence between requests
    if [ -z "$value" ] && [ -f "$COOKIE_JAR" ]; then
        # Netscape format: domain flag path secure expiry name value
        # We need to find the line with our cookie name and extract last field
        value=$(awk -v name="$cookie_name" '
            BEGIN { OFS="\t" }
            /^#HttpOnly_/ || /^[^#]/ {
                # Handle both with and without #HttpOnly_ prefix
                gsub(/^#HttpOnly_/, "")
                # Cookie name is in field 6, value in field 7
                if ($6 == name) {
                    print $7
                }
            }
        ' "$COOKIE_JAR" | tail -1 | tr -d '\r\n' | xargs)
    fi
    
    # STRATEGY 3: Memory fallback
    if [ -z "$value" ]; then
        if [ "$cookie_name" == "access_token" ] && [ -n "$CURRENT_ACCESS_TOKEN" ]; then
            value="$CURRENT_ACCESS_TOKEN"
        elif [ "$cookie_name" == "refresh_token" ] && [ -n "$CURRENT_REFRESH_TOKEN" ]; then
            value="$CURRENT_REFRESH_TOKEN"
        fi
    fi
    
    # Final cleanup: remove any remaining whitespace/special chars
    value=$(echo "$value" | xargs)
    
    echo "$value"
}

# ============================================
# TOKEN EXTRACTION AND STORAGE
# ============================================

# Extract tokens from response and headers, store in memory
extract_and_store_tokens() {
    local response_file=$1
    local headers_file="${OUTPUT_DIR}/headers_${TOTAL_TESTS}.txt"
    
    # PRIORITY 1: Extract from Set-Cookie headers (most reliable for HttpOnly)
    if [ -f "$headers_file" ]; then
        local header_access=$(grep -i "^Set-Cookie:" "$headers_file" | \
                              grep -i "access_token=" | \
                              head -1 | \
                              sed -E 's/.*access_token=([^;[:space:]]+).*/\1/' | \
                              tr -d '\r\n' | \
                              xargs)
        
        local header_refresh=$(grep -i "^Set-Cookie:" "$headers_file" | \
                               grep -i "refresh_token=" | \
                               head -1 | \
                               sed -E 's/.*refresh_token=([^;[:space:]]+).*/\1/' | \
                               tr -d '\r\n' | \
                               xargs)
        
        if [ -n "$header_access" ] && [ "$header_access" != "access_token" ]; then
            CURRENT_ACCESS_TOKEN="$header_access"
        fi
        
        if [ -n "$header_refresh" ] && [ "$header_refresh" != "refresh_token" ]; then
            CURRENT_REFRESH_TOKEN="$header_refresh"
        fi
    fi
    
    # PRIORITY 2: Fallback to JSON response body (for APIs that return tokens in body)
    if [ -f "$response_file" ] && command -v jq &> /dev/null; then
        # Only use body tokens if we didn't get them from headers
        if [ -z "$CURRENT_ACCESS_TOKEN" ]; then
            local body_access=$(jq -r '.access_token // .accessToken // empty' "$response_file" 2>/dev/null)
            if [ -n "$body_access" ] && [ "$body_access" != "null" ]; then
                CURRENT_ACCESS_TOKEN="$body_access"
            fi
        fi
        
        if [ -z "$CURRENT_REFRESH_TOKEN" ]; then
            local body_refresh=$(jq -r '.refresh_token // .refreshToken // empty' "$response_file" 2>/dev/null)
            if [ -n "$body_refresh" ] && [ "$body_refresh" != "null" ]; then
                CURRENT_REFRESH_TOKEN="$body_refresh"
            fi
        fi
    fi
}

# Clear stored tokens (used for logout tests)
clear_stored_tokens() {
    CURRENT_ACCESS_TOKEN=""
    CURRENT_REFRESH_TOKEN=""
    
    # Also clear the cookie jar if it exists
    if [ -f "$COOKIE_JAR" ]; then
        # Preserve the header, remove cookie entries
        sed -i.bak '/^#HttpOnly_/d; /^[^#]/d' "$COOKIE_JAR" 2>/dev/null || true
    fi
}

# ============================================
# HTTP REQUEST FUNCTION
# ============================================

make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    local max_retries=3
    local retry_delay=1
    
    # 1. Update counters
    increment_test
    export TOTAL_TESTS
    
    # 2. UI output
    print_test "$description"
    
    # 3. Path preparation
    local response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"
    local headers_file="${OUTPUT_DIR}/headers_${TOTAL_TESTS}.txt"
    local url="${BASE_URL}${API_PREFIX}${endpoint}"
    
    # 4. Ensure directory exists
    mkdir -p "$OUTPUT_DIR" 2>/dev/null
    
    # 5. Request variables
    local http_code
    local curl_exit
    local retry_count=0
    
    # 6. Execution loop
    while [ $retry_count -lt $max_retries ]; do
        if [ -z "$data" ]; then
            # GET/DELETE request
            http_code=$(curl -s -w "%{http_code}" \
                --connect-timeout 10 --max-time 30 \
                -X "$method" "$url" \
                -H "Content-Type: application/json" \
                -H "Accept: application/json" \
                -b "$COOKIE_JAR" \
                -c "$COOKIE_JAR" \
                -D "$headers_file" \
                -o "$response_file" 2>&1 | tail -1)
            curl_exit=${PIPESTATUS[0]}
        else
            # POST/PUT request
            http_code=$(curl -s -w "%{http_code}" \
                --connect-timeout 10 --max-time 30 \
                -X "$method" "$url" \
                -H "Content-Type: application/json" \
                -H "Accept: application/json" \
                -d "$data" \
                -b "$COOKIE_JAR" \
                -c "$COOKIE_JAR" \
                -D "$headers_file" \
                -o "$response_file" 2>&1 | tail -1)
            curl_exit=${PIPESTATUS[0]}
        fi
        
        # 7. Validate headers file creation
        if [ ! -f "$headers_file" ]; then
            print_warning "curl did not create headers file: $headers_file"
            print_info "curl exit code: $curl_exit"
            print_info "http code: $http_code"
        fi
        
        # 8. Extract and validate HTTP code
        http_code=$(echo "$http_code" | grep -o '[0-9]\{3\}' | head -1 || echo "000")
        
        # 9. Check if request succeeded
        if [ $curl_exit -eq 0 ] && [ "$http_code" != "000" ]; then
            break
        fi
        
        # 10. Retry logic
        ((retry_count++))
        if [ $retry_count -lt $max_retries ]; then
            print_warning "Request failed (attempt $retry_count/$max_retries), retrying in ${retry_delay}s..."
            sleep $retry_delay
            retry_delay=$((retry_delay * 2))
        else
            print_warning "Request failed after $max_retries attempts: $description"
            echo "000"
            return 1
        fi
    done
    
    # 11. Token extraction
    extract_and_store_tokens "$response_file"
    
    # 12. Return result
    echo "$http_code"
}

# ============================================
# RESPONSE VALIDATION FUNCTIONS
# ============================================

# Check if response contains expected JSON field
check_response_field() {
    local response_file=$1
    local field=$2
    local description=$3
    
    if [ ! -f "$response_file" ]; then
        print_failure "$description" "Response file not found: $response_file"
        return 1
    fi
    
    if command -v jq &> /dev/null; then
        if jq -e "$field" "$response_file" > /dev/null 2>&1; then
            print_success "$description"
            return 0
        else
            local content=$(cat "$response_file" 2>/dev/null | head -c 500 || echo 'Unable to read response')
            print_failure "$description" "Field '$field' not found. Response: $content"
            return 1
        fi
    else
        # Without jq, do basic grep check
        local field_name=$(echo "$field" | tr -d '.' | tr -d '[]')
        if grep -q "$field_name" "$response_file" 2>/dev/null; then
            print_success "$description"
            return 0
        else
            print_failure "$description" "Field not found (jq unavailable for precise check)"
            return 1
        fi
    fi
}

# Check HTTP status code with rate limit handling
check_status() {
    local actual=$1
    local expected=$2
    local description=$3
    
    # Handle rate limiting gracefully
    if [ "$actual" -eq "429" ] 2>/dev/null; then
        echo -e "${MAGENTA}⚠ RATE LIMITED: $description (Status: 429)${NC}" >&2
        echo -e "${MAGENTA}  Pausing for 2 seconds...${NC}\n" >&2
        sleep 2
        return 2  # Special return code for rate limit
    fi
    
    # Check if status matches expected
    if [ "$actual" -eq "$expected" ] 2>/dev/null; then
        echo -e "${GREEN}✓ PASS: $description (Status: $actual)${NC}\n" >&2
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}✗ FAIL: $description${NC}" >&2
        echo -e "${RED}  Expected: $expected, Got: $actual${NC}\n" >&2
        ((FAILED_TESTS++))
        
        # Show response body for debugging
        local response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"
        if [ -f "$response_file" ]; then
            local body=$(cat "$response_file" 2>/dev/null | head -c 300)
            echo -e "${RED}  Response: ${body}${NC}\n" >&2
        fi
        
        return 1
    fi
}

# Extract value from JSON response
extract_value() {
    local response_file=$1
    local field=$2
    
    if [ ! -f "$response_file" ]; then
        echo ""
        return 1
    fi
    
    if command -v jq &> /dev/null; then
        # Use -r for raw output (no quotes)
        local value=$(jq -r "${field} // empty" "$response_file" 2>/dev/null)
        if [ "$value" == "null" ] || [ -z "$value" ]; then
            echo ""
        else
            echo "$value"
        fi
    else
        echo ""
    fi
}

# Check if cookies were set in the response
verify_cookies_set() {
    local headers_file="${OUTPUT_DIR}/headers_${TOTAL_TESTS}.txt"
    local cookie_name=$1
    local description=$2
    
    if [ ! -f "$headers_file" ]; then
        print_failure "$description" "Headers file not found"
        return 1
    fi
    
    if grep -qi "Set-Cookie:.*${cookie_name}=" "$headers_file"; then
        print_success "$description"
        return 0
    else
        print_failure "$description" "Cookie '$cookie_name' not found in Set-Cookie headers"
        return 1
    fi
}

# ============================================
# DEPENDENCY CHECKS
# ============================================

check_dependencies() {
    local missing_deps=0
    
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}ERROR: curl is not installed. Cannot run tests.${NC}"
        echo "Install curl: https://curl.se/download.html"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed. Some assertions may be limited."
        print_info "Install jq: https://stedolan.github.io/jq/download/"
        print_info "Tests will continue with reduced JSON parsing capability."
        missing_deps=1
    fi
    
    # Check bash version (need 4.0+ for associative arrays)
    if [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
        print_warning "Bash version 4+ recommended for best results (current: ${BASH_VERSION})"
    fi
    
    return $missing_deps
}

# ============================================
# UTILITY FUNCTIONS
# ============================================

# Wait with countdown (useful between test sections)
wait_with_countdown() {
    local seconds=$1
    local message=${2:-"Waiting"}
    
    for ((i=seconds; i>0; i--)); do
        echo -ne "${CYAN}$message: ${i}s remaining...\r${NC}"
        sleep 1
    done
    echo -e "${CYAN}$message: Complete!          ${NC}"
}

# Verify backend is reachable
check_backend_health() {
    print_info "Checking backend health at $BASE_URL..."
    
    local health_check=$(curl -s -o /dev/null -w "%{http_code}" \
        --connect-timeout 5 \
        --max-time 10 \
        "${BASE_URL}/health" 2>/dev/null || echo "000")
    
    if [ "$health_check" == "000" ]; then
        # Try root endpoint if /health doesn't exist
        health_check=$(curl -s -o /dev/null -w "%{http_code}" \
            --connect-timeout 5 \
            --max-time 10 \
            "${BASE_URL}/" 2>/dev/null || echo "000")
    fi
    
    if [ "$health_check" == "000" ]; then
        print_failure "Backend health check" "Cannot reach $BASE_URL"
        return 1
    else
        print_success "Backend is reachable (Status: $health_check)"
        return 0
    fi
}

# ============================================
# INITIALIZATION
# ============================================

# Run dependency check on source
check_dependencies

# Ensure required variables are set
if [ -z "$BASE_URL" ]; then
    export BASE_URL="http://localhost:8081"
    print_warning "BASE_URL not set, using default: $BASE_URL"
fi

if [ -z "$COOKIE_JAR" ]; then
    export COOKIE_JAR="$(mktemp)"
    print_warning "COOKIE_JAR not set, created temporary jar: $COOKIE_JAR"
fi

if [ -z "$OUTPUT_DIR" ]; then
    export OUTPUT_DIR="$(mktemp -d)"
    print_warning "OUTPUT_DIR not set, created temporary directory: $OUTPUT_DIR"
fi

# Set API_PREFIX if not already set (should be empty for your routes)
if [ -z "$API_PREFIX" ]; then
    export API_PREFIX=""
fi

print_info "Helper functions loaded successfully"
print_info "BASE_URL: $BASE_URL"
print_info "API_PREFIX: '${API_PREFIX}' (empty means routes like /auth/login)"
print_info "COOKIE_JAR: $COOKIE_JAR"
print_info "OUTPUT_DIR: $OUTPUT_DIR"