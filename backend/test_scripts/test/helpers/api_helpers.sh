#!/bin/bash
# scripts/test/helpers/api_helpers_enhanced.sh
# Enhanced API helper functions

API_BASE_URL=${API_BASE_URL:-http://localhost:8081}
GUEST_ID=${GUEST_ID:-test_guest_$(date +%s)}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Initialize order
init_order() {
    local json_file="$1"
    
    if [ ! -f "$json_file" ]; then
        log_error "JSON file not found: $json_file"
        return 1
    fi
    
    # Read the JSON file content
    local json_data=$(cat "$json_file")
    
    # Make the request
    curl -s -X POST "$API_BASE_URL/api/orders/initialize" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=$GUEST_ID" \
        -d "$json_data"
}

# Verify payment
verify_payment() {
    local reference="$1"
    
    curl -s -X GET "$API_BASE_URL/api/payments/verify/$reference" \
        -H "Cookie: guest_id=$GUEST_ID"
}

# Get order details
get_order() {
    local reference="$1"
    
    curl -s -X GET "$API_BASE_URL/api/orders/$reference" \
        -H "Cookie: guest_id=$GUEST_ID"
}

# Send webhook (for testing)
send_webhook() {
    local reference="$1"
    local status="$2"
    local payload="$3"
    
    curl -s -X POST "$API_BASE_URL/api/webhooks/paystack" \
        -H "Content-Type: application/json" \
        -H "x-paystack-signature: $signature" \
        -d "$payload"
}

# Health check
health_check() {
    curl -s "$API_BASE_URL/health"
}

# Extract JSON field using grep and sed (no jq dependency)
extract_json() {
    local json="$1"
    local field="$2"
    
    # Simple extraction for top-level fields
    echo "$json" | grep -o "\"$field\":\"[^\"]*\"" | sed "s/\"$field\":\"\(.*\)\"/\1/" | head -n 1
}

# Extract nested JSON field
extract_nested_json() {
    local json="$1"
    local path="$2"
    
    # Handle paths like .data.reference
    # This is a simple implementation - for complex JSON, use jq
    local field=$(echo "$path" | sed 's/.*\.//')
    echo "$json" | grep -o "\"$field\":\"[^\"]*\"" | sed "s/\"$field\":\"\(.*\)\"/\1/" | head -n 1
}

# Pretty print JSON (attempts to format, falls back to raw)
pretty_json() {
    local json="$1"
    
    if [ -z "$json" ]; then
        log_warning "Attempted to pretty print empty JSON"
        return
    fi
    
    # Try with python
    if command -v python3 &> /dev/null; then
        echo "$json" | python3 -m json.tool 2>/dev/null || echo "$json"
    elif command -v python &> /dev/null; then
        echo "$json" | python -m json.tool 2>/dev/null || echo "$json"
    else
        # Fallback: just print it
        echo "$json"
    fi
}

# Generate test reference (for mock tests)
generate_test_reference() {
    local timestamp=$(date +%s%3N)
    local random=$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 8 | head -n 1)
    echo "TIX_${timestamp}_${random}"
}

# Concurrent requests helper
concurrent_requests() {
    local count="$1"
    local reference="$2"
    local output_file="${3:-/tmp/concurrent_$$.txt}"
    
    > "$output_file"  # Clear file
    
    local pids=()
    for i in $(seq 1 "$count"); do
        (
            response=$(verify_payment "$reference" 2>&1)
            status=$(extract_json "$response" "status")
            echo "Request $i: $status" >> "$output_file"
        ) &
        pids+=($!)
    done
    
    # Wait for all to complete
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
    
    cat "$output_file"
}

# Wait for condition with timeout
wait_for_condition() {
    local condition_fn="$1"
    local timeout="${2:-10}"
    local interval="${3:-1}"
    
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if $condition_fn; then
            return 0
        fi
        sleep "$interval"
        elapsed=$((elapsed + interval))
    done
    
    return 1
}

# Create test order helper
create_test_order() {
    local email="$1"
    local event_id="$2"
    local tier_name="$3"
    local quantity="$4"
    
    local temp_file=$(mktemp)
    cat <<EOF > "$temp_file"
{
  "email": "$email",
  "firstName": "Test",
  "lastName": "User",
  "phone": "+2348155764220",
  "items": [
    {
      "eventId": "$event_id",
      "tierName": "$tier_name",
      "quantity": $quantity
    }
  ]
}
EOF
    
    local response=$(init_order "$temp_file")
    rm "$temp_file"
    
    echo "$response" | grep "{" | tail -n 1 | tr -d '\r'
}

