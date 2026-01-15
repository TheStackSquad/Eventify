#!/bin/bash
# scripts/test/03_test_idempotency_stress.sh
# Stress test for idempotency and race conditions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers/api_helpers.sh"
source "$SCRIPT_DIR/helpers/db_helpers.sh"
source "$SCRIPT_DIR/helpers/assertions.sh"

echo "========================================"
echo "TEST: Idempotency & Race Conditions"
echo "========================================"

db_check_connection || exit 1

# Get valid test data
VALID_EVENT_ID=$(db_query "SELECT id FROM events WHERE status = 'published' LIMIT 1" | tail -n 1 | tr -d ' ')
VALID_TIER=$(db_query "SELECT name FROM ticket_tiers WHERE event_id = '$VALID_EVENT_ID' AND available > 20 LIMIT 1" | tail -n 1 | tr -d ' ')

echo ""
log_info "Test 1: Sequential Verification Calls (Idempotency Check)"
echo "------------------------------------"

# Create test order
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "idempotent@example.com",
  "firstName": "Idem",
  "lastName": "Potent",
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

ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$TEST_REFERENCE'" | tail -n 1 | tr -d ' ')
log_info "Testing with reference: $TEST_REFERENCE"

# First verification
log_info "Verification attempt 1..."
response1=$(verify_payment "$TEST_REFERENCE")
status1=$(extract_json "$response1" "status")
order_id1=$(extract_nested_json "$response1" ".data.id")
log_success "First call: $status1"

# Get initial state
initial_tickets=$(db_count_tickets "$ORDER_ID")
initial_status=$(db_get_order_status "$TEST_REFERENCE")

log_info "After first verification: $initial_tickets tickets, status=$initial_status"

# Second verification (immediate)
log_info "Verification attempt 2 (immediate)..."
response2=$(verify_payment "$TEST_REFERENCE")
status2=$(extract_json "$response2" "status")
order_id2=$(extract_nested_json "$response2" ".data.id")
log_success "Second call: $status2"

# Third verification
log_info "Verification attempt 3..."
response3=$(verify_payment "$TEST_REFERENCE")
status3=$(extract_json "$response3" "status")
order_id3=$(extract_nested_json "$response3" ".data.id")
log_success "Third call: $status3"

# Assertions
assert_equals "$status1" "success" "First call should succeed"
assert_equals "$status2" "success" "Second call should succeed (idempotent)"
assert_equals "$status3" "success" "Third call should succeed (idempotent)"

assert_equals "$order_id1" "$order_id2" "Order IDs should match"
assert_equals "$order_id2" "$order_id3" "Order IDs should match across calls"

# Verify database state
final_tickets=$(db_count_tickets "$ORDER_ID")
assert_equals "$final_tickets" "$initial_tickets" "Ticket count should remain constant"

log_success "✓ Idempotency verified: $final_tickets tickets (no duplicates)"

echo ""
log_info "Test 2: Rapid Sequential Calls (10 calls)"
echo "------------------------------------"

for i in {1..10}; do
    response=$(verify_payment "$TEST_REFERENCE" 2>&1)
    status=$(extract_json "$response" "status")
    log_info "Call $i: $status"
done

log_success "All rapid calls completed"

# Verify database state
tickets_after_rapid=$(db_count_tickets "$ORDER_ID")
assert_equals "$tickets_after_rapid" "$initial_tickets" "No duplicate tickets after rapid calls"

echo ""
log_info "Test 3: Concurrent Verification (Parallel Requests)"
echo "------------------------------------"

# Create new order for concurrent test
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "concurrent@example.com",
  "firstName": "Con",
  "lastName": "Current",
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
CONCURRENT_REF=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

CONCURRENT_ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$CONCURRENT_REF'" | tail -n 1 | tr -d ' ')

log_info "Launching 5 concurrent verification requests..."

