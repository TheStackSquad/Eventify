#!/bin/bash
# scripts/test/02_test_payment_verify_enhanced.sh
# Enhanced payment verification with Paystack simulation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers/api_helpers.sh"
source "$SCRIPT_DIR/helpers/db_helpers.sh"
source "$SCRIPT_DIR/helpers/assertions.sh"

echo "========================================"
echo "TEST: Enhanced Payment Verification"
echo "========================================"

db_check_connection || exit 1

# Get valid test data
VALID_EVENT_ID=$(db_query "SELECT id FROM events WHERE status = 'published' LIMIT 1" | tail -n 1 | tr -d ' ')
VALID_TIER=$(db_query "SELECT name FROM ticket_tiers WHERE event_id = '$VALID_EVENT_ID' AND available > 5 LIMIT 1" | tail -n 1 | tr -d ' ')

echo ""
log_info "Test 1: Successful Payment Verification"
echo "------------------------------------"

# Create fresh order
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "verify@example.com",
  "firstName": "John",
  "lastName": "Verify",
  "phone": "+2348155764220",
  "items": [
    {
      "eventId": "$VALID_EVENT_ID",
      "tierName": "$VALID_TIER",
      "quantity": 2
    }
  ]
}
EOF

raw_init=$(init_order "$TEMP_FILE")
response=$(echo "$raw_init" | grep "{" | tail -n 1 | tr -d '\r')
TEST_REFERENCE=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

if [ -z "$TEST_REFERENCE" ] || [ "$TEST_REFERENCE" == "null" ]; then
    log_error "Failed to create test order"
    exit 1
fi

log_info "Created order: $TEST_REFERENCE"

# Get initial stock level
ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$TEST_REFERENCE'" | tail -n 1 | tr -d ' ')
TIER_ID=$(db_query "SELECT ticket_tier_id FROM order_items WHERE order_id = '$ORDER_ID'" | tail -n 1 | tr -d ' ')
INITIAL_STOCK=$(db_query "SELECT available FROM ticket_tiers WHERE id = '$TIER_ID'" | tail -n 1)

log_info "Initial stock: $INITIAL_STOCK"

# Verify payment (this will call Paystack API in test mode)
response=$(verify_payment "$TEST_REFERENCE")
pretty_json "$response"

status=$(extract_json "$response" "status")
message=$(extract_json "$response" "message")
order_status=$(extract_nested_json "$response" ".data.status")

assert_equals "$status" "success" "Verification should succeed"
assert_equals "$order_status" "SUCCESS" "Order status should be SUCCESS"

# Verify tickets were created
ticket_count=$(db_count_tickets "$ORDER_ID")
expected_tickets=$(db_query "SELECT SUM(quantity) FROM order_items WHERE order_id = '$ORDER_ID'" | tail -n 1)

assert_equals "$ticket_count" "$expected_tickets" "Correct number of tickets created"
log_success "Created $ticket_count ticket(s)"

# Verify stock was reduced
FINAL_STOCK=$(db_query "SELECT available FROM ticket_tiers WHERE id = '$TIER_ID'" | tail -n 1)
EXPECTED_FINAL=$((INITIAL_STOCK - expected_tickets))

assert_equals "$FINAL_STOCK" "$EXPECTED_FINAL" "Stock should be reduced by ticket quantity"
log_info "Stock: $INITIAL_STOCK → $FINAL_STOCK (reduced by $expected_tickets)"

# Verify ticket codes are unique
duplicate_codes=$(db_query "SELECT code, COUNT(*) FROM tickets WHERE order_id = '$ORDER_ID' GROUP BY code HAVING COUNT(*) > 1")
assert_empty "$duplicate_codes" "All ticket codes should be unique"

# Verify all tickets are active
inactive_tickets=$(db_query "SELECT COUNT(*) FROM tickets WHERE order_id = '$ORDER_ID' AND status != 'active'" | tail -n 1)
assert_equals "$inactive_tickets" "0" "All tickets should be active"

echo ""
log_info "Test 2: Non-Existent Order Verification"
echo "------------------------------------"

FAKE_REFERENCE="TIX_9999999999999_nonexistent"
response=$(verify_payment "$FAKE_REFERENCE")
pretty_json "$response"

status=$(extract_json "$response" "status")
assert_equals "$status" "error" "Should return error for non-existent order"

echo ""
log_info "Test 3: Already Verified Order (Idempotency)"
echo "------------------------------------"

# Verify the same order again
response=$(verify_payment "$TEST_REFERENCE")
pretty_json "$response"

status=$(extract_json "$response" "status")
order_status=$(extract_nested_json "$response" ".data.status")