# Batch create orders
batch_create_orders() {
    local count="$1"
    local event_id="$2"
    local tier_name="$3"
    local quantity="${4:-1}"
    
    local references=()
    
    for i in $(seq 1 "$count"); do
        local response=$(create_test_order "batch$i@example.com" "$event_id" "$tier_name" "$quantity")
        local reference=$(extract_nested_json "$response" ".data.reference")
        
        if [ -n "$reference" ] && [ "$reference" != "null" ]; then
            references+=("$reference")
            log_info "Created order $i: $reference"
        else
            log_error "Failed to create order $i"
        fi
    done
    
    # Return array as newline-separated string
    printf "%s\n" "${references[@]}"
}

# Stress test helper - rapid requests
stress_test_endpoint() {
    local endpoint="$1"
    local method="${2:-GET}"
    local count="${3:-100}"
    local concurrent="${4:-10}"
    
    log_info "Stress testing: $method $endpoint ($count requests, $concurrent concurrent)"
    
    local success=0
    local failed=0
    local start_time=$(date +%s)
    
    for batch in $(seq 1 $((count / concurrent))); do
        local pids=()
        
        for i in $(seq 1 "$concurrent"); do
            (
                response=$(curl -s -X "$method" "$API_BASE_URL$endpoint" -H "Cookie: guest_id=$GUEST_ID")
                if [ $? -eq 0 ]; then
                    echo "SUCCESS"
                else
                    echo "FAILED"
                fi
            ) &
            pids+=($!)
        done
        
        for pid in "${pids[@]}"; do
            wait "$pid"
            if [ $? -eq 0 ]; then
                success=$((success + 1))
            else
                failed=$((failed + 1))
            fi
        done
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_info "Completed: $success success, $failed failed in ${duration}s"
    log_info "Rate: $((count / duration)) req/s"
}

# Measure response time
measure_response_time() {
    local endpoint="$1"
    local method="${2:-GET}"
    
    local start=$(date +%s%3N)
    curl -s -X "$method" "$API_BASE_URL$endpoint" -H "Cookie: guest_id=$GUEST_ID" > /dev/null
    local end=$(date +%s%3N)
    
    echo $((end - start))
}

# Check API rate limiting
check_rate_limit() {
    local endpoint="$1"
    local max_requests="${2:-100}"
    
    log_info "Checking rate limits for: $endpoint"
    
    local consecutive_success=0
    local rate_limited=0
    
    for i in $(seq 1 "$max_requests"); do
        response=$(curl -s -w "\n%{http_code}" "$API_BASE_URL$endpoint" -H "Cookie: guest_id=$GUEST_ID")
        http_code=$(echo "$response" | tail -n 1)
        
        if [ "$http_code" == "429" ]; then
            rate_limited=$((rate_limited + 1))
            log_warning "Rate limited at request $i"
            break
        else
            consecutive_success=$((consecutive_success + 1))
        fi
    done
    
    log_info "Successful before rate limit: $consecutive_success"
}

# Validate response structure
validate_response_structure() {
    local response="$1"
    local expected_fields="$2"  # Space-separated list of required fields
    
    for field in $expected_fields; do
        if ! echo "$response" | grep -q "\"$field\""; then
            log_error "Missing required field: $field"
            return 1
        fi
    done
    
    return 0
}

# Export functions
export -f log_info log_success log_error log_warning
export -f init_order verify_payment get_order send_webhook health_check
export -f extract_json extract_nested_json pretty_json
export -f generate_test_reference
export -f concurrent_requests wait_for_condition
export -f create_test_order batch_create_orders
export -f stress_test_endpoint measure_response_time check_rate_limit
export -f validate_response_structure













































# #!/bin/bash
# # scripts/test/helpers/api_helpers.sh
# # Reusable API testing functions

# # Configuration
# API_BASE_URL="${API_BASE_URL:-http://localhost:8081}"
# GUEST_ID="${GUEST_ID:-test_guest_$(date +%s)}"

# # Colors for output
# RED='\033[0;31m'
# GREEN='\033[0;32m'
# YELLOW='\033[1;33m'
# BLUE='\033[0;34m'
# NC='\033[0m' # No Color

# # Logging functions
# # Logging functions - Added >&2 to prevent breaking JSON captures
# log_info() { echo -e "${BLUE}[INFO]${NC} $1" >&2; }
# log_success() { echo -e "${GREEN}[✓]${NC} $1" >&2; }
# log_error() { echo -e "${RED}[✗]${NC} $1" >&2; }
# log_warning() { echo -e "${YELLOW}[!]${NC} $1" >&2; }


