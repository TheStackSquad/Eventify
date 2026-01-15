#!/bin/bash
# backend/test_scripts/test/08_fixed_stress_test.sh

set -e

echo "=== ATOMIC PAYMENT STRESS TEST (FIXED) ==="
echo "Started: $(date)"
echo ""

# Load environment properly
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../.env"

if [ -f "$ENV_FILE" ]; then
    echo "Loading environment from: $ENV_FILE"
    # Cleaner way to load env vars
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ $key =~ ^#.*$ ]] || [[ -z $key ]] && continue
        # Remove quotes and export
        value=$(echo "$value" | sed "s/^['\"]//;s/['\"]$//")
        export "$key=$value"
    done < "$ENV_FILE"
fi

# Configuration
API_URL="${API_BASE_URL:-http://localhost:8081}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-Eventify}"
DB_USER="${DB_USER:-astronautdesh}"
DB_PASSWORD="${DB_PASSWORD:-astronautdesh}"

LOG_FILE="atomic_stress_$(date +%Y%m%d_%H%M%S).log"
TEST_DATA_FILE="/tmp/test_data_$(date +%s).json"

echo "Configuration:" | tee -a "$LOG_FILE"
echo "  API: $API_URL" | tee -a "$LOG_FILE"
echo "  DB: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME" | tee -a "$LOG_FILE"
echo "  Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Helper functions
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%H:%M:%S')
    echo "[$timestamp] $message" | tee -a "$LOG_FILE"
}

check_response() {
    local response="$1"
    local expected_status="$2"
    
    # Extract HTTP status
    local http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    
    # Extract JSON body
    local json_body=$(echo "$response" | sed 's/ HTTP_STATUS:[0-9]*$//')
    
    if [ "$http_status" = "$expected_status" ]; then
        log "INFO" "✓ HTTP $http_status (expected $expected_status)"
        echo "$json_body"
        return 0
    else
        log "ERROR" "✗ HTTP $http_status (expected $expected_status)"
        echo "$json_body"
        return 1
    fi
}

api_request() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    local guest_id="test_guest_$(date +%s)"
    
    local curl_cmd="curl -s -w ' HTTP_STATUS:%{http_code}' -X '$method'"
    curl_cmd="$curl_cmd -H 'Content-Type: application/json'"
    curl_cmd="$curl_cmd -H 'Cookie: guest_id=$guest_id'"
    
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi
    
    curl_cmd="$curl_cmd '$API_URL$endpoint'"
    
    eval "$curl_cmd"
}

db_query() {
    local sql="$1"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "$sql" 2>/dev/null || echo ""
}

# Test 1: Create Valid Order
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
log "TEST" "1. ATOMIC ORDER CREATION" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"

# Create test order payload
cat > "$TEST_DATA_FILE" << EOF
{
    "email": "atomic_test_$(date +%s)@example.com",
    "firstName": "Atomic",
    "lastName": "Test",
    "phone": "+2348012345678",
    "items": [
        {
            "eventId": "027554f8-d41a-4b39-985b-730983cb4c42",
            "tierName": "General Admission",
            "quantity": 2
        }
    ]
}
EOF

log "INFO" "Creating order..."
response=$(api_request "POST" "/api/orders/initialize" "$(cat "$TEST_DATA_FILE")")
json_response=$(check_response "$response" "201")

if [ $? -eq 0 ]; then
    # Extract reference using jq (more reliable than Python)
    reference=$(echo "$json_response" | jq -r '.data.reference // empty')
    
    if [ -n "$reference" ]; then
        log "SUCCESS" "Order created with reference: $reference"
        
        # Verify in database
        log "INFO" "Verifying database entry..."
        db_result=$(db_query "SELECT reference, status FROM orders WHERE reference = '$reference'")
        
        if [ -n "$db_result" ]; then
            log "SUCCESS" "Order found in database: $db_result"
        else
            log "ERROR" "Order NOT found in database!"
        fi
    else
        log "ERROR" "No reference in response!"
        echo "Response: $json_response" | tee -a "$LOG_FILE"
    fi
fi

echo "" | tee -a "$LOG_FILE"

# Test 2: Concurrent Requests Test
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
log "TEST" "2. CONCURRENCY TEST" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"

