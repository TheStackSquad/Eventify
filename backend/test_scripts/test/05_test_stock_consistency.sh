#!/bin/bash
# scripts/test/05_test_stock_consistency.sh
# Test stock management and consistency under various scenarios

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers/api_helpers.sh"
source "$SCRIPT_DIR/helpers/db_helpers.sh"
source "$SCRIPT_DIR/helpers/assertions.sh"

echo "========================================"
echo "TEST: Stock Consistency & Management"
echo "========================================"

db_check_connection || exit 1

# Get valid test data
VALID_EVENT_ID=$(db_query "SELECT id FROM events WHERE status = 'published' LIMIT 1" | tail -n 1 | tr -d ' ')
VALID_TIER=$(db_query "SELECT name FROM ticket_tiers WHERE event_id = '$VALID_EVENT_ID' AND available > 20 LIMIT 1" | tail -n 1 | tr -d ' ')
TIER_ID=$(db_query "SELECT id FROM ticket_tiers WHERE event_id = '$VALID_EVENT_ID' AND name = '$VALID_TIER'" | tail -n 1 | tr -d ' ')

log_info "Testing with Event: $VALID_EVENT_ID, Tier: $VALID_TIER"

echo ""
log_info "Test 1: Stock Reduction on Successful Payment"
echo "------------------------------------"

# Get initial stock
INITIAL_STOCK=$(db_get_stock "$TIER_ID")
INITIAL_SOLD=$(db_query "SELECT sold FROM ticket_tiers WHERE id = '$TIER_ID'" | tail -n 1)
log_info "Initial stock: available=$INITIAL_STOCK, sold=$INITIAL_SOLD"

# Create and verify order
QUANTITY=3
response=$(create_test_order "stock1@example.com" "$VALID_EVENT_ID" "$VALID_TIER" "$QUANTITY")
REFERENCE=$(extract_nested_json "$response" ".data.reference")

verify_payment "$REFERENCE" > /dev/null

# Check final stock
FINAL_STOCK=$(db_get_stock "$TIER_ID")
FINAL_SOLD=$(db_query "SELECT sold FROM ticket_tiers WHERE id = '$TIER_ID'" | tail -n 1)

log_info "Final stock: available=$FINAL_STOCK, sold=$FINAL_SOLD"

# Assertions
EXPECTED_STOCK=$((INITIAL_STOCK - QUANTITY))
EXPECTED_SOLD=$((INITIAL_SOLD + QUANTITY))

assert_equals "$FINAL_STOCK" "$EXPECTED_STOCK" "Available stock should decrease"
assert_equals "$FINAL_SOLD" "$EXPECTED_SOLD" "Sold count should increase"

# Verify consistency
consistency=$(db_verify_stock_consistency "$TIER_ID")
log_info "Stock consistency check: $consistency"

db_delete_order "$REFERENCE"

echo ""
log_info "Test 2: Stock NOT Reduced for Pending Orders"
echo "------------------------------------"

# Get current stock
BEFORE_PENDING=$(db_get_stock "$TIER_ID")

# Create order but DON'T verify
response=$(create_test_order "pending@example.com" "$VALID_EVENT_ID" "$VALID_TIER" "2")
PENDING_REF=$(extract_nested_json "$response" ".data.reference")

# Check stock immediately
AFTER_PENDING=$(db_get_stock "$TIER_ID")

# Stock should remain the same (no reduction until payment verified)
# NOTE: If your system reserves stock on order creation, adjust this assertion
assert_equals "$AFTER_PENDING" "$BEFORE_PENDING" "Stock should not change for pending orders"

log_success "✓ Stock not prematurely reduced"

db_delete_order "$PENDING_REF"

echo ""
log_info "Test 3: Stock Consistency After Multiple Orders"
echo "------------------------------------"

# Get baseline
BASELINE_STOCK=$(db_get_stock "$TIER_ID")
BASELINE_SOLD=$(db_query "SELECT sold FROM ticket_tiers WHERE id = '$TIER_ID'" | tail -n 1)
BASELINE_CAPACITY=$(db_query "SELECT capacity FROM ticket_tiers WHERE id = '$TIER_ID'" | tail -n 1)

log_info "Baseline: capacity=$BASELINE_CAPACITY, sold=$BASELINE_SOLD, available=$BASELINE_STOCK"

