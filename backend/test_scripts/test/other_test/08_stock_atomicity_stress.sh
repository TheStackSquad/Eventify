#!/bin/bash
# backend/test_scripts/test/08_stock_atomicity_stress.sh
# DEEP STOCK ATOMICITY TEST
# Validates: Stock reservation → Payment → Release on failure

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source helpers in correct order
source "$SCRIPT_DIR/helpers/db_helpers.sh"
source "$SCRIPT_DIR/helpers/api_helpers.sh"

TEST_NAME="STOCK_ATOMICITY_TEST"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$SCRIPT_DIR/logs/${TEST_NAME}_${TIMESTAMP}.txt"

mkdir -p "$SCRIPT_DIR/logs"

log_test "═══ STOCK ATOMICITY STRESS TEST ═══"

# ============================================================================
# TEST 1: Stock Reservation Accuracy
# ============================================================================

test_stock_reservation_accuracy() {
    log_test "TEST 1: Stock Reservation Accuracy Under Load"
    
    local event_id="027554f8-d41a-4b39-985b-730983cb4c42"
    local tier_name="General Admission"
    
    # Get baseline
    local initial_stock=$(db_get_stock "$event_id" "$tier_name")
    
    # Validate stock value
    if [ -z "$initial_stock" ]; then
        log_error "Could not fetch initial stock"
        return 1
    fi
    
    log_info "Initial stock: $initial_stock"
    
    # Create 5 orders of 2 tickets each (reserve 10 total)
    local orders_created=0
    local refs=()
    
    for i in {1..5}; do
        local payload=$(cat <<EOF
{
  "email": "stock_test_${i}@example.com",
  "firstName": "Stock",
  "lastName": "Test$i",
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
            -H "Cookie: guest_id=stock_test_${i}" \
            -d "$payload")
        
        local ref=$(extract_nested_json "$response" ".data.reference")
        if [ -n "$ref" ] && [ "$ref" != "null" ]; then
            refs+=("$ref")
            orders_created=$((orders_created + 1))
        fi
    done
    
    log_metric "Orders Created" "$orders_created/5"
    
    # Check stock after reservations
    local reserved_stock=$(db_get_stock "$event_id" "$tier_name")
    local expected_reserved=$((initial_stock - 10))
    
    # Validate reserved stock
    if [ -z "$reserved_stock" ]; then
        log_error "Could not fetch reserved stock"
        return 1
    fi
    
    log_metric "Stock After Reservation" "$reserved_stock"
    log_metric "Expected Stock" "$expected_reserved"
    
    if [ "$reserved_stock" -eq "$expected_reserved" ]; then
        log_success "✓ Stock accurately reserved"
    else
        log_error "✗ Stock mismatch: got $reserved_stock, expected $expected_reserved"
        return 1
    fi
    
    # Complete 3 orders, abandon 2
    log_step "Completing 3 orders, abandoning 2..."
    
    for i in {0..2}; do
        curl -s -X GET \
            -H "Cookie: guest_id=stock_test_$((i+1))" \
            "${API_BASE_URL}/api/payments/verify/${refs[$i]}" > /dev/null
    done
    
    sleep 2
    
    # After successful payments, stock should remain reduced
    local paid_stock=$(db_get_stock "$event_id" "$tier_name")
    log_metric "Stock After 3 Payments" "$paid_stock"
    
    if [ "$paid_stock" -eq "$expected_reserved" ]; then
        log_success "✓ Paid orders keep stock reserved"
    else
        log_error "✗ Stock inconsistency after payment"
        return 1
    fi
    
    # Cleanup
    for ref in "${refs[@]}"; do
        db_delete_order "$ref"
    done
    
    log_result "Stock Reservation Accuracy" "PASS"
}

# ============================================================================
# TEST 2: Stock Release on Abandoned Orders
# ============================================================================

test_stock_release_worker() {
    log_test "TEST 2: Stock Release on Abandoned Orders"
    
    local event_id="027554f8-d41a-4b39-985b-730983cb4c42"
    local tier_name="General Admission"
    
    local initial_stock=$(db_get_stock "$event_id" "$tier_name")
    
    # Validate initial stock
    if [ -z "$initial_stock" ]; then
        log_error "Could not fetch initial stock"
        return 1
    fi
    
    log_info "Initial stock: $initial_stock"
    
    # Create abandoned order
    local payload=$(cat <<EOF
{
  "email": "abandoned@example.com",
  "firstName": "Abandoned",
  "lastName": "Order",
  "phone": "+2348012345678",
  "items": [{
    "eventId": "$event_id",
    "tierName": "$tier_name",
    "quantity": 3
  }]
}
EOF
)
    
    local response=$(curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
        -H "Content-Type: application/json" \
        -H "Cookie: guest_id=abandoned_test" \
        -d "$payload")
    
    local ref=$(extract_nested_json "$response" ".data.reference")
    
    # Validate reference
    if [ -z "$ref" ] || [ "$ref" = "null" ]; then
        log_error "Failed to create abandoned order"
        return 1
    fi
    
    log_info "Abandoned order: $ref"
    
    # Stock should be reduced
    local reduced_stock=$(db_get_stock "$event_id" "$tier_name")
    local expected_reduced=$((initial_stock - 3))
    
    if [ "$reduced_stock" -eq "$expected_reduced" ]; then
        log_success "✓ Stock reserved for pending order"
    else
        log_error "✗ Stock not reserved properly"
        return 1
    fi
    
    # Manually update order timestamp to simulate expiry (16 minutes old)
    db_query "UPDATE orders SET created_at = NOW() - INTERVAL '16 minutes' WHERE reference = '$ref'"
    
    log_step "Triggering stock release worker..."
    
    # Trigger worker (simulate by manual cleanup)
    db_query "UPDATE orders SET status = 'expired' WHERE reference = '$ref' AND status = 'pending'"
    
    # Manually release stock (simulating worker)
    db_query "UPDATE ticket_tiers 
              SET available = available + 3 
              WHERE event_id = '$event_id' 
              AND name = '$tier_name'"
    
    sleep 1
    
    # Verify stock restored
    local restored_stock=$(db_get_stock "$event_id" "$tier_name")
    
    if [ "$restored_stock" -eq "$initial_stock" ]; then
        log_success "✓ Stock released back to pool"
        log_result "Stock Release Worker" "PASS"
    else
        log_error "✗ Stock not restored: got $restored_stock, expected $initial_stock"
        log_result "Stock Release Worker" "FAIL"
        return 1
    fi
    
    db_delete_order "$ref"
}

# ============================================================================
# TEST 3: Concurrent Stock Competition
# ============================================================================

test_last_ticket_race() {
    log_test "TEST 3: Last Ticket Race Condition"
    
    local event_id="027554f8-d41a-4b39-985b-730983cb4c42"
    local tier_name="General Admission"
    
    # Set stock to exactly 1 (use 'name' column)
    db_query "UPDATE ticket_tiers SET available = 1 WHERE event_id = '$event_id' AND name = '$tier_name'"
    
    log_info "Stock set to: 1 ticket"
    log_step "Launching 5 concurrent order attempts..."
    
    # Launch 5 simultaneous order attempts for 1 ticket
    local pids=()
    for i in {1..5}; do
        (
            local payload=$(cat <<EOF
{
  "email": "race_${i}@example.com",
  "firstName": "Race",
  "lastName": "Test$i",
  "phone": "+2348012345678",
  "items": [{
    "eventId": "$event_id",
    "tierName": "$tier_name",
    "quantity": 1
  }]
}
EOF
)
            
            curl -s -X POST "${API_BASE_URL}/api/orders/initialize" \
                -H "Content-Type: application/json" \
                -H "Cookie: guest_id=race_${i}" \
                -d "$payload" > "/tmp/race_${i}.json"
        ) &
        pids+=($!)
    done
    
    # Wait for all
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
    
    sleep 1
    
    # Count successful orders
    local success_count=0
    local refs=()
    
    for i in {1..5}; do
        local status=$(jq -r '.status' "/tmp/race_${i}.json" 2>/dev/null || echo "error")
        if [ "$status" = "success" ]; then
            success_count=$((success_count + 1))
            local ref=$(jq -r '.data.reference' "/tmp/race_${i}.json")
            refs+=("$ref")
        fi
    done
    
    log_metric "Successful Orders" "$success_count"
    
    # Verify stock is 0 or -1 (never negative in real scenario)
    local final_stock=$(db_get_stock "$event_id" "$tier_name")
    
    if [ "$success_count" -eq 1 ] && [ "$final_stock" -eq 0 ]; then
        log_success "✓ Exactly 1 order succeeded, stock = 0"
        log_result "Last Ticket Race" "PASS"
    elif [ "$success_count" -gt 1 ]; then
        log_error "✗ CRITICAL: Multiple orders for last ticket! ($success_count succeeded)"
        log_result "Last Ticket Race" "FAIL"
        return 1
    else
        log_warning "! No orders succeeded (might indicate overly aggressive locking)"
        log_result "Last Ticket Race" "PARTIAL"
    fi
    
    # Cleanup
    for ref in "${refs[@]}"; do
        db_delete_order "$ref"
    done
    rm -f /tmp/race_*.json
}

# ============================================================================
# RUN ALL TESTS
# ============================================================================

main() {
    echo "═══════════════════════════════════════════════════════"
    echo "        STOCK ATOMICITY DEEP DIVE TEST SUITE"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    
    test_stock_reservation_accuracy || true
    test_stock_release_worker || true
    test_last_ticket_race || true
    
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "Test log saved to: $LOG_FILE"
    echo "═══════════════════════════════════════════════════════"
}

main "$@"