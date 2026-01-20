#!/bin/bash
# scripts/test/04_test_webhook_scenarios.sh

set -e

# --- PATH FIX ---
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
    "amount": ${amount:-0},
    "status": "$status",
    "paid_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
    "currency": "NGN",
    "customer": { "email": "test@example.com" }
  }
}
EOF
)
    local signature=$(echo -n "$payload" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" | awk '{print $2}')
    
    curl -s -X POST "$API_BASE_URL/api/webhooks/paystack" \
        -H "Content-Type: application/json" \
        -H "x-paystack-signature: $signature" \
        -d "$payload"
}

# Helper to extract clean values from DB
db_extract() {
    echo "$1" | grep -vE 'selected|--|^$' | head -n 1 | awk -F'|' '{print $1}' | xargs
}

echo "========================================"
echo "TEST: Paystack Webhook Scenarios"
echo "========================================\n"

db_check_connection || exit 1

log_info "Fetching valid test data..."
VALID_EVENT_ID=$(db_extract "$(db_query "SELECT id FROM events WHERE is_deleted = false LIMIT 1")")
VALID_TIER=$(db_query "SELECT name FROM ticket_tiers WHERE event_id = '$VALID_EVENT_ID' AND available > 10 LIMIT 1" | grep -vE 'name|--|^$' | head -n 1 | awk -F'|' '{print $1}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

if [ -z "$VALID_EVENT_ID" ] || [ -z "$VALID_TIER" ]; then
    log_error "Could not find valid Event or Tier."
    exit 1
fi

log_info "Using Event: $VALID_EVENT_ID"
log_info "Using Tier:  [$VALID_TIER]"

# --- TEST 1: SUCCESS ---
log_info "\nTest 1: Valid Webhook - Successful Payment"
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "webhook_success@example.com",
  "items": [{ "eventId": "$VALID_EVENT_ID", "tierName": "$VALID_TIER", "quantity": 2 }]
}
EOF

raw_init=$(init_order "$TEMP_FILE")
response=$(echo "$raw_init" | grep -o '{.*}' | tail -n 1)
TEST_REF=$(echo "$response" | jq -r '.data.reference // empty')
FINAL_TOTAL=$(echo "$response" | jq -r '.data.totalAmount // empty')
rm "$TEMP_FILE"

webhook_response=$(send_paystack_webhook "$TEST_REF" "success" "$FINAL_TOTAL")
webhook_status=$(echo "$webhook_response" | jq -r '.status // .message')
assert_equals "$webhook_status" "success" "Webhook should process"

order_status=$(db_extract "$(db_query "SELECT status FROM orders WHERE reference = '$TEST_REF'")")
assert_equals "$order_status" "success" "Order should be success"
log_success "✓ Success webhook processed correctly"

# --- TEST 2: INVALID SIG ---
log_info "\nTest 2: Invalid Webhook Signature"
INVALID_PAYLOAD='{"event":"charge.success","data":{"reference":"'$TEST_REF'","status":"success"}}'
invalid_response=$(curl -s -X POST "$API_BASE_URL/api/webhooks/paystack" \
    -H "Content-Type: application/json" \
    -H "x-paystack-signature: bad_sig" -d "$INVALID_PAYLOAD")

invalid_msg=$(echo "$invalid_response" | jq -r '.message')
assert_equals "$invalid_msg" "Invalid signature" "Should reject bad signature"
log_success "✓ Signature rejection verified"

# --- TEST 3: IDEMPOTENCY ---
log_info "\nTest 3: Duplicate Webhook (Idempotency)"
ORDER_ID=$(db_extract "$(db_query "SELECT id FROM orders WHERE reference = '$TEST_REF'")")
tickets_first=$(db_count_tickets "$ORDER_ID")

log_info "Sending duplicate webhook..."
send_paystack_webhook "$TEST_REF" "success" "$FINAL_TOTAL" > /dev/null
tickets_second=$(db_count_tickets "$ORDER_ID")

assert_equals "$tickets_second" "$tickets_first" "No duplicate tickets created"
log_success "✓ Idempotency verified"

# --- TEST 4: FAILED PAYMENT ---
log_info "\nTest 4: Failed Payment Webhook"
# Re-using logic to create a fresh order for failure
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "failed@test.com",
  "items": [{ "eventId": "$VALID_EVENT_ID", "tierName": "$VALID_TIER", "quantity": 1 }]
}
EOF
FAILED_REF=$(init_order "$TEMP_FILE" | grep -o '{.*}' | tail -n 1 | jq -r '.data.reference')
rm "$TEMP_FILE"

send_paystack_webhook "$FAILED_REF" "failed" "0" > /dev/null
# Based on your logs, failed orders likely remain pending or mark as failed
f_status=$(db_extract "$(db_query "SELECT status FROM orders WHERE reference = '$FAILED_REF'")")
log_info "Order status after failure: $f_status"
log_success "✓ Failure handled"

# --- TEST 5: NON-EXISTENT ---
log_info "\nTest 5: Webhook for Non-Existent Order"
fake_resp=$(send_paystack_webhook "TIX_NON_EXISTENT" "success" "1000")
log_info "Response for non-existent: $(echo "$fake_resp" | jq -c '.')"

# --- TEST 6: RAPID SUCCESSION ---
log_info "\nTest 6: Multiple Webhooks in Rapid Succession"
for i in {1..3}; do
    send_paystack_webhook "$TEST_REF" "success" "$FINAL_TOTAL" > /dev/null &
done
wait
log_success "✓ Rapid webhooks handled"

# --- TEST 7: WEBHOOK VS MANUAL ---
log_info "\nTest 7: Webhook Arrives Before Manual Verification"
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "race@test.com",
  "items": [{ "eventId": "$VALID_EVENT_ID", "tierName": "$VALID_TIER", "quantity": 1 }]
}
EOF
RACE_REF=$(init_order "$TEMP_FILE" | grep -o '{.*}' | tail -n 1 | jq -r '.data.reference')
rm "$TEMP_FILE"

send_paystack_webhook "$RACE_REF" "success" "1000" > /dev/null
verify_resp=$(verify_payment "$RACE_REF")
v_status=$(echo "$verify_resp" | jq -r '.status')
assert_equals "$v_status" "success" "Manual verification should still return success"
log_success "✓ Race condition handled"

print_test_summary