# Create multiple orders
ORDERS=()
TOTAL_QUANTITY=0

for i in {1..5}; do
    qty=$((RANDOM % 3 + 1))  # Random quantity 1-3
    response=$(create_test_order "multi$i@example.com" "$VALID_EVENT_ID" "$VALID_TIER" "$qty")
    ref=$(extract_nested_json "$response" ".data.reference")
    
    if [ -n "$ref" ] && [ "$ref" != "null" ]; then
        ORDERS+=("$ref")
        TOTAL_QUANTITY=$((TOTAL_QUANTITY + qty))
        verify_payment "$ref" > /dev/null
        log_info "Order $i: $ref ($qty tickets)"
    fi
done

# Check final state
FINAL_STOCK=$(db_get_stock "$TIER_ID")
FINAL_SOLD=$(db_query "SELECT sold FROM ticket_tiers WHERE id = '$TIER_ID'" | tail -n 1)

log_info "After orders: sold=$FINAL_SOLD, available=$FINAL_STOCK"

# Verify calculations
EXPECTED_FINAL_SOLD=$((BASELINE_SOLD + TOTAL_QUANTITY))
EXPECTED_FINAL_STOCK=$((BASELINE_STOCK - TOTAL_QUANTITY))

assert_equals "$FINAL_SOLD" "$EXPECTED_FINAL_SOLD" "Sold count should match total quantity"
assert_equals "$FINAL_STOCK" "$EXPECTED_FINAL_STOCK" "Available should match reduction"

# Verify capacity = sold + available
CALCULATED_CAPACITY=$((FINAL_SOLD + FINAL_STOCK))
assert_equals "$CALCULATED_CAPACITY" "$BASELINE_CAPACITY" "Capacity should remain constant"

log_success "✓ Stock consistency maintained across $TOTAL_QUANTITY tickets"

# Cleanup
for ref in "${ORDERS[@]}"; do
    db_delete_order "$ref"
done

echo ""
log_info "Test 4: Prevent Overselling (Boundary Condition)"
echo "------------------------------------"

# Find tier with exactly 1 ticket available (or set it)
BOUNDARY_TIER_ID=$(db_query "SELECT id FROM ticket_tiers WHERE event_id = '$VALID_EVENT_ID' AND available = 1 LIMIT 1" | tail -n 1 | tr -d ' ')

if [ -z "$BOUNDARY_TIER_ID" ]; then
    # Create test tier with 1 ticket
    log_info "Creating boundary test tier..."
    # You might need to set this up manually or adjust an existing tier
    log_warning "Skipping boundary test - no tier with exactly 1 ticket available"
else
    BOUNDARY_TIER_NAME=$(db_query "SELECT name FROM ticket_tiers WHERE id = '$BOUNDARY_TIER_ID'" | tail -n 1 | tr -d ' ')
    
    log_info "Testing with tier: $BOUNDARY_TIER_NAME (1 ticket available)"
    
    # Try to create 2 orders for 1 ticket each
    response1=$(create_test_order "boundary1@example.com" "$VALID_EVENT_ID" "$BOUNDARY_TIER_NAME" "1")
    ref1=$(extract_nested_json "$response1" ".data.reference")
    status1=$(extract_json "$response1" "status")
    
    response2=$(create_test_order "boundary2@example.com" "$VALID_EVENT_ID" "$BOUNDARY_TIER_NAME" "1")
    ref2=$(extract_nested_json "$response2" ".data.reference")
    status2=$(extract_json "$response2" "status")
    
    log_info "Order 1: $status1"
    log_info "Order 2: $status2"
    
    # At least one should succeed, second might fail
    if [ "$status1" == "success" ]; then
        verify_payment "$ref1" > /dev/null
        
        # Second order should fail if stock was properly reserved
        if [ "$status2" == "success" ]; then
            verify_response=$(verify_payment "$ref2")
            verify_status=$(extract_json "$verify_response" "status")
            
            if [ "$verify_status" == "error" ]; then
                log_success "✓ Second order correctly rejected"
            fi
        fi
        
        db_delete_order "$ref1"
        [ -n "$ref2" ] && db_delete_order "$ref2"
    fi
fi

