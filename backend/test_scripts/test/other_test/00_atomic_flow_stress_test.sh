#!/bin/bash
# backend/test_scripts/test/00_atomic_flow_stress_test.sh
# COMPREHENSIVE ATOMIC FLOW STRESS TEST
# Tests: Order Init → Payment Verify → Ticket Generation (Full Pipeline)

set -euo pipefail

# ============================================================================
# CONFIGURATION & SETUP
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source helpers in correct order (db_helpers first for log functions)
source "$SCRIPT_DIR/helpers/db_helpers.sh"
source "$SCRIPT_DIR/helpers/api_helpers.sh"

# Test Configuration
TEST_NAME="ATOMIC_FLOW_STRESS_TEST"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$SCRIPT_DIR/logs/${TEST_NAME}_${TIMESTAMP}.txt"
RESULTS_FILE="$SCRIPT_DIR/logs/${TEST_NAME}_RESULTS_${TIMESTAMP}.txt"

# Create logs directory
mkdir -p "$SCRIPT_DIR/logs"

# Test Metrics
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
START_TIME=$(date +%s)

# ============================================================================
# LOGGING UTILITIES
# ============================================================================

log_test() {
    local message="$1"
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}▶ $message${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" >> "$LOG_FILE"
}

log_step() {
    local step="$1"
    echo -e "${YELLOW}  → $step${NC}"
    echo "  [STEP] $step" >> "$LOG_FILE"
}

log_result() {
    local test_name="$1"
    local status="$2"
    local details="${3:-}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓ $test_name: PASSED${NC}"
        echo "[PASS] $test_name" >> "$LOG_FILE"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}✗ $test_name: FAILED${NC}"
        echo "[FAIL] $test_name - $details" >> "$LOG_FILE"
        if [ -n "$details" ]; then
            echo -e "${RED}  Details: $details${NC}"
        fi
    fi
}

log_metric() {
    local metric="$1"
    local value="$2"
    echo -e "${BLUE}  📊 $metric: $value${NC}"
    echo "  [METRIC] $metric = $value" >> "$LOG_FILE"
}

# ============================================================================
# TEST DATA SETUP
# ============================================================================

setup_test_data() {
    log_test "SETUP: Preparing Test Environment"
    
    # Generate unique identifiers
    export TEST_GUEST_ID="stress_test_$(date +%s)"
    # ✅ FIX: Use valid TLD (.com, .org, .net) for Paystack validation
    export TEST_EMAIL="stress_test_$(date +%s)@example.com"
    
    log_step "Test Guest ID: $TEST_GUEST_ID"
    log_step "Test Email: $TEST_EMAIL"
    
    # Verify database connection
    if ! db_check_connection; then
        log_error "Database connection failed. Aborting tests."
        exit 1
    fi
    
    # Get baseline stock levels
    export INITIAL_STOCK=$(db_get_stock "027554f8-d41a-4b39-985b-730983cb4c42" "General Admission")
    
    # Validate stock value
    if [ -z "$INITIAL_STOCK" ]; then
        log_error "Could not fetch initial stock. Check database connection and event data."
        exit 1
    fi
    
    log_metric "Initial Stock (General Admission)" "$INITIAL_STOCK"
    
    log_success "Setup completed successfully"
}

# ============================================================================
# ATOMIC FLOW TEST: Happy Path
# ============================================================================

