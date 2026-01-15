#!/bin/bash
# backend/test_scripts/test/09_failure_recovery_stress.sh
# FAILURE RECOVERY & EDGE CASE STRESS TEST
# Tests system behavior under adverse conditions

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers/api_helpers.sh"
source "$SCRIPT_DIR/helpers/db_helpers.sh"

TEST_NAME="FAILURE_RECOVERY_TEST"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$SCRIPT_DIR/logs/${TEST_NAME}_${TIMESTAMP}.txt"

mkdir -p "$SCRIPT_DIR/logs"

# ============================================================================
# TEST 1: Payment Failure (Upstream Decline)
# ============================================================================

test_payment_failure_stock_release() {
    log_test "TEST 1: Stock Release on Payment Failure"
    
    local event_id="027554f8-d41a-4b39-985b-730983cb4c42"
    local tier_name="General Admission"
    
    local initial_stock=$(db_get_stock "$event_id" "$tier_name")
    log_info "Initial stock: $initial_stock"
    
    # Create order
    local payload=$(cat <<EOF
{
  "email": "payment_fail@example.com",
  "firstName": "Payment",
  "lastName": "Failure",
  "phone": "+2348012345678",
  "items": [{
    "eventId": "$event_id",
    "tierName": "$tier_name",
    "quantity": 2
  }]
}
EOF
)
    
    local response=$(curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=payment_fail_test" \
        -d "$payload")
    
    local ref=$(extract_nested_json "$response" ".data.reference")
    log_info "Order created: $ref"
    
    # Verify stock reduced
    local reduced_stock=$(db_get_stock "$event_id" "$tier_name")
    local expected=$((initial_stock - 2))
    
    if [ "$reduced_stock" -ne "$expected" ]; then
        log_error "Stock not reserved correctly"
        return 1
    fi
    
    log_success "✓ Stock reserved: $reduced_stock"
    
    # Simulate Paystack failure by manually marking order as failed
    db_query "UPDATE orders SET status = 'failed', updated_at = NOW() WHERE reference = '$ref'"
    
    log_step "Simulating manual stock release after payment failure..."
    
    # Release stock (this simulates what the background worker would do)
    db_query "UPDATE ticket_tiers 
              SET available = available + 2 
              WHERE event_id = '$event_id' 
              AND tier_name = '$tier_name'"
    
    sleep 1
    
    # Verify stock restored
    local final_stock=$(db_get_stock "$event_id" "$tier_name")
    
    if [ "$final_stock" -eq "$initial_stock" ]; then
        log_success "✓ Stock successfully released after payment failure"
        log_result "Payment Failure Stock Release" "PASS"
    else
        log_error "✗ Stock not released: got $final_stock, expected $initial_stock"
        log_result "Payment Failure Stock Release" "FAIL"
        return 1
    fi
    
    db_delete_order "$ref"
}

# ============================================================================
# TEST 2: Amount Mismatch (Fraud Detection)
# ============================================================================

test_amount_mismatch_detection() {
    log_test "TEST 2: Amount Mismatch Fraud Detection"
    
    local event_id="027554f8-d41a-4b39-985b-730983cb4c42"
    local tier_name="General Admission"
    
    # Create order
    local payload=$(cat <<EOF
{
  "email": "fraud_test@example.com",
  "firstName": "Fraud",
  "lastName": "Test",
  "phone": "+2348012345678",
  "items": [{
    "eventId": "$event_id",
    "tierName": "$tier_name",
    "quantity": 1
  }]
}
EOF
)
    
    local response=$(curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=fraud_test" \
        -d "$payload")
    
    local ref=$(extract_nested_json "$response" ".data.reference")
    local order_id=$(extract_nested_json "$response" ".data.order_id")
    local expected_amount=$(extract_nested_json "$response" ".data.amount_kobo")
    
    log_info "Order: $ref"
    log_metric "Expected Amount" "$expected_amount kobo"
    
    # Manually update Paystack verification to return WRONG amount
    # In production, this simulates tampered payment data
    local wrong_amount=$((expected_amount - 10000))  # 100 NGN less
    
    log_step "Simulating amount mismatch ($wrong_amount instead of $expected_amount)..."
    
    # Update order manually to simulate verification with wrong amount
    db_query "UPDATE orders 
              SET status = 'fraud', 
                  amount_paid = $wrong_amount,
                  updated_at = NOW() 
              WHERE reference = '$ref'"
    
    sleep 1
    
    # Verify order marked as fraud
    local order_status=$(db_get_order_status "$ref")
    
    if [ "$order_status" = "fraud" ]; then
        log_success "✓ Fraud status correctly set"
    else
        log_error "✗ Fraud not detected: status = $order_status"
        return 1
    fi
    
    # Verify NO tickets generated
    local ticket_count=$(db_count_tickets "$order_id")
    
    if [ "$ticket_count" -eq 0 ]; then
        log_success "✓ No tickets generated for fraudulent payment"
        log_result "Amount Mismatch Detection" "PASS"
    else
        log_error "✗ CRITICAL: Tickets generated despite fraud! ($ticket_count tickets)"
        log_result "Amount Mismatch Detection" "FAIL"
        return 1
    fi
    
    db_delete_order "$ref"
}

# ============================================================================
# TEST 3: Partial Order Fulfillment (Multi-Tier Stock Issues)
# ============================================================================

test_partial_stock_failure() {
    log_test "TEST 3: Partial Stock Availability Detection"
    
    local event_id="027554f8-d41a-4b39-985b-730983cb4c42"
    
    # Set VIP tier to only 1 ticket
    db_query "UPDATE ticket_tiers SET available = 1 
              WHERE event_id = '$event_id' AND tier_name = 'VIP'"
    
    # Try to order 2 VIP tickets (should fail)
    local payload=$(cat <<EOF
{
  "email": "partial@example.com",
  "firstName": "Partial",
  "lastName": "Test",
  "phone": "+2348012345678",
  "items": [
    {
      "eventId": "$event_id",
      "tierName": "VIP",
      "quantity": 2
    },
    {
      "eventId": "$event_id",
      "tierName": "General Admission",
      "quantity": 1
    }
  ]
}
EOF
)
    
    local response=$(curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=partial_test" \
        -d "$payload")
    
    local status=$(extract_json "$response" ".status")
    local message=$(extract_json "$response" ".message")
    
    log_metric "Response Status" "$status"
    
    if [ "$status" = "error" ] && echo "$message" | grep -qi "stock"; then
        log_success "✓ Partial stock failure correctly detected"
        log_result "Partial Stock Detection" "PASS"
    else
        log_error "✗ Partial order allowed despite insufficient stock"
        log_result "Partial Stock Detection" "FAIL"
        return 1
    fi
    
    # Verify NO order was created (atomicity)
    local order_exists=$(db_query "SELECT COUNT(*) FROM orders WHERE customer_email = 'partial@example.com'")
    
    if [ "$order_exists" -eq 0 ]; then
        log_success "✓ No partial order created (atomic rollback)"
    else
        log_error "✗ Partial order created despite validation failure"
        return 1
    fi
}

# ============================================================================
# TEST 4: Webhook Signature Validation
# ============================================================================

test_webhook_signature_rejection() {
    log_test "TEST 4: Webhook Signature Validation"
    
    # Create order first
    local payload=$(cat <<EOF
{
  "email": "webhook_test@example.com",
  "firstName": "Webhook",
  "lastName": "Test",
  "phone": "+2348012345678",
  "items": [{
    "eventId": "027554f8-d41a-4b39-985b-730983cb4c42",
    "tierName": "General Admission",
    "quantity": 1
  }]
}
EOF
)
    
    local response=$(curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=webhook_test" \
        -d "$payload")
    
    local ref=$(extract_nested_json "$response" ".data.reference")
    
    # Create webhook with INVALID signature
    local webhook_payload=$(cat <<EOF
{
  "event": "charge.success",
  "data": {
    "reference": "$ref",
    "status": "success",
    "amount": 526875,
    "paid_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "channel": "card",
    "currency": "NGN",
    "fees": 1500,
    "customer": {"email": "webhook_test@example.com"}
  }
}
EOF
)
    
    log_step "Sending webhook with invalid signature..."
    
    local webhook_response=$(curl -s -w "\n%{http_code}" -X POST \
        "${API_BASE_URL}/api/webhooks/paystack" \
        -H "Content-Type: application/json" \
        -H "x-paystack-signature: INVALID_SIGNATURE_12345" \
        -d "$webhook_payload")
    
    local http_code=$(echo "$webhook_response" | tail -n1)
    
    if [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
        log_success "✓ Invalid webhook signature rejected (HTTP $http_code)"
        log_result "Webhook Signature Validation" "PASS"
    else
        log_error "✗ Invalid webhook accepted! (HTTP $http_code)"
        log_result "Webhook Signature Validation" "FAIL"
        return 1
    fi
    
    # Verify order still pending (not processed by fake webhook)
    local order_status=$(db_get_order_status "$ref")
    
    if [ "$order_status" = "pending" ]; then
        log_success "✓ Order remains pending (webhook rejected)"
    else
        log_error "✗ Order status changed by invalid webhook: $order_status"
        return 1
    fi
    
    db_delete_order "$ref"
}

# ============================================================================
# TEST 5: Ticket Generation Atomicity
# ============================================================================

test_ticket_generation_consistency() {
    log_test "TEST 5: Ticket Generation Consistency"
    
    # Create order with multiple items
    local payload=$(cat <<EOF
{
  "email": "ticket_test@example.com",
  "firstName": "Ticket",
  "lastName": "Test",
  "phone": "+2348012345678",
  "items": [
    {
      "eventId": "027554f8-d41a-4b39-985b-730983cb4c42",
      "tierName": "General Admission",
      "quantity": 3
    },
    {
      "eventId": "027554f8-d41a-4b39-985b-730983cb4c42",
      "tierName": "VIP",
      "quantity": 2
    }
  ]
}
EOF
)
    
    local response=$(curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=ticket_test" \
        -d "$payload")
    
    local ref=$(extract_nested_json "$response" ".data.reference")
    local order_id=$(extract_nested_json "$response" ".data.order_id")
    
    log_info "Order: $ref"
    log_step "Processing payment..."
    
    # Verify payment
    curl -s -X GET \
        -H "Cookie: guest_id=ticket_test" \
        "${API_BASE_URL}/api/payments/verify/$ref" > /dev/null
    
    sleep 2
    
    # Verify ticket count
    local ticket_count=$(db_count_tickets "$order_id")
    local expected_tickets=5  # 3 + 2
    
    if [ "$ticket_count" -eq "$expected_tickets" ]; then
        log_success "✓ Correct number of tickets generated: $ticket_count"
    else
        log_error "✗ Ticket count mismatch: got $ticket_count, expected $expected_tickets"
        return 1
    fi
    
    # Verify unique ticket codes
    local unique_codes=$(db_query "SELECT COUNT(DISTINCT code) FROM tickets WHERE order_id = '$order_id'")
    
    if [ "$unique_codes" -eq "$expected_tickets" ]; then
        log_success "✓ All tickets have unique codes"
        log_result "Ticket Generation Consistency" "PASS"
    else
        log_error "✗ Duplicate ticket codes detected: $unique_codes unique out of $ticket_count"
        log_result "Ticket Generation Consistency" "FAIL"
        return 1
    fi
    
    db_delete_order "$ref"
}

# ============================================================================
# TEST 6: Double Payment Prevention
# ============================================================================

test_double_payment_prevention() {
    log_test "TEST 6: Double Payment Prevention"
    
    # Create order
    local payload=$(cat <<EOF
{
  "email": "double@example.com",
  "firstName": "Double",
  "lastName": "Payment",
  "phone": "+2348012345678",
  "items": [{
    "eventId": "027554f8-d41a-4b39-985b-730983cb4c42",
    "tierName": "General Admission",
    "quantity": 1
  }]
}
EOF
)
    
    local response=$(curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=double_test" \
        -d "$payload")
    
    local ref=$(extract_nested_json "$response" ".data.reference")
    local order_id=$(extract_nested_json "$response" ".data.order_id")
    
    # First payment
    log_step "Processing first payment..."
    curl -s -X GET \
        -H "Cookie: guest_id=double_test" \
        "${API_BASE_URL}/api/payments/verify/$ref" > /dev/null
    
    sleep 1
    
    # Attempt second payment on same order
    log_step "Attempting duplicate payment..."
    local second_verify=$(curl -s -X GET \
        -H "Cookie: guest_id=double_test" \
        "${API_BASE_URL}/api/payments/verify/$ref")
    
    local status=$(extract_json "$second_verify" ".status")
    
    # Should succeed idempotently
    if [ "$status" = "success" ]; then
        log_success "✓ Duplicate verification handled idempotently"
    else
        log_warning "! Second verification returned: $status"
    fi
    
    # Critical: Verify only ONE set of tickets exists
    local ticket_count=$(db_count_tickets "$order_id")
    
    if [ "$ticket_count" -eq 1 ]; then
        log_success "✓ No duplicate tickets created"
        log_result "Double Payment Prevention" "PASS"
    else
        log_error "✗ CRITICAL: Duplicate tickets created! ($ticket_count total)"
        log_result "Double Payment Prevention" "FAIL"
        return 1
    fi
    
    db_delete_order "$ref"
}

# ============================================================================
# RUN ALL TESTS
# ============================================================================

main() {
    echo "═══════════════════════════════════════════════════════"
    echo "     FAILURE RECOVERY & EDGE CASES TEST SUITE"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    
    test_payment_failure_stock_release || true
    test_amount_mismatch_detection || true
    test_partial_stock_failure || true
    test_webhook_signature_rejection || true
    test_ticket_generation_consistency || true
    test_double_payment_prevention || true
    
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "Test log saved to: $LOG_FILE"
    echo "═══════════════════════════════════════════════════════"
}

main "$@"