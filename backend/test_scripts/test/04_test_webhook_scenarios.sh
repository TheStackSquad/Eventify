#!/bin/bash
# scripts/test/04_test_webhook_scenarios.sh
# Test Paystack webhook handling and edge cases

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers/api_helpers.sh"
source "$SCRIPT_DIR/helpers/db_helpers.sh"
source "$SCRIPT_DIR/helpers/assertions.sh"

# Helper to send webhook
send_paystack_webhook() {
    local reference=$1
    local status=$2
    local amount=$3
    
    local payload=$(cat <<EOF
{
  "event": "charge.$status",
  "data": {
    "reference": "$reference",
    "amount": $amount,
    "status": "$status",
    "paid_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
    "channel": "card",
    "fees": 150,
    "currency": "NGN",
    "customer": {
      "email": "test@example.com",
      "customer_code": "CUS_test123"
    },
    "authorization": {
      "authorization_code": "AUTH_test",
      "bin": "408408",
      "last4": "4081",
      "exp_month": "12",
      "exp_year": "2030",
      "channel": "card",
      "card_type": "visa",
      "bank": "TEST Bank",
      "country_code": "NG",
      "brand": "visa"
    }
  }
}
EOF
    )
    
    # Calculate HMAC signature
    local signature=$(echo -n "$payload" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" | awk '{print $2}')
    
    # Send webhook
    curl -s -X POST "$API_BASE_URL/api/webhooks/paystack" \
        -H "Content-Type: application/json" \
        -H "x-paystack-signature: $signature" \
        -d "$payload"
}

echo "========================================"
echo "TEST: Paystack Webhook Scenarios"
echo "========================================"

db_check_connection || exit 1

# Get valid test data
VALID_EVENT_ID=$(db_query "SELECT id FROM events WHERE status = 'published' LIMIT 1" | tail -n 1 | tr -d ' ')
VALID_TIER=$(db_query "SELECT name FROM ticket_tiers WHERE event_id = '$VALID_EVENT_ID' AND available > 10 LIMIT 1" | tail -n 1 | tr -d ' ')

echo ""
log_info "Test 1: Valid Webhook - Successful Payment"
echo "------------------------------------"

# Create order
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "webhook_success@example.com",
  "firstName": "Webhook",
  "lastName": "Success",
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
TEST_REF=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$TEST_REF'" | tail -n 1 | tr -d ' ')
FINAL_TOTAL=$(db_query "SELECT final_total FROM orders WHERE reference = '$TEST_REF'" | tail -n 1)

log_info "Order created: $TEST_REF, Total: $FINAL_TOTAL kobo"

# Send success webhook
webhook_response=$(send_paystack_webhook "$TEST_REF" "success" "$FINAL_TOTAL")
pretty_json "$webhook_response"

webhook_status=$(extract_json "$webhook_response" "status")
assert_equals "$webhook_status" "success" "Webhook should process successfully"

# Verify order status
order_status=$(db_get_order_status "$TEST_REF")
assert_equals "$order_status" "success" "Order should be marked as success"

# Verify tickets created
ticket_count=$(db_count_tickets "$ORDER_ID")
assert_equals "$ticket_count" "2" "Tickets should be created"

# Verify webhook_attempts counter
webhook_attempts=$(db_query "SELECT webhook_attempts FROM orders WHERE reference = '$TEST_REF'" | tail -n 1)
assert_equals "$webhook_attempts" "1" "Webhook attempts should be recorded"

log_success "✓ Success webhook processed correctly"

db_delete_order "$TEST_REF"

echo ""
log_info "Test 2: Invalid Webhook Signature"
echo "------------------------------------"

# Create order
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "invalid_sig@example.com",
  "firstName": "Invalid",
  "lastName": "Signature",
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
INVALID_REF=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

# Send webhook with invalid signature
INVALID_PAYLOAD='{"event":"charge.success","data":{"reference":"'$INVALID_REF'","status":"success"}}'
invalid_response=$(curl -s -X POST "$API_BASE_URL/api/webhooks/paystack" \
    -H "Content-Type: application/json" \
    -H "x-paystack-signature: invalid_signature_12345" \
    -d "$INVALID_PAYLOAD")

pretty_json "$invalid_response"

# Verify rejection
invalid_message=$(extract_json "$invalid_response" "message")
assert_equals "$invalid_message" "Invalid signature" "Should reject invalid signature"

# Verify order remains pending
order_status=$(db_get_order_status "$INVALID_REF")
assert_equals "$order_status" "pending" "Order should remain pending"

db_delete_order "$INVALID_REF"

echo ""
log_info "Test 3: Duplicate Webhook (Idempotency)"
echo "------------------------------------"

# Create order
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "duplicate_webhook@example.com",
  "firstName": "Duplicate",
  "lastName": "Webhook",
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
DUP_REF=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

DUP_ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$DUP_REF'" | tail -n 1 | tr -d ' ')
DUP_TOTAL=$(db_query "SELECT final_total FROM orders WHERE reference = '$DUP_REF'" | tail -n 1)

# Send first webhook
log_info "Sending first webhook..."
webhook1=$(send_paystack_webhook "$DUP_REF" "success" "$DUP_TOTAL")
status1=$(extract_json "$webhook1" "status")
log_success "First webhook: $status1"

# Get initial ticket count
tickets_after_first=$(db_count_tickets "$DUP_ORDER_ID")
log_info "Tickets after first webhook: $tickets_after_first"

# Send duplicate webhook immediately
log_info "Sending duplicate webhook..."
webhook2=$(send_paystack_webhook "$DUP_REF" "success" "$DUP_TOTAL")
status2=$(extract_json "$webhook2" "status")
log_success "Second webhook: $status2"

# Verify no duplicate tickets
tickets_after_second=$(db_count_tickets "$DUP_ORDER_ID")
assert_equals "$tickets_after_second" "$tickets_after_first" "No duplicate tickets from duplicate webhook"

# Verify webhook_attempts incremented
webhook_attempts=$(db_query "SELECT webhook_attempts FROM orders WHERE reference = '$DUP_REF'" | tail -n 1)
log_info "Total webhook attempts: $webhook_attempts"

log_success "✓ Duplicate webhook handled correctly"

db_delete_order "$DUP_REF"

echo ""
log_info "Test 4: Failed Payment Webhook"
echo "------------------------------------"

# Create order
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "failed_payment@example.com",
  "firstName": "Failed",
  "lastName": "Payment",
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
FAILED_REF=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

FAILED_ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$FAILED_REF'" | tail -n 1 | tr -d ' ')
FAILED_TIER_ID=$(db_query "SELECT ticket_tier_id FROM order_items WHERE order_id = '$FAILED_ORDER_ID'" | tail -n 1 | tr -d ' ')

# Get initial stock
initial_stock=$(db_query "SELECT available FROM ticket_tiers WHERE id = '$FAILED_TIER_ID'" | tail -n 1)

# Send failed webhook
webhook_response=$(send_paystack_webhook "$FAILED_REF" "failed" "0")
pretty_json "$webhook_response"

# Verify order marked as failed
order_status=$(db_get_order_status "$FAILED_REF")
# Note: Your system might keep it pending or mark it failed depending on implementation
log_info "Order status after failed webhook: $order_status"

# Verify no tickets created
ticket_count=$(db_count_tickets "$FAILED_ORDER_ID")
assert_equals "$ticket_count" "0" "No tickets should be created for failed payment"

# Verify stock wasn't reduced (or was released if it was reserved)
final_stock=$(db_query "SELECT available FROM ticket_tiers WHERE id = '$FAILED_TIER_ID'" | tail -n 1)
# Stock should be >= initial (in case of reservation release)
if [ $final_stock -lt $initial_stock ]; then
    log_error "Stock reduced for failed payment!"
    exit 1
fi

log_success "✓ Failed payment handled correctly"

db_delete_order "$FAILED_REF"

echo ""
log_info "Test 5: Webhook for Non-Existent Order"
echo "------------------------------------"

FAKE_REFERENCE="TIX_9999999999999_nonexistent"
webhook_response=$(send_paystack_webhook "$FAKE_REFERENCE" "success" "100000")
pretty_json "$webhook_response"

# Should handle gracefully (might return success or error depending on implementation)
webhook_status=$(extract_json "$webhook_response" "status")
log_info "Webhook status for non-existent order: $webhook_status"

echo ""
log_info "Test 6: Multiple Webhooks in Rapid Succession"
echo "------------------------------------"

# Create order
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "rapid_webhooks@example.com",
  "firstName": "Rapid",
  "lastName": "Webhooks",
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
RAPID_REF=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

RAPID_ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$RAPID_REF'" | tail -n 1 | tr -d ' ')
RAPID_TOTAL=$(db_query "SELECT final_total FROM orders WHERE reference = '$RAPID_REF'" | tail -n 1)

# Send 5 webhooks rapidly
log_info "Sending 5 rapid webhooks..."
for i in {1..5}; do
    send_paystack_webhook "$RAPID_REF" "success" "$RAPID_TOTAL" > /dev/null &
done
wait

log_success "All webhooks sent"

# Wait a moment for processing
sleep 2

# Verify tickets
final_tickets=$(db_count_tickets "$RAPID_ORDER_ID")
assert_equals "$final_tickets" "3" "Should have exactly 3 tickets (no duplicates)"

log_success "✓ Rapid webhooks handled correctly"

db_delete_order "$RAPID_REF"

echo ""
log_info "Test 7: Webhook Arrives Before Manual Verification"
echo "------------------------------------"

# Create order
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "webhook_first@example.com",
  "firstName": "Webhook",
  "lastName": "First",
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
WEBHOOK_FIRST_REF=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

WEBHOOK_FIRST_ORDER=$(db_query "SELECT id FROM orders WHERE reference = '$WEBHOOK_FIRST_REF'" | tail -n 1 | tr -d ' ')
WEBHOOK_FIRST_TOTAL=$(db_query "SELECT final_total FROM orders WHERE reference = '$WEBHOOK_FIRST_REF'" | tail -n 1)

# Send webhook first
log_info "Webhook arrives first..."
send_paystack_webhook "$WEBHOOK_FIRST_REF" "success" "$WEBHOOK_FIRST_TOTAL" > /dev/null

sleep 1

# Then try manual verification
log_info "User attempts manual verification..."
verify_response=$(verify_payment "$WEBHOOK_FIRST_REF")
verify_status=$(extract_json "$verify_response" "status")

assert_equals "$verify_status" "success" "Manual verification should succeed after webhook"

# Verify no duplicate tickets
final_tickets=$(db_count_tickets "$WEBHOOK_FIRST_ORDER")
assert_equals "$final_tickets" "2" "No duplicate tickets from webhook + verification"

log_success "✓ Webhook-first scenario handled correctly"

db_delete_order "$WEBHOOK_FIRST_REF"

print_test_summary