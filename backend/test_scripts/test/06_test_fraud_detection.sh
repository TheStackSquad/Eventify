#!/bin/bash
# scripts/test/06_test_fraud_detection.sh
# Test fraud detection and payment amount validation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers/api_helpers.sh"
source "$SCRIPT_DIR/helpers/db_helpers.sh"
source "$SCRIPT_DIR/helpers/assertions.sh"

echo "========================================"
echo "TEST: Fraud Detection & Amount Validation"
echo "========================================"

db_check_connection || exit 1

# Get valid test data
VALID_EVENT_ID=$(db_query "SELECT id FROM events WHERE status = 'published' LIMIT 1" | tail -n 1 | tr -d ' ')
VALID_TIER=$(db_query "SELECT name FROM ticket_tiers WHERE event_id = '$VALID_EVENT_ID' AND available > 5 LIMIT 1" | tail -n 1 | tr -d ' ')

echo ""
log_info "Test 1: Amount Mismatch Detection"
echo "------------------------------------"

# Create order
response=$(create_test_order "fraud@example.com" "$VALID_EVENT_ID" "$VALID_TIER" "2")
REFERENCE=$(extract_nested_json "$response" ".data.reference")

if [ -z "$REFERENCE" ] || [ "$REFERENCE" == "null" ]; then
    log_error "Failed to create test order"
    exit 1
fi

ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$REFERENCE'" | tail -n 1 | tr -d ' ')
EXPECTED_TOTAL=$(db_query "SELECT final_total FROM orders WHERE reference = '$REFERENCE'" | tail -n 1)

log_info "Order: $REFERENCE"
log_info "Expected total: $EXPECTED_TOTAL kobo"

# Simulate webhook with WRONG amount (less than expected)
WRONG_AMOUNT=$((EXPECTED_TOTAL - 1000))
log_info "Attempting webhook with wrong amount: $WRONG_AMOUNT kobo"

webhook_payload=$(cat <<EOF
{
  "event": "charge.success",
  "data": {
    "reference": "$REFERENCE",
    "amount": $WRONG_AMOUNT,
    "status": "success",
    "paid_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
    "channel": "card",
    "customer": {
      "email": "fraud@example.com"
    }
  }
}
EOF
)