# # Update init_order too
# init_order() {
#     local json_file=$2
#     curl -s -X POST "${API_BASE_URL%/}/api/orders/initialize" \
#         -H "Content-Type: application/json" \
#         -d @"$json_file"
# }
# # Verify payment
# verify_payment() {
#     local reference=$1
#     log_info "Verifying payment: $reference"
#     curl -s -X GET \
#         -H "Cookie: guest_id=$GUEST_ID" \
#         "$API_BASE_URL/api/payments/verify/$reference" | tail -n 1
# }

# # Get order by reference
# # Usage: get_order <reference>
# get_order() {
#     local reference=$1
    
#     response=$(curl -s -X GET \
#         -H "Cookie: guest_id=$GUEST_ID" \
#         "$API_BASE_URL/api/orders/$reference")
    
#     echo "$response"
# }


# # Mock Verification (For Fraud/Amount Mismatch Tests)
# # In helpers/api_helpers.sh

# verify_payment_mock() {
#     local ref=$1
#     local amount=$2
#     # Ensure no double slashes: Use ${API_BASE_URL%/} to strip trailing slash
#     curl -s -X GET "${API_BASE_URL%/}/api/payments/verify/$ref" \
#         -H "X-Mock-Status: success" \
#         -H "X-Mock-Amount: $amount"
# }


# # Send webhook
# send_webhook() {
#     local json_file=$1
#     local signature=$2
    
#     log_info "Sending webhook to server..."
    
#     # Updated path: /api/webhooks/paystack
#     response=$(curl -s -X POST \
#         -H "Content-Type: application/json" \
#         -H "x-paystack-signature: $signature" \
#         -d @"$json_file" \
#         "$API_BASE_URL/api/webhooks/paystack")
    
#     echo "$response"
# }
# # Extract JSON value - More robust for Windows/MINGW
# extract_json() {
#     local json=$1
#     local key=$2
#     # 1. Strip carriage returns
#     # 2. Use grep to find the JSON part if there's prefix text
#     # 3. Use jq safely
#     echo "$json" | tr -d '\r' | grep -o '{.*}' | jq -r ".$key // empty" 2>/dev/null
# }

# # Apply the same to nested
# extract_nested_json() {
#     local json=$1
#     local path=$2
#     echo "$json" | tr -d '\r' | grep -o '{.*}' | jq -r "$path // empty" 2>/dev/null
# }


# # Pretty print JSON - Added safety for empty/bad strings
# pretty_json() {
#     if [ -z "$1" ] || [ "$1" == "null" ]; then
#         log_warning "Attempted to pretty print empty JSON"
#     else
#         echo "$1" | tr -d '\r' | jq '.'
#     fi
# }

# # Check HTTP status from response headers
# # Usage: get_http_status <curl_response_with_headers>
# get_http_status() {
#     echo "$1" | grep -oP 'HTTP/\d\.\d \K\d{3}'
# }

# # Concurrent requests helper
# # Usage: concurrent_requests <count> <command>
# concurrent_requests() {
#     local count=$1
#     local command=$2
    
#     log_info "Executing $count concurrent requests"
    
#     for i in $(seq 1 "$count"); do
#         eval "$command" &
#     done
    
#     wait
# }

# # Wait for condition
# # Usage: wait_for_condition <max_attempts> <sleep_seconds> <command>
# wait_for_condition() {
#     local max_attempts=$1
#     local sleep_seconds=$2
#     local command=$3
#     local attempt=0
    
#     while [ $attempt -lt "$max_attempts" ]; do
#         if eval "$command"; then
#             log_success "Condition met after $attempt attempts"
#             return 0
#         fi
#         attempt=$((attempt + 1))
#         sleep "$sleep_seconds"
#     done
    
#     log_error "Condition not met after $max_attempts attempts"
#     return 1
# }
# verify_payment_mock() {
#     local ref=$1
#     local amount=$2
#     # We send the amount in a custom header that our Go 'Development' middleware can read
#     curl -s -X GET "$API_URL/payments/verify/$ref" \
#         -H "X-Mock-Status: success" \
#         -H "X-Mock-Amount: $amount" \
#         -H "Cookie: guest_id=$GUEST_ID"
# }
# # Generate test reference
# generate_test_reference() {
#     echo "TIX_$(date +%s)_$(openssl rand -hex 4)"
# }

# # # Pretty print JSON
# # pretty_json() {
# #     echo "$1" | jq '.'
# # }

# # Export functions for use in other scripts
# export -f log_info log_success log_error log_warning
# export -f init_order verify_payment get_order send_webhook
# export -f extract_json extract_nested_json
# export -f concurrent_requests wait_for_condition
# export -f generate_test_reference pretty_json