# Launch 5 parallel requests
PIDS=()
for i in {1..5}; do
    (
        response=$(verify_payment "$CONCURRENT_REF" 2>&1)
        status=$(extract_json "$response" "status")
        echo "Concurrent call $i: $status" >> /tmp/concurrent_results_$$.txt
    ) &
    PIDS+=($!)
done

# Wait for all to complete
for pid in "${PIDS[@]}"; do
    wait $pid
done

log_success "All concurrent calls completed"
cat /tmp/concurrent_results_$$.txt
rm /tmp/concurrent_results_$$.txt

# Verify no duplicate tickets
concurrent_tickets=$(db_count_tickets "$CONCURRENT_ORDER_ID")
expected_concurrent=$(db_query "SELECT SUM(quantity) FROM order_items WHERE order_id = '$CONCURRENT_ORDER_ID'" | tail -n 1)

assert_equals "$concurrent_tickets" "$expected_concurrent" "No duplicate tickets from concurrent requests"
log_success "✓ Concurrent safety verified: $concurrent_tickets tickets"

# Verify order status
concurrent_status=$(db_get_order_status "$CONCURRENT_REF")
assert_equals "$concurrent_status" "success" "Order should be in success state"

db_delete_order "$CONCURRENT_REF"

echo ""
log_info "Test 4: Stock Depletion Race Condition"
echo "------------------------------------"

# Find tier with limited stock (or create one)
LIMITED_TIER=$(db_query "SELECT id FROM ticket_tiers WHERE event_id = '$VALID_EVENT_ID' AND available BETWEEN 1 AND 5 LIMIT 1" | tail -n 1 | tr -d ' ')
LIMITED_TIER_NAME=$(db_query "SELECT name FROM ticket_tiers WHERE id = '$LIMITED_TIER'" | tail -n 1 | tr -d ' ')
AVAILABLE_STOCK=$(db_query "SELECT available FROM ticket_tiers WHERE id = '$LIMITED_TIER'" | tail -n 1)

log_info "Testing with tier: $LIMITED_TIER_NAME (available: $AVAILABLE_STOCK)"

# Try to create more orders than available stock
ORDERS_TO_CREATE=$((AVAILABLE_STOCK + 2))
SUCCESSFUL_ORDERS=0

for i in $(seq 1 $ORDERS_TO_CREATE); do
    TEMP_FILE=$(mktemp)
    cat <<EOF > "$TEMP_FILE"
{
  "email": "stock$i@example.com",
  "firstName": "Stock",
  "lastName": "Test$i",
  "items": [
    {
      "eventId": "$VALID_EVENT_ID",
      "tierName": "$LIMITED_TIER_NAME",
      "quantity": 1
    }
  ]
}
EOF
    
    raw_init=$(init_order "$TEMP_FILE" 2>&1)
    response=$(echo "$raw_init" | grep "{" | tail -n 1 | tr -d '\r')
    status=$(extract_json "$response" "status")
    
    if [ "$status" == "success" ]; then
        SUCCESSFUL_ORDERS=$((SUCCESSFUL_ORDERS + 1))
        ref=$(extract_nested_json "$response" ".data.reference")
        log_info "Order $i created: $ref"
    else
        log_warning "Order $i failed (expected): insufficient stock"
    fi
    
    rm "$TEMP_FILE"
done

log_info "Successfully created $SUCCESSFUL_ORDERS orders (max available: $AVAILABLE_STOCK)"

# Verify stock cannot go negative
CURRENT_STOCK=$(db_query "SELECT available FROM ticket_tiers WHERE id = '$LIMITED_TIER'" | tail -n 1)
if [ $CURRENT_STOCK -lt 0 ]; then
    log_error "CRITICAL: Stock went negative! Current: $CURRENT_STOCK"
    exit 1
else
    log_success "✓ Stock remained non-negative: $CURRENT_STOCK"
fi

echo ""
log_info "Test 5: Webhook vs Manual Verification Race"
echo "------------------------------------"

# Create order
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "webhook@example.com",
  "firstName": "Web",
  "lastName": "Hook",
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
WEBHOOK_REF=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