echo ""
log_info "Test 5: Stock NOT Going Negative"
echo "------------------------------------"

# Get current stock
CURRENT_STOCK=$(db_get_stock "$TIER_ID")

# Try to order more than available
OVERSELL_QTY=$((CURRENT_STOCK + 10))
response=$(create_test_order "oversell@example.com" "$VALID_EVENT_ID" "$VALID_TIER" "$OVERSELL_QTY")
status=$(extract_json "$response" "status")

assert_equals "$status" "error" "Should reject order exceeding stock"

# Verify stock unchanged
AFTER_REJECTION=$(db_get_stock "$TIER_ID")
assert_equals "$AFTER_REJECTION" "$CURRENT_STOCK" "Stock should remain unchanged after rejection"

log_success "✓ Overselling prevented"

echo ""
log_info "Test 6: Concurrent Orders (Race Condition)"
echo "------------------------------------"

# Get current stock
RACE_STOCK=$(db_get_stock "$TIER_ID")
log_info "Current stock: $RACE_STOCK"

# Create multiple orders concurrently
CONCURRENT_COUNT=5
CONCURRENT_REFS=()

log_info "Creating $CONCURRENT_COUNT concurrent orders..."

PIDS=()
for i in $(seq 1 "$CONCURRENT_COUNT"); do
    (
        response=$(create_test_order "concurrent$i@example.com" "$VALID_EVENT_ID" "$VALID_TIER" "2")
        ref=$(extract_nested_json "$response" ".data.reference")
        echo "$ref" >> /tmp/concurrent_refs_$$.txt
    ) &
    PIDS+=($!)
done

# Wait for all
for pid in "${PIDS[@]}"; do
    wait "$pid"
done

# Collect references
if [ -f /tmp/concurrent_refs_$$.txt ]; then
    while IFS= read -r ref; do
        if [ -n "$ref" ] && [ "$ref" != "null" ]; then
            CONCURRENT_REFS+=("$ref")
        fi
    done < /tmp/concurrent_refs_$$.txt
    rm /tmp/concurrent_refs_$$.txt
fi

log_info "Created ${#CONCURRENT_REFS[@]} concurrent orders"

# Verify all concurrently
for ref in "${CONCURRENT_REFS[@]}"; do
    verify_payment "$ref" > /dev/null &
done
wait

# Check final stock
FINAL_RACE_STOCK=$(db_get_stock "$TIER_ID")
TICKETS_SOLD=$((RACE_STOCK - FINAL_RACE_STOCK))

log_info "Stock change: $RACE_STOCK → $FINAL_RACE_STOCK (sold: $TICKETS_SOLD)"

# Verify stock didn't go negative
if [ $FINAL_RACE_STOCK -lt 0 ]; then
    log_error "CRITICAL: Stock went negative! $FINAL_RACE_STOCK"
    exit 1
else
    log_success "✓ Stock remained non-negative under concurrent load"
fi

# Cleanup
for ref in "${CONCURRENT_REFS[@]}"; do
    db_delete_order "$ref"
done

echo ""
log_info "Test 7: Stock Integrity After Failed Verifications"
echo "------------------------------------"

# Get baseline
FAIL_BASELINE=$(db_get_stock "$TIER_ID")

# Create orders that will fail verification (non-existent references)
FAKE_REFS=("TIX_9999_fake1" "TIX_9999_fake2" "TIX_9999_fake3")

for fake_ref in "${FAKE_REFS[@]}"; do
    verify_payment "$fake_ref" > /dev/null 2>&1 || true
done

# Stock should be unchanged
AFTER_FAILURES=$(db_get_stock "$TIER_ID")
assert_equals "$AFTER_FAILURES" "$FAIL_BASELINE" "Stock unchanged after failed verifications"

log_success "✓ Stock integrity maintained"

echo ""
log_info "Test 8: Final Stock Consistency Report"
echo "------------------------------------"

consistency_report=$(db_verify_stock_consistency "$TIER_ID")
log_info "Final consistency check:"
echo "$consistency_report" | column -t -s '|'

# Verify consistency status
if echo "$consistency_report" | grep -q "INCONSISTENT"; then
    log_error "Stock consistency check FAILED!"
    exit 1
else
    log_success "✓ Stock is CONSISTENT"
fi

print_test_summary