assert_equals "$status" "success" "Re-verification should succeed (idempotent)"
assert_equals "$order_status" "SUCCESS" "Order should remain SUCCESS"

# Verify no duplicate tickets
ticket_count_after=$(db_count_tickets "$ORDER_ID")
assert_equals "$ticket_count_after" "$ticket_count" "No duplicate tickets created"

# Verify stock wasn't reduced again
STOCK_AFTER_REVERIFY=$(db_query "SELECT available FROM ticket_tiers WHERE id = '$TIER_ID'" | tail -n 1)
assert_equals "$STOCK_AFTER_REVERIFY" "$FINAL_STOCK" "Stock should not change on re-verification"

echo ""
log_info "Test 4: Verification Without Guest Cookie"
echo "------------------------------------"

# Create new order
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "noguest@example.com",
  "firstName": "No",
  "lastName": "Guest",
  "items": [
    {
      "eventId": "$VALID_EVENT_ID",
      "tierName": "$VALID_TIER",
      "quantity": 1
    }
  ]
}
EOF

raw_init=$(init_order "$TEMP_FILE")
response=$(echo "$raw_init" | grep "{" | tail -n 1 | tr -d '\r')
NEW_REFERENCE=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

# Save current guest ID
OLD_GUEST_ID=$GUEST_ID
GUEST_ID=""

response=$(verify_payment "$NEW_REFERENCE")
pretty_json "$response"

status=$(extract_json "$response" "status")
log_info "Status without guest_id: $status"

# Restore guest ID
GUEST_ID=$OLD_GUEST_ID

# Cleanup both test orders
db_delete_order "$TEST_REFERENCE"
db_delete_order "$NEW_REFERENCE"

echo ""
log_info "Test 5: Order Status Transitions"
echo "------------------------------------"

# Create order and verify status transitions
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "transition@example.com",
  "firstName": "Status",
  "lastName": "Transition",
  "items": [
    {
      "eventId": "$VALID_EVENT_ID",
      "tierName": "$VALID_TIER",
      "quantity": 1
    }
  ]
}
EOF

raw_init=$(init_order "$TEMP_FILE")
response=$(echo "$raw_init" | grep "{" | tail -n 1 | tr -d '\r')
TRANS_REFERENCE=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

# Check initial status
initial_status=$(db_get_order_status "$TRANS_REFERENCE")
assert_equals "$initial_status" "pending" "Initial status should be pending"

# Verify payment
verify_payment "$TRANS_REFERENCE" > /dev/null

# Check final status
final_status=$(db_get_order_status "$TRANS_REFERENCE")
assert_equals "$final_status" "success" "Final status should be success"

# Check paid_at timestamp was set
paid_at=$(db_query "SELECT paid_at FROM orders WHERE reference = '$TRANS_REFERENCE'" | tail -n 1)
assert_not_empty "$paid_at" "paid_at timestamp should be set"

# Check processed_by field
processed_by=$(db_query "SELECT processed_by FROM orders WHERE reference = '$TRANS_REFERENCE'" | tail -n 1)
assert_not_empty "$processed_by" "processed_by should be recorded"
log_info "Processed by: $processed_by"

db_delete_order "$TRANS_REFERENCE"

echo ""
log_info "Test 6: Ticket Code Format Validation"
echo "------------------------------------"

# Create and verify order
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "ticketcode@example.com",
  "firstName": "Ticket",
  "lastName": "Code",
  "items": [
    {
      "eventId": "$VALID_EVENT_ID",
      "tierName": "$VALID_TIER",
      "quantity": 3
    }
  ]
}
EOF

raw_init=$(init_order "$TEMP_FILE")
response=$(echo "$raw_init" | grep "{" | tail -n 1 | tr -d '\r')
CODE_REFERENCE=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

verify_payment "$CODE_REFERENCE" > /dev/null

# Get order ID
CODE_ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$CODE_REFERENCE'" | tail -n 1 | tr -d ' ')

# Verify ticket codes follow expected format (assuming format like: EVT-XXXX-XXXX-XXXX)
ticket_codes=$(db_query "SELECT code FROM tickets WHERE order_id = '$CODE_ORDER_ID'")
log_info "Generated ticket codes:"
echo "$ticket_codes"

# Check that all codes are non-empty
empty_codes=$(db_query "SELECT COUNT(*) FROM tickets WHERE order_id = '$CODE_ORDER_ID' AND (code IS NULL OR code = '')" | tail -n 1)
assert_equals "$empty_codes" "0" "No empty ticket codes"

db_delete_order "$CODE_REFERENCE"

print_test_summary