#!/bin/bash
# scripts/test/04_test_concurrent.sh

set -e

# Load helpers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers/api_helpers.sh"
source "$SCRIPT_DIR/helpers/db_helpers.sh"
source "$SCRIPT_DIR/helpers/assertions.sh"

echo "========================================"
echo "TEST: Concurrent Verification Requests"
echo "========================================"

db_check_connection || exit 1

# ---------------------------------------------------------
# STEP 0: Create a fresh order and CAPTURE the session
# ---------------------------------------------------------
log_info "Step 0: Initializing fresh order and capturing session..."

FIXTURE_FILE="$SCRIPT_DIR/fixtures/valid_order.json"
COOKIE_FILE=$(mktemp) # Create a temp file to store the session cookie

# We use -c to write the cookie received from the server
raw_init=$(curl -s -c "$COOKIE_FILE" -X POST \
    -H "Content-Type: application/json" \
    -d @"$FIXTURE_FILE" \
    http://localhost:8081/api/orders/initialize)

# Clean response and extract data
init_res=$(echo "$raw_init" | tr -d '\r' | jq . 2>/dev/null || echo "$raw_init")
TEST_REFERENCE=$(echo "$init_res" | jq -r '.data.reference')
AMOUNT=$(echo "$init_res" | jq -r '.data.amount_kobo')

if [ -z "$TEST_REFERENCE" ] || [ "$TEST_REFERENCE" == "null" ]; then
    log_error "Failed to create reference. Response: $init_res"
    rm "$COOKIE_FILE"
    exit 1
fi

# Get internal ID and expected count for validation later
order_id=$(db_query "SELECT id FROM orders WHERE reference = '$TEST_REFERENCE'" | tr -d ' ')
expected_increment=$(db_query "SELECT SUM(quantity) FROM order_items WHERE order_id = '$order_id'" | tr -d ' ')

log_info "Reference: $TEST_REFERENCE"
log_info "Expected tickets: $expected_increment"

# ---------------------------------------------------------
# TEST 1: 10 Concurrent Verification Requests
# ---------------------------------------------------------
echo ""
log_info "Test 1: Launching 10 concurrent requests..."
echo "------------------------------------"

TEMP_DIR=$(mktemp -d)

for i in {1..10}; do
    (
        # We use -b to send the captured cookie back to prove we own the order
        raw_response=$(curl -s -b "$COOKIE_FILE" -X GET \
            -H "X-Mock-Status: success" \
            -H "X-Mock-Amount: $AMOUNT" \
            "http://localhost:8081/api/payments/verify/$TEST_REFERENCE")
        
        clean_response=$(echo "$raw_response" | tr -d '\r' | grep -o '{.*}')
        echo "$clean_response" > "$TEMP_DIR/response_$i.json"
        
        status=$(echo "$clean_response" | jq -r '.status' 2>/dev/null || echo "parse_error")
        log_info "Request $i finished. Status: $status"
    ) &
done

wait # Wait for all background requests to finish

# ---------------------------------------------------------
# ANALYZING RESULTS & INTEGRITY
# ---------------------------------------------------------
log_info "Verifying Database Integrity..."

final_ticket_count=$(db_count_tickets "$order_id")
log_info "Final ticket count in DB: $final_ticket_count"

# THE RACE CONDITION CHECK:
# If this is > expected_increment, your Go code isn't locking properly.
assert_equals "$final_ticket_count" "$expected_increment" "Should have exactly $expected_increment tickets"

# Check for duplicate codes
ticket_duplicates=$(db_query "SELECT COUNT(*) FROM (SELECT code, COUNT(*) as cnt FROM tickets WHERE order_id = '$order_id' GROUP BY code HAVING COUNT(*) > 1) dup" | tr -d ' ')
assert_equals "$ticket_duplicates" "0" "Should have zero duplicate ticket codes"

# Cleanup
log_info "Cleaning up..."
db_delete_order "$TEST_REFERENCE"
rm -rf "$TEMP_DIR"
rm "$COOKIE_FILE"

echo "========================================"
echo "CONCURRENCY TEST PASSED ✓"
echo "========================================"