test_atomic_happy_path() {
    log_test "TEST 1: Complete Atomic Flow (Happy Path)"
    
    local test_ref=""
    local order_id=""
    
    # STEP 1: Initialize Order
    log_step "Step 1: Initializing order..."
    
    local order_payload=$(cat <<EOF
{
  "email": "$TEST_EMAIL",
  "firstName": "Atomic",
  "lastName": "Tester",
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
)
    
    local init_response=$(curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=$TEST_GUEST_ID" \
        -d "$order_payload")
    
    echo "$init_response" >> "$LOG_FILE"
    
    test_ref=$(extract_nested_json "$init_response" ".data.reference")
    order_id=$(extract_nested_json "$init_response" ".data.order_id")
    local auth_url=$(extract_nested_json "$init_response" ".data.authorization_url")
    
    if [ -z "$test_ref" ] || [ "$test_ref" = "null" ]; then
        local error_msg=$(extract_json "$init_response" ".message")
        log_result "Order Initialization" "FAIL" "No reference returned. Error: $error_msg"
        return 1
    fi
    
    log_success "Order initialized: $test_ref"
    log_metric "Order ID" "$order_id"
    log_metric "Auth URL Present" "$([ -n "$auth_url" ] && echo 'YES' || echo 'NO')"
    
    # STEP 2: Verify Stock Reduction
    log_step "Step 2: Verifying stock reservation..."
    
    local current_stock=$(db_get_stock "027554f8-d41a-4b39-985b-730983cb4c42" "General Admission")
    local expected_stock=$((INITIAL_STOCK - 2))
    
    if [ "$current_stock" -eq "$expected_stock" ]; then
        log_success "Stock correctly reserved: $current_stock (expected: $expected_stock)"
    else
        log_result "Stock Reservation" "FAIL" "Stock mismatch: got $current_stock, expected $expected_stock"
        return 1
    fi
    
    # STEP 3: Verify Order Status
    log_step "Step 3: Checking order status..."
    
    local order_status=$(db_get_order_status "$test_ref")
    
    if [ "$order_status" = "pending" ]; then
        log_success "Order status: PENDING (correct)"
    else
        log_result "Order Status Check" "FAIL" "Expected PENDING, got $order_status"
        return 1
    fi
    
    # STEP 4: Payment Verification
    log_step "Step 4: Verifying payment..."
    
    sleep 1  # Simulate payment processing delay
    
    local verify_response=$(curl -s -X GET \
        -H "Cookie: guest_id=$TEST_GUEST_ID" \
        "${API_BASE_URL}/api/payments/verify/$test_ref")
    
    echo "$verify_response" >> "$LOG_FILE"
    
    local verify_status=$(extract_json "$verify_response" ".status")
    
    if [ "$verify_status" = "success" ]; then
        log_success "Payment verification successful"
    else
        log_result "Payment Verification" "FAIL" "Verification failed: $verify_status"
        return 1
    fi
    
    # STEP 5: Verify Ticket Generation
    log_step "Step 5: Verifying ticket generation..."
    
    sleep 1  # Allow ticket generation to complete
    
    local ticket_count=$(db_count_tickets "$order_id")
    
    if [ "$ticket_count" -eq 2 ]; then
        log_success "Tickets generated: $ticket_count (expected: 2)"
    else
        log_result "Ticket Generation" "FAIL" "Expected 2 tickets, got $ticket_count"
        return 1
    fi
    
    # STEP 6: Final Order Status Check
    log_step "Step 6: Final status verification..."
    
    local final_status=$(db_get_order_status "$test_ref")
    
    if [ "$final_status" = "success" ]; then
        log_success "Final order status: SUCCESS"
    else
        log_result "Final Status Check" "FAIL" "Expected SUCCESS, got $final_status"
        return 1
    fi
    
    # STEP 7: Stock Consistency Check
    log_step "Step 7: Verifying final stock consistency..."
    
    local final_stock=$(db_get_stock "027554f8-d41a-4b39-985b-730983cb4c42" "General Admission")
    
    if [ "$final_stock" -eq "$expected_stock" ]; then
        log_success "Stock consistent: $final_stock"
    else
        log_result "Stock Consistency" "FAIL" "Stock drift detected: $final_stock vs $expected_stock"
        return 1
    fi
    
    log_result "Atomic Happy Path" "PASS"
    
    # Cleanup
    db_delete_order "$test_ref"
}

# ============================================================================
# IDEMPOTENCY TEST
# ============================================================================

test_idempotency() {
    log_test "TEST 2: Idempotency Under Concurrent Verification"
    
    log_step "Initializing order..."
    
    local order_payload=$(cat <<EOF
{
  "email": "idempotent_$(date +%s)@example.com",
  "firstName": "Idempotent",
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
)
    
    local init_response=$(curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=$TEST_GUEST_ID" \
        -d "$order_payload")
    
    local test_ref=$(extract_nested_json "$init_response" ".data.reference")
    local order_id=$(extract_nested_json "$init_response" ".data.order_id")
    
    if [ -z "$test_ref" ]; then
        log_result "Idempotency Test Setup" "FAIL" "Order creation failed"
        return 1
    fi
    
    log_success "Order created: $test_ref"
    
    log_step "Launching 5 concurrent verification requests..."
    
    # Launch concurrent verifications
    local pids=()
    for i in {1..5}; do
        (
            curl -s -X GET \
                -H "Cookie: guest_id=$TEST_GUEST_ID" \
                "${API_BASE_URL}/api/payments/verify/$test_ref" \
                > "/tmp/verify_${test_ref}_${i}.json"
        ) &
        pids+=($!)
    done
    
    # Wait for all to complete
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
    
    log_step "Analyzing concurrent responses..."
    
    # Check all responses succeeded
    local success_count=0
    for i in {1..5}; do
        local status=$(jq -r '.status' "/tmp/verify_${test_ref}_${i}.json" 2>/dev/null || echo "error")
        if [ "$status" = "success" ]; then
            success_count=$((success_count + 1))
        fi
    done
    
    log_metric "Successful Verifications" "$success_count/5"
    
    # Verify only ONE set of tickets created
    local ticket_count=$(db_count_tickets "$order_id")
    
    if [ "$ticket_count" -eq 1 ]; then
        log_success "Idempotency maintained: Only 1 ticket created"
        log_result "Idempotency Test" "PASS"
    else
        log_result "Idempotency Test" "FAIL" "Duplicate tickets: $ticket_count (expected 1)"
        return 1
    fi
    
    # Cleanup
    rm -f /tmp/verify_${test_ref}_*.json
    db_delete_order "$test_ref"
}

# ============================================================================
# STOCK EXHAUSTION TEST
# ============================================================================

test_stock_exhaustion() {
    log_test "TEST 3: Stock Exhaustion Prevention"
    
    local current_stock=$(db_get_stock "027554f8-d41a-4b39-985b-730983cb4c42" "General Admission")
    local over_request=$((current_stock + 5))
    
    log_step "Current stock: $current_stock"
    log_step "Attempting to order: $over_request"
    
    local order_payload=$(cat <<EOF
{
  "email": "overstock_$(date +%s)@example.com",
  "firstName": "Stock",
  "lastName": "Buster",
  "phone": "+2348012345678",
  "items": [
    {
      "eventId": "027554f8-d41a-4b39-985b-730983cb4c42",
      "tierName": "General Admission",
      "quantity": $over_request
    }
  ]
}
EOF
)
    
    local response=$(curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=$TEST_GUEST_ID" \
        -d "$order_payload")
    
    local status=$(extract_json "$response" ".status")
    local message=$(extract_json "$response" ".message")
    
    if [ "$status" = "error" ] && echo "$message" | grep -qi "stock"; then
        log_success "Stock exhaustion correctly prevented"
        log_result "Stock Exhaustion Test" "PASS"
    else
        log_result "Stock Exhaustion Test" "FAIL" "Overselling allowed: $status - $message"
        return 1
    fi
}

# ============================================================================
# RACE CONDITION TEST: Webhook vs Verification
# ============================================================================

test_webhook_verification_race() {
    log_test "TEST 4: Webhook vs Verification Race Condition"
    
    log_step "Initializing order..."
    
    local order_payload=$(cat <<EOF
{
  "email": "race_$(date +%s)@example.com",
  "firstName": "Race",
  "lastName": "Condition",
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
)
    
    local init_response=$(curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=$TEST_GUEST_ID" \
        -d "$order_payload")
    
    local test_ref=$(extract_nested_json "$init_response" ".data.reference")
    local order_id=$(extract_nested_json "$init_response" ".data.order_id")
    
    if [ -z "$test_ref" ]; then
        log_result "Race Test Setup" "FAIL" "Order creation failed"
        return 1
    fi
    
    log_success "Order created: $test_ref"
    
    # Create webhook payload
    local webhook_payload=$(cat <<EOF
{
  "event": "charge.success",
  "data": {
    "reference": "$test_ref",
    "status": "success",
    "amount": 1053750,
    "paid_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "channel": "card",
    "currency": "NGN",
    "fees": 1500,
    "customer": {
      "email": "race_$(date +%s)@example.com"
    }
  }
}
EOF
)
    
    echo "$webhook_payload" > /tmp/race_webhook.json
    
    log_step "Launching webhook and verification simultaneously..."
    
    # Launch both at the same time
    (
        curl -s -X POST "${API_BASE_URL}/api/webhooks/paystack" \
            -H "Content-Type: application/json" \
            -H "x-paystack-signature: test_signature" \
            -d @/tmp/race_webhook.json \
            > /tmp/webhook_response.json
    ) &
    local webhook_pid=$!
    
    (
        curl -s -X GET \
            -H "Cookie: guest_id=$TEST_GUEST_ID" \
            "${API_BASE_URL}/api/payments/verify/$test_ref" \
            > /tmp/verify_response.json
    ) &
    local verify_pid=$!
    
    wait "$webhook_pid"
    wait "$verify_pid"
    
    sleep 1
    
    # Verify only ONE set of tickets
    local ticket_count=$(db_count_tickets "$order_id")
    
    if [ "$ticket_count" -eq 1 ]; then
        log_success "Race condition handled: Only 1 ticket created"
        log_result "Webhook/Verify Race Test" "PASS"
    else
        log_result "Webhook/Verify Race Test" "FAIL" "Duplicate processing: $ticket_count tickets"
        return 1
    fi
    
    # Cleanup
    rm -f /tmp/race_webhook.json /tmp/webhook_response.json /tmp/verify_response.json
    db_delete_order "$test_ref"
}

# ============================================================================
# PERFORMANCE STRESS TEST
# ============================================================================

test_high_volume_concurrent_orders() {
    log_test "TEST 5: High Volume Concurrent Orders (Stress)"
    
    local concurrent_orders=10
    local orders_created=0
    local orders_failed=0
    
    log_step "Creating $concurrent_orders orders concurrently..."
    
    local start=$(date +%s%3N)
    
    for i in $(seq 1 $concurrent_orders); do
        (
            local order_payload=$(cat <<EOF
{
  "email": "stress_${i}_$(date +%s)@example.com",
  "firstName": "Stress",
  "lastName": "Test$i",
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
)
            
            local response=$(curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
                -H "Content-Type: application/json" \
                -H "Cookie: guest_id=stress_${i}_$TEST_GUEST_ID" \
                -d "$order_payload")
            
            local status=$(extract_json "$response" ".status")
            echo "$status" > "/tmp/stress_order_${i}.status"
        ) &
    done
    
    wait
    
    local end=$(date +%s%3N)
    local duration=$((end - start))
    
    # Count successes
    for i in $(seq 1 $concurrent_orders); do
        local status=$(cat "/tmp/stress_order_${i}.status" 2>/dev/null || echo "error")
        if [ "$status" = "success" ]; then
            orders_created=$((orders_created + 1))
        else
            orders_failed=$((orders_failed + 1))
        fi
    done
    
    log_metric "Orders Created" "$orders_created/$concurrent_orders"
    log_metric "Orders Failed" "$orders_failed"
    log_metric "Duration" "${duration}ms"
    log_metric "Avg Time/Order" "$((duration / concurrent_orders))ms"
    
    if [ "$orders_created" -eq "$concurrent_orders" ]; then
        log_result "High Volume Stress Test" "PASS"
    else
        log_result "High Volume Stress Test" "FAIL" "$orders_failed orders failed"
    fi
    
    # Cleanup
    rm -f /tmp/stress_order_*.status
}

# ============================================================================
# GENERATE FINAL REPORT
# ============================================================================

generate_report() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    
    log_test "TEST SUITE SUMMARY"
    
    echo ""
    echo "═══════════════════════════════════════════════════════" | tee -a "$RESULTS_FILE"
    echo "           ATOMIC FLOW STRESS TEST RESULTS            " | tee -a "$RESULTS_FILE"
    echo "═══════════════════════════════════════════════════════" | tee -a "$RESULTS_FILE"
    echo "" | tee -a "$RESULTS_FILE"
    echo "Timestamp: $(date)" | tee -a "$RESULTS_FILE"
    echo "Duration: ${duration}s" | tee -a "$RESULTS_FILE"
    echo "" | tee -a "$RESULTS_FILE"
    echo "Total Tests: $TOTAL_TESTS" | tee -a "$RESULTS_FILE"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}" | tee -a "$RESULTS_FILE"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}" | tee -a "$RESULTS_FILE"
    echo "" | tee -a "$RESULTS_FILE"
    
    if [ "$FAILED_TESTS" -eq 0 ]; then
        echo -e "${GREEN}✓ ALL TESTS PASSED${NC}" | tee -a "$RESULTS_FILE"
        echo "═══════════════════════════════════════════════════════" | tee -a "$RESULTS_FILE"
        return 0
    else
        echo -e "${RED}✗ SOME TESTS FAILED${NC}" | tee -a "$RESULTS_FILE"
        echo "═══════════════════════════════════════════════════════" | tee -a "$RESULTS_FILE"
        return 1
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo "═══════════════════════════════════════════════════════"
    echo "     ATOMIC PAYMENT FLOW STRESS TEST SUITE"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    echo "Log File: $LOG_FILE"
    echo "Results File: $RESULTS_FILE"
    echo ""
    
    # Initialize
    setup_test_data
    
    # Run test suite
    test_atomic_happy_path || true
    test_idempotency || true
    test_stock_exhaustion || true
    test_webhook_verification_race || true
    test_high_volume_concurrent_orders || true
    
    # Generate report
    generate_report
}

# Run main
main "$@"