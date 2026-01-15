#!/bin/bash
# backend/test_scripts/test/08_simple_stress_test.sh

set -e

echo "=== SIMPLE ATOMIC STRESS TEST ==="
echo "Started at: $(date)"
echo ""

# Configuration
API_URL="http://localhost:8081"
LOG_FILE="simple_stress_$(date +%Y%m%d_%H%M%S).log"

# Function to log with timestamp
log() {
    echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    curl -s -w " HTTP_STATUS:%{http_code}" \
        -X "$method" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=test_guest_$(date +%s)" \
        ${data:+ -d "$data"} \
        "${API_URL}${endpoint}"
}

# Test 1: Basic Order Creation
log "Test 1: Basic Order Creation"
ORDER_JSON='{
    "email": "test_buyer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+2348012345678",
    "items": [
        {
            "eventId": "027554f8-d41a-4b39-985b-730983cb4c42",
            "tierName": "General Admission",
            "quantity": 2
        }
    ]
}'

response=$(api_call "POST" "/api/orders/initialize" "$ORDER_JSON")
http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
json_response=$(echo "$response" | sed 's/ HTTP_STATUS:[0-9]*$//')

log "HTTP Status: $http_status"
if [ "$http_status" = "201" ]; then
    reference=$(echo "$json_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['reference'])" 2>/dev/null || echo "N/A")
    log "✅ Order created successfully. Reference: $reference"
else
    log "❌ Order creation failed. Response: $json_response"
fi

echo ""

# Test 2: Invalid Order (Empty Cart)
log "Test 2: Invalid Order (Empty Cart)"
INVALID_JSON='{
    "email": "test@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "items": []
}'

response=$(api_call "POST" "/api/orders/initialize" "$INVALID_JSON")
http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
log "HTTP Status: $http_status"
if [[ "$http_status" = "400" || "$http_status" = "422" ]]; then
    log "✅ Properly rejected invalid order"
else
    log "⚠️ Unexpected response for invalid order"
fi

echo ""

# Test 3: Payment Verification (if we have a reference)
if [ -n "$reference" ] && [ "$reference" != "N/A" ]; then
    log "Test 3: Payment Verification for $reference"
    response=$(api_call "GET" "/api/payments/verify/$reference" "")
    http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    json_response=$(echo "$response" | sed 's/ HTTP_STATUS:[0-9]*$//')
    
    log "HTTP Status: $http_status"
    if [ "$http_status" = "200" ]; then
        status=$(echo "$json_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "N/A")
        log "✅ Payment verification returned: $status"
    else
        log "⚠️ Payment verification returned status: $http_status"
    fi
else
    log "⏭️ Skipping payment verification (no reference available)"
fi

echo ""

# Test 4: Get Order
if [ -n "$reference" ] && [ "$reference" != "N/A" ]; then
    log "Test 4: Get Order by Reference"
    response=$(api_call "GET" "/api/orders/$reference" "")
    http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    log "HTTP Status: $http_status"
    if [[ "$http_status" = "200" || "$http_status" = "404" ]]; then
        log "✅ Order endpoint responded correctly"
    else
        log "⚠️ Unexpected response from order endpoint"
    fi
fi

echo ""
log "=== TEST COMPLETE ==="
echo "Log saved to: $LOG_FILE"