# Get current stock
log "INFO" "Checking current stock..."
initial_stock=$(db_query "SELECT available FROM ticket_tiers WHERE event_id = '027554f8-d41a-4b39-985b-730983cb4c42' AND tier_name = 'General Admission'")
log "INFO" "Initial stock: $initial_stock"

# Create concurrent test payload
cat > /tmp/concurrent_test.json << EOF
{
    "email": "concurrent_$(date +%s)@example.com",
    "firstName": "Concurrent",
    "lastName": "Test",
    "phone": "+2348012345678",
    "items": [
        {
            "eventId": "027554f8-d41a-4b39-985b-730983cb4c42",
            "tierName": "General Admission",
            "quantity": 1
        }
    ]
}
EOF

# Run 5 concurrent requests
log "INFO" "Starting 5 concurrent order requests..."
for i in {1..5}; do
    (
        local_response=$(api_request "POST" "/api/orders/initialize" "$(cat /tmp/concurrent_test.json)")
        local_status=$(echo "$local_response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
        if [ "$local_status" = "201" ]; then
            echo "SUCCESS" >> /tmp/concurrent_results.txt
        elif [ "$local_status" = "409" ]; then
            echo "CONFLICT" >> /tmp/concurrent_results.txt
        else
            echo "FAILED_$local_status" >> /tmp/concurrent_results.txt
        fi
    ) &
done

wait
sleep 1

# Count results
success_count=$(grep -c "SUCCESS" /tmp/concurrent_results.txt 2>/dev/null || echo "0")
conflict_count=$(grep -c "CONFLICT" /tmp/concurrent_results.txt 2>/dev/null || echo "0")

log "INFO" "Results - Success: $success_count, Conflicts: $conflict_count"

# Check final stock
final_stock=$(db_query "SELECT available FROM ticket_tiers WHERE event_id = '027554f8-d41a-4b39-985b-730983cb4c42' AND tier_name = 'General Admission'")
expected_stock=$((initial_stock - success_count))

log "INFO" "Final stock: $final_stock (Expected: $expected_stock)"

if [ "$final_stock" -eq "$expected_stock" ]; then
    log "SUCCESS" "Stock integrity maintained under concurrent load!"
else
    log "ERROR" "STOCK INTEGRITY FAILED! Possible race condition."
fi

rm -f /tmp/concurrent_results.txt
echo "" | tee -a "$LOG_FILE"

# Test 3: Payment Verification (if we have a reference)
if [ -n "$reference" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
    log "TEST" "3. PAYMENT VERIFICATION" | tee -a "$LOG_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
    
    log "INFO" "Verifying payment for: $reference"
    
    # First, simulate a successful payment by updating the order
    log "INFO" "Simulating successful payment..."
    db_query "UPDATE orders SET status = 'success', amount_paid = final_total, paid_at = NOW() WHERE reference = '$reference'" > /dev/null
    
    # Now verify
    response=$(api_request "GET" "/api/payments/verify/$reference")
    json_response=$(check_response "$response" "200")
    
    if [ $? -eq 0 ]; then
        status=$(echo "$json_response" | jq -r '.status // empty')
        log "SUCCESS" "Verification successful: $status"
    else
        log "ERROR" "Verification failed"
    fi
    
    # Test idempotency: verify again
    log "INFO" "Testing idempotency (second verification)..."
    response2=$(api_request "GET" "/api/payments/verify/$reference")
    status2=$(echo "$response2" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    
    if [[ "$status2" = "200" || "$status2" = "409" ]]; then
        log "SUCCESS" "Idempotency check passed (HTTP $status2)"
    else
        log "WARN" "Unexpected idempotency response: HTTP $status2"
    fi
    
    echo "" | tee -a "$LOG_FILE"
fi

# Test 4: Get Order Endpoint
if [ -n "$reference" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
    log "TEST" "4. ORDER RETRIEVAL" | tee -a "$LOG_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
    
    log "INFO" "Getting order: $reference"
    response=$(api_request "GET" "/api/orders/$reference")
    json_response=$(check_response "$response" "200")
    
    if [ $? -eq 0 ]; then
        order_status=$(echo "$json_response" | jq -r '.data.status // empty')
        log "SUCCESS" "Order retrieved: status = $order_status"
    fi
    
    echo "" | tee -a "$LOG_FILE"
fi

# Test 5: Invalid Request Handling
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
log "TEST" "5. ERROR HANDLING" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"

# Test empty cart
log "INFO" "Testing empty cart rejection..."
empty_cart='{"email":"test@example.com","firstName":"Test","lastName":"User","items":[]}'
response=$(api_request "POST" "/api/orders/initialize" "$empty_cart")
check_response "$response" "400" > /dev/null && log "SUCCESS" "Empty cart properly rejected"

# Test invalid email
log "INFO" "Testing invalid email..."
invalid_email='{"email":"not-an-email","firstName":"Test","lastName":"User","items":[{"eventId":"027554f8-d41a-4b39-985b-730983cb4c42","tierName":"General Admission","quantity":1}]}'
response=$(api_request "POST" "/api/orders/initialize" "$invalid_email")
check_response "$response" "400" > /dev/null && log "SUCCESS" "Invalid email properly rejected"

# Test non-existent event
log "INFO" "Testing non-existent event..."
nonexistent_event='{"email":"test@example.com","firstName":"Test","lastName":"User","items":[{"eventId":"00000000-0000-0000-0000-000000000000","tierName":"General Admission","quantity":1}]}'
response=$(api_request "POST" "/api/orders/initialize" "$nonexistent_event")
if echo "$response" | grep -q "HTTP_STATUS:404\|HTTP_STATUS:400\|HTTP_STATUS:500"; then
    log "SUCCESS" "Non-existent event properly handled"
else
    log "WARN" "Unexpected response for non-existent event"
fi

echo "" | tee -a "$LOG_FILE"

# Test 6: Stock Exhaustion
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
log "TEST" "6. STOCK EXHAUSTION" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"

# Get current stock
current_stock=$(db_query "SELECT available FROM ticket_tiers WHERE event_id = '027554f8-d41a-4b39-985b-730983cb4c42' AND tier_name = 'General Admission'")
log "INFO" "Current stock: $current_stock"

# Try to order more than available
if [ "$current_stock" -gt 0 ]; then
    excessive_quantity=$((current_stock + 10))
    cat > /tmp/excess_stock.json << EOF
{
    "email": "stock_test_$(date +%s)@example.com",
    "firstName": "Stock",
    "lastName": "Test",
    "phone": "+2348012345678",
    "items": [
        {
            "eventId": "027554f8-d41a-4b39-985b-730983cb4c42",
            "tierName": "General Admission",
            "quantity": $excessive_quantity
        }
    ]
}
EOF
    
    log "INFO" "Attempting to order $excessive_quantity tickets (only $current_stock available)..."
    response=$(api_request "POST" "/api/orders/initialize" "$(cat /tmp/excess_stock.json)")
    check_response "$response" "409" > /dev/null && log "SUCCESS" "Stock exhaustion properly handled with 409 Conflict"
fi

echo "" | tee -a "$LOG_FILE"

# Cleanup
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
log "INFO" "CLEANUP" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"

if [ -n "$reference" ]; then
    log "INFO" "Cleaning up test order: $reference"
    db_query "DELETE FROM orders WHERE reference = '$reference'" > /dev/null
    log "SUCCESS" "Test data cleaned up"
fi

# Reset stock
db_query "UPDATE ticket_tiers SET available = 100 WHERE event_id = '027554f8-d41a-4b39-985b-730983cb4c42' AND tier_name = 'General Admission'" > /dev/null
log "INFO" "Stock reset to 100"

# Clean temp files
rm -f "$TEST_DATA_FILE" /tmp/concurrent_test.json /tmp/excess_stock.json

echo "" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
log "INFO" "TEST COMPLETE" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
log "INFO" "Detailed log saved to: $LOG_FILE" | tee -a "$LOG_FILE"
log "INFO" "Check the log file for any errors or warnings." | tee -a "$LOG_FILE"

# Summary
echo "" | tee -a "$LOG_FILE"
echo "=== STRESS TEST SUMMARY ===" | tee -a "$LOG_FILE"
echo "Timestamp: $(date)" | tee -a "$LOG_FILE"
echo "API: $API_URL" | tee -a "$LOG_FILE"
echo "Database: $DB_NAME" | tee -a "$LOG_FILE"
echo "Tests executed: 6" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "============================" | tee -a "$LOG_FILE"