# Calculate signature
SIGNATURE=$(echo -n "$webhook_payload" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" | awk '{print $2}')

# Send webhook with wrong amount
webhook_response=$(curl -s -X POST "$API_BASE_URL/api/webhooks/paystack" \
    -H "Content-Type: application/json" \
    -H "x-paystack-signature: $SIGNATURE" \
    -d "$webhook_payload")

log_info "Webhook response: $webhook_response"

# Wait for processing
sleep 1

# Check order status should be fraud
order_status=$(db_get_order_status "$REFERENCE")
log_info "Order status after mismatch: $order_status"

# Depending on your implementation, this might be 'fraud' or 'failed'
if [ "$order_status" == "fraud" ] || [ "$order_status" == "failed" ]; then
    log_success "✓ Order correctly rejected for amount mismatch"
else
    log_warning "Order status is: $order_status (expected fraud or failed)"
fi

# Verify no tickets created
ticket_count=$(db_count_tickets "$ORDER_ID")
assert_equals "$ticket_count" "0" "No tickets should be created for fraudulent payment"

log_success "✓ Fraud detection verified"

db_delete_order "$REFERENCE"

echo ""
log_info "Test 2: Overpayment Scenario"
echo "------------------------------------"

# Create new order
response=$(create_test_order "overpay@example.com" "$VALID_EVENT_ID" "$VALID_TIER" "1")
OVERPAY_REF=$(extract_nested_json "$response" ".data.reference")
OVERPAY_ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$OVERPAY_REF'" | tail -n 1 | tr -d ' ')
EXPECTED_AMOUNT=$(db_query "SELECT final_total FROM orders WHERE reference = '$OVERPAY_REF'" | tail -n 1)

# Send webhook with MORE than expected (user paid extra)
EXTRA_AMOUNT=$((EXPECTED_AMOUNT + 5000))
log_info "Expected: $EXPECTED_AMOUNT, Sent: $EXTRA_AMOUNT (overpayment)"

overpay_payload=$(cat <<EOF
{
  "event": "charge.success",
  "data": {
    "reference": "$OVERPAY_REF",
    "amount": $EXTRA_AMOUNT,
    "status": "success",
    "paid_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
    "channel": "card",
    "customer": {
      "email": "overpay@example.com"
    }
  }
}
EOF
)

OVERPAY_SIG=$(echo -n "$overpay_payload" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" | awk '{print $2}')

curl -s -X POST "$API_BASE_URL/api/webhooks/paystack" \
    -H "Content-Type: application/json" \
    -H "x-paystack-signature: $OVERPAY_SIG" \
    -d "$overpay_payload" > /dev/null

sleep 1

overpay_status=$(db_get_order_status "$OVERPAY_REF")
log_info "Order status with overpayment: $overpay_status"

# Overpayment might be accepted (user paid more than required)
# Your business logic determines if this should succeed or flag for review
if [ "$overpay_status" == "success" ]; then
    log_success "✓ Overpayment accepted (user paid more)"
    
    # Verify tickets still created
    overpay_tickets=$(db_count_tickets "$OVERPAY_ORDER_ID")
    assert_not_equals "$overpay_tickets" "0" "Tickets should be created for overpayment"
elif [ "$overpay_status" == "fraud" ]; then
    log_warning "⚠ Overpayment flagged as fraud (strict validation)"
else
    log_info "ℹ️  Overpayment status: $overpay_status"
fi

db_delete_order "$OVERPAY_REF"

echo ""
log_info "Test 3: Exact Amount Match (Valid Payment)"
echo "------------------------------------"

# Create order
response=$(create_test_order "valid@example.com" "$VALID_EVENT_ID" "$VALID_TIER" "1")
VALID_REF=$(extract_nested_json "$response" ".data.reference")
VALID_ORDER_ID=$(db_query "SELECT id FROM orders WHERE reference = '$VALID_REF'" | tail -n 1 | tr -d ' ')
EXACT_AMOUNT=$(db_query "SELECT final_total FROM orders WHERE reference = '$VALID_REF'" | tail -n 1)

log_info "Sending webhook with EXACT amount: $EXACT_AMOUNT"

valid_payload=$(cat <<EOF
{
  "event": "charge.success",
  "data": {
    "reference": "$VALID_REF",
    "amount": $EXACT_AMOUNT,
    "status": "success",
    "paid_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
    "channel": "card",
    "customer": {
      "email": "valid@example.com"
    }
  }
}
EOF
)

VALID_SIG=$(echo -n "$valid_payload" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" | awk '{print $2}')

curl -s -X POST "$API_BASE_URL/api/webhooks/paystack" \
    -H "Content-Type: application/json" \
    -H "x-paystack-signature: $VALID_SIG" \
    -d "$valid_payload" > /dev/null

sleep 1

valid_status=$(db_get_order_status "$VALID_REF")
assert_equals "$valid_status" "success" "Exact amount should succeed"

valid_tickets=$(db_count_tickets "$VALID_ORDER_ID")
assert_not_equals "$valid_tickets" "0" "Tickets should be created for valid payment"

log_success "✓ Exact amount payment processed correctly"

db_delete_order "$VALID_REF"

echo ""
log_info "Test 4: Currency Mismatch (If Implemented)"
echo "------------------------------------"

# If your system validates currency
response=$(create_test_order "currency@example.com" "$VALID_EVENT_ID" "$VALID_TIER" "1")
CURRENCY_REF=$(extract_nested_json "$response" ".data.reference")
CURRENCY_AMOUNT=$(db_query "SELECT final_total FROM orders WHERE reference = '$CURRENCY_REF'" | tail -n 1)

# Send webhook with wrong currency
currency_payload=$(cat <<EOF
{
  "event": "charge.success",
  "data": {
    "reference": "$CURRENCY_REF",
    "amount": $CURRENCY_AMOUNT,
    "currency": "USD",
    "status": "success",
    "paid_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
    "channel": "card",
    "customer": {
      "email": "currency@example.com"
    }
  }
}
EOF
)

CURRENCY_SIG=$(echo -n "$currency_payload" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" | awk '{print $2}')

curl -s -X POST "$API_BASE_URL/api/webhooks/paystack" \
    -H "Content-Type: application/json" \
    -H "x-paystack-signature: $CURRENCY_SIG" \
    -d "$currency_payload" > /dev/null

sleep 1

currency_status=$(db_get_order_status "$CURRENCY_REF")
log_info "Order status with wrong currency: $currency_status"

# Your implementation may or may not validate currency
if [ "$currency_status" == "fraud" ] || [ "$currency_status" == "failed" ]; then
    log_success "✓ Currency validation enforced"
else
    log_warning "⚠ Currency validation not enforced (might be acceptable)"
fi

db_delete_order "$CURRENCY_REF"

echo ""
log_info "Test 5: Fraud Flag Persistence"
echo "------------------------------------"

# Create order that will be marked as fraud
response=$(create_test_order "persist@example.com" "$VALID_EVENT_ID" "$VALID_TIER" "1")
PERSIST_REF=$(extract_nested_json "$response" ".data.reference")
PERSIST_AMOUNT=$(db_query "SELECT final_total FROM orders WHERE reference = '$PERSIST_REF'" | tail -n 1)

# Send fraud webhook (wrong amount)
FRAUD_AMOUNT=$((PERSIST_AMOUNT - 500))

fraud_payload=$(cat <<EOF
{
  "event": "charge.success",
  "data": {
    "reference": "$PERSIST_REF",
    "amount": $FRAUD_AMOUNT,
    "status": "success",
    "paid_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
    "channel": "card",
    "customer": {
      "email": "persist@example.com"
    }
  }
}
EOF
)

FRAUD_SIG=$(echo -n "$fraud_payload" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" | awk '{print $2}')

curl -s -X POST "$API_BASE_URL/api/webhooks/paystack" \
    -H "Content-Type: application/json" \
    -H "x-paystack-signature: $FRAUD_SIG" \
    -d "$fraud_payload" > /dev/null

sleep 1

# Try to verify manually - should still be rejected
manual_verify=$(verify_payment "$PERSIST_REF")
manual_status=$(extract_json "$manual_verify" "status")

log_info "Manual verification after fraud: $manual_status"

# Order should remain in fraud/failed state
persist_status=$(db_get_order_status "$PERSIST_REF")
if [ "$persist_status" == "fraud" ] || [ "$persist_status" == "failed" ]; then
    log_success "✓ Fraud flag persists, cannot be verified manually"
else
    log_warning "⚠ Order status: $persist_status (fraud flag may not persist)"
fi

db_delete_order "$PERSIST_REF"

print_test_summary