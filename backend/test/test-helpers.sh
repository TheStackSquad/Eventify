#!/bin/bash
# backend/test/test-helpers.sh
# Contains all helper functions, styling, and counters for the test suite.

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Token storage (in case cookies aren't working, store in memory)
CURRENT_ACCESS_TOKEN=""
CURRENT_REFRESH_TOKEN=""

# ============================================
# HELPER FUNCTIONS
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
        echo -e "${RED}  Response: $2${NC}\n" >&2
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

# Decode JWT token (requires jq, falls back to base64 only)
decode_jwt() {
    local token=$1
    if [ -z "$token" ]; then
        echo "{}"
        return 1
    fi
    
    if command -v jq &> /dev/null; then
        echo "$token" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.' 2>/dev/null || echo "{}"
    else
        # Without jq, just decode base64
        echo "$token" | cut -d'.' -f2 | base64 -d 2>/dev/null || echo "{}"
    fi
}

# Extract expiry from JWT
get_jwt_expiry() {
    local token=$1
    if command -v jq &> /dev/null; then
        decode_jwt "$token" | jq -r '.exp // empty'
    else
        # Try to extract exp without jq (unreliable)
        decode_jwt "$token" | grep -o '"exp":[0-9]*' | cut -d':' -f2
    fi
}

# Get token age in seconds
get_token_age() {
    local token=$1
    local iat=$(decode_jwt "$token" | grep -o '"iat":[0-9]*' | cut -d':' -f2)
    if [ -n "$iat" ]; then
        local now=$(date +%s)
        echo $((now - iat))
    else
        echo "0"
    fi
}

# Extract cookie value - tries multiple sources
get_cookie_value() {
    local cookie_name=$1
    local value=""
    
    # First, check if we stored it in memory (from response body)
    if [ "$cookie_name" == "access_token" ] && [ -n "$CURRENT_ACCESS_TOKEN" ]; then
        echo "$CURRENT_ACCESS_TOKEN"
        return 0
    fi
    if [ "$cookie_name" == "refresh_token" ] && [ -n "$CURRENT_REFRESH_TOKEN" ]; then
        echo "$CURRENT_REFRESH_TOKEN"
        return 0
    fi
    
    # Try to get from cookie jar
    if [ ! -f "$COOKIE_JAR" ]; then
        echo ""
        return 1
    fi
    
    # Method 1: Parse Netscape format properly (handles multi-line tokens)
    # Format: domain flag path secure expiry name value
    value=$(awk -v name="$cookie_name" '
        BEGIN { token="" }
        /^#HttpOnly_/ || /^[^#]/ {
            if ($6 == name || $NF ~ name) {
                # Found the line, capture everything from column 7 onwards
                for(i=7; i<=NF; i++) token = token $i
            }
        }
        END { print token }
    ' "$COOKIE_JAR" 2>/dev/null)
    
    # Method 2: Extract from Set-Cookie header in headers file (most reliable)
    if [ -z "$value" ] && [ -n "${OUTPUT_DIR}" ]; then
        # Try the most recent headers file
        local latest_headers="${OUTPUT_DIR}/headers_${TOTAL_TESTS}.txt"
        if [ -f "$latest_headers" ]; then
            # Use tr to remove carriage returns and join lines, then extract token
            value=$(grep -i "^Set-Cookie:" "$latest_headers" | grep -i "$cookie_name" | tr -d '\r\n' | sed "s/.*${cookie_name}=\([^;]*\).*/\1/" | head -1)
        fi
    fi
    
    # Method 3: Try the stored headers from last successful request
    if [ -z "$value" ]; then
        # Look for any headers file that might have our cookie
        for headers_file in "${OUTPUT_DIR}"/headers_*.txt; do
            if [ -f "$headers_file" ]; then
                local temp_value=$(grep -i "^Set-Cookie:" "$headers_file" | grep -i "$cookie_name" | tr -d '\r\n' | sed "s/.*${cookie_name}=\([^;]*\).*/\1/" | head -1)
                if [ -n "$temp_value" ]; then
                    value="$temp_value"
                    break
                fi
            fi
        done
    fi
    
    echo "$value"
}

# Extract tokens from response body and store them
extract_and_store_tokens() {
    local response_file=$1
    
    if [ ! -f "$response_file" ]; then
        return 1
    fi
    
    # Check if response has tokens in body (common pattern)
    if command -v jq &> /dev/null; then
        local access=$(jq -r '.access_token // .accessToken // empty' "$response_file" 2>/dev/null)
        local refresh=$(jq -r '.refresh_token // .refreshToken // empty' "$response_file" 2>/dev/null)
        
        if [ -n "$access" ] && [ "$access" != "null" ]; then
            CURRENT_ACCESS_TOKEN="$access"
            print_info "Stored access token from response body"
        fi
        
        if [ -n "$refresh" ] && [ "$refresh" != "null" ]; then
            CURRENT_REFRESH_TOKEN="$refresh"
            print_info "Stored refresh token from response body"
        fi
    fi
}

# Make HTTP request and save response (with retry logic)
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    local max_retries=3
    local retry_delay=1
    
    increment_test
    print_test "$description" 
    
    local response_file="${OUTPUT_DIR}/response_${TOTAL_TESTS}.json"
    local headers_file="${OUTPUT_DIR}/headers_${TOTAL_TESTS}.txt"
    
    # Ensure output directory exists
    mkdir -p "$OUTPUT_DIR" 2>/dev/null || true
    
    local http_code
    local retry_count=0
    
    # Retry loop
    while [ $retry_count -lt $max_retries ]; do
        if [ -z "$data" ]; then
            # GET/DELETE request without body
            http_code=$(curl -s -w "%{http_code}" \
                --connect-timeout 10 \
                --max-time 15 \
                --retry 0 \
                -X "$method" \
                "${BASE_URL}${endpoint}" \
                -H "Content-Type: application/json" \
                -b "$COOKIE_JAR" \
                -c "$COOKIE_JAR" \
                -D "$headers_file" \
                -o "$response_file" 2>&1 | tail -1)
            curl_exit=$?
        else
            # POST/PUT request with body
            http_code=$(curl -s -w "%{http_code}" \
                --connect-timeout 10 \
                --max-time 15 \
                --retry 0 \
                -X "$method" \
                "${BASE_URL}${endpoint}" \
                -H "Content-Type: application/json" \
                -d "$data" \
                -b "$COOKIE_JAR" \
                -c "$COOKIE_JAR" \
                -D "$headers_file" \
                -o "$response_file" 2>&1 | tail -1)
            curl_exit=$?
        fi
        
        # Extract just the numeric code
        http_code=$(echo "$http_code" | grep -o '[0-9]\{3\}' || echo "000")
        
        # Check if curl succeeded
        if [ $curl_exit -eq 0 ] && [ "$http_code" != "000" ] && [ -n "$http_code" ]; then
            break
        fi
        
        # Retry logic
        ((retry_count++))
        if [ $retry_count -lt $max_retries ]; then
            print_warning "Request failed (attempt $retry_count/$max_retries), retrying in ${retry_delay}s..."
            sleep $retry_delay
            retry_delay=$((retry_delay * 2))  # Exponential backoff
        else
            print_warning "curl command failed for $description after $max_retries attempts"
            echo "000"
            return 1
        fi
    done
    
    # Extract tokens from response
    extract_and_store_tokens "$response_file"
    
    # CRITICAL: Also extract from headers file (more reliable for cookies)
    if [ -f "$headers_file" ]; then
        # Remove all newlines and carriage returns from Set-Cookie headers first
        local header_access=$(grep -i "^Set-Cookie:" "$headers_file" | grep -i "access_token" | tr -d '\r\n' | sed 's/.*access_token=\([^;]*\).*/\1/' | head -1)
        local header_refresh=$(grep -i "^Set-Cookie:" "$headers_file" | grep -i "refresh_token" | tr -d '\r\n' | sed 's/.*refresh_token=\([^;]*\).*/\1/' | head -1)
        
        if [ -n "$header_access" ]; then
            CURRENT_ACCESS_TOKEN="$header_access"
        fi
        
        if [ -n "$header_refresh" ]; then
            CURRENT_REFRESH_TOKEN="$header_refresh"
        fi
    fi
    
    echo "$http_code"
}