WEBHOOK_ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$WEBHOOK_REF'" | tail -n 1 | tr -d ' ')

log_info "Simulating webhook arrival..."

# Simulate Paystack webhook
WEBHOOK_PAYLOAD=$(cat <<EOF
{
  "event": "charge.success",
  "data": {
    "reference": "$WEBHOOK_REF",
    "amount": 100000,
    "status": "success",
    "paid_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
    "channel": "card",
    "customer": {
      "email": "webhook@example.com"
    }
  }
}
EOF
)

# Calculate webhook signature
SIGNATURE=$(echo -n "$WEBHOOK_PAYLOAD" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" | cut -d' ' -f2)

# Send webhook
webhook_response=$(curl -s -X POST "$API_BASE_URL/api/webhooks/paystack" \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: $SIGNATURE" \
  -d "$WEBHOOK_PAYLOAD")

log_info "Webhook response: $webhook_response"

# Immediately try manual verification
verify_response=$(verify_payment "$WEBHOOK_REF")
verify_status=$(extract_json "$verify_response" "status")

log_info "Manual verification after webhook: $verify_status"

# Verify tickets weren't duplicated
webhook_tickets=$(db_count_tickets "$WEBHOOK_ORDER_ID")
expected_webhook=$(db_query "SELECT SUM(quantity) FROM order_items WHERE order_id = '$WEBHOOK_ORDER_ID'" | tail -n 1)

assert_equals "$webhook_tickets" "$expected_webhook" "No duplicate tickets from webhook+verification race"
log_success "✓ Webhook race condition handled: $webhook_tickets tickets"

db_delete_order "$WEBHOOK_REF"

# Cleanup first test order
db_delete_order "$TEST_REFERENCE"

echo ""
log_info "Test 6: Database Transaction Integrity"
echo "------------------------------------"

# Create order with multiple items to test transaction atomicity
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "transaction@example.com",
  "firstName": "Trans",
  "lastName": "Action",
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
TRANS_REF=$(extract_nested_json "$response" ".data.reference")
rm "$TEMP_FILE"

TRANS_ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$TRANS_REF'" | tail -n 1 | tr -d ' ')
TRANS_TIER_ID=$(db_query "SELECT ticket_tier_id FROM order_items WHERE order_id = '$TRANS_ORDER_ID'" | tail -n 1 | tr -d ' ')

# Get initial state
initial_order_status=$(db_get_order_status "$TRANS_REF")
initial_tickets=$(db_count_tickets "$TRANS_ORDER_ID")
initial_stock=$(db_query "SELECT available FROM ticket_tiers WHERE id = '$TRANS_TIER_ID'" | tail -n 1)

log_info "Before verification: status=$initial_order_status, tickets=$initial_tickets, stock=$initial_stock"

# Verify
verify_payment "$TRANS_REF" > /dev/null

# Get final state
final_order_status=$(db_get_order_status "$TRANS_REF")
final_tickets=$(db_count_tickets "$TRANS_ORDER_ID")
final_stock=$(db_query "SELECT available FROM ticket_tiers WHERE id = '$TRANS_TIER_ID'" | tail -n 1)

log_info "After verification: status=$final_order_status, tickets=$final_tickets, stock=$final_stock"

# Verify atomic update
assert_equals "$final_order_status" "success" "Order status updated"
assert_equals "$final_tickets" "3" "Tickets created"

expected_final_stock=$((initial_stock - 3))
assert_equals "$final_stock" "$expected_final_stock" "Stock reduced correctly"

# Verify all changes are consistent
if [ "$final_order_status" == "success" ]; then
    if [ $final_tickets -eq 0 ]; then
        log_error "CRITICAL: Order marked success but no tickets created!"
        exit 1
    fi
    if [ $final_stock -eq $initial_stock ]; then
        log_error "CRITICAL: Order marked success but stock not reduced!"
        exit 1
    fi
fi

log_success "✓ Transaction atomicity verified"

db_delete_order "$TRANS_REF"

print_test_summary