# Check if response contains expected field
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
            print_failure "$description" "$(cat $response_file 2>/dev/null || echo 'Unable to read response')"
            return 1
        fi
    else
        # Without jq, just check if the field name exists
        if grep -q "$field" "$response_file" 2>/dev/null; then
            print_success "$description"
            return 0
        else
            print_failure "$description" "Field not found (jq not available for proper check)"
            return 1
        fi
    fi
}

# Check HTTP status code
check_status() {
    local actual=$1
    local expected=$2
    local description=$3
    
    # Handle rate limiting
    if [ "$actual" -eq "429" ] 2>/dev/null; then
        echo -e "${MAGENTA}⚠ RATE LIMITED: $description (Status: 429)${NC}" >&2
        echo -e "${MAGENTA}  Waiting 2 seconds before continuing...${NC}\n" >&2
        sleep 2
        return 2
    fi
    
    if [ "$actual" -eq "$expected" ] 2>/dev/null; then
        echo -e "${GREEN}✓ PASS: $description (Status: $actual)${NC}\n" >&2
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}✗ FAIL: $description (Expected: $expected, Got: $actual)${NC}" >&2
        echo -e "${RED}  Response: Status code mismatch${NC}\n" >&2
        ((FAILED_TESTS++))
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
        jq -r "$field" "$response_file" 2>/dev/null || echo ""
    else
        # Try basic grep (unreliable)
        grep -o "\"${field}\":\"[^\"]*\"" "$response_file" 2>/dev/null | cut -d'"' -f4 || echo ""
    fi
}

# Verify jq is installed
check_dependencies() {
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed. Some tests may fail."
        print_info "Install jq: https://stedolan.github.io/jq/download/"
        print_info "Attempting to run tests with limited functionality..."
        return 1
    fi
    
    if ! command -v curl &> /dev/null; then
        echo "ERROR: curl is not installed. Cannot run tests."
        exit 1
    fi
    
    return 0
}

# Clear stored tokens (for logout)
clear_stored_tokens() {
    CURRENT_ACCESS_TOKEN=""
    CURRENT_REFRESH_TOKEN=""
}

# Initialize
check_dependencies