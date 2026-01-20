#!/bin/bash
# scripts/test/05_test_stock_consistency.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers/api_helpers.sh"
source "$SCRIPT_DIR/helpers/db_helpers.sh"
source "$SCRIPT_DIR/helpers/assertions.sh"

echo "========================================"
echo "TEST: Stock Consistency & Management"
echo "========================================"

db_check_connection || exit 1

# Helper to extract clean values from DB
db_extract() {
    echo "$1" | grep -vE 'selected|--|^$|^count' | head -n 1 | awk -F'|' '{print $1}' | xargs
}

log_info "Fetching valid test data..."

# Use 'event_title' based on your schema discovery
VALID_EVENT_ID=$(db_extract "$(db_query "SELECT id FROM events WHERE is_deleted = false LIMIT 1")")

# Get Tier Name specifically handling spaces (e.g., "General Admission")
VALID_TIER=$(db_query "SELECT name FROM ticket_tiers WHERE event_id = '$VALID_EVENT_ID' AND available > 20 LIMIT 1" | grep -vE 'name|--|^$' | head -n 1 | awk -F'|' '{print $1}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

TIER_ID=$(db_extract "$(db_query "SELECT id FROM ticket_tiers WHERE event_id = '$VALID_EVENT_ID' AND name = '$VALID_TIER'")")

if [ -z "$VALID_EVENT_ID" ] || [ -z "$VALID_TIER" ]; then
    log_error "Could not find valid Event ID or Tier Name."
    exit 1
fi

log_info "Testing with Event: $VALID_EVENT_ID, Tier: [$VALID_TIER]"

echo ""
log_info "Test 1: Stock Reduction on Successful Payment"
echo "------------------------------------"

# Get initial stock levels
INITIAL_STOCK=$(db_extract "$(db_query "SELECT available FROM ticket_tiers WHERE id = '$TIER_ID'")")
INITIAL_SOLD=$(db_extract "$(db_query "SELECT sold_count FROM ticket_tiers WHERE id = '$TIER_ID'")")
log_info "Initial stock: available=$INITIAL_STOCK, sold=$INITIAL_SOLD"

# Create and verify order
QUANTITY=3
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "stock1@example.com",
  "items": [{ "eventId": "$VALID_EVENT_ID", "tierName": "$VALID_TIER", "quantity": $QUANTITY }]
}
EOF

raw_init=$(init_order "$TEMP_FILE")
response=$(echo "$raw_init" | grep -o '{.*}' | tail -n 1)
REFERENCE=$(echo "$response" | jq -r '.data.reference // empty')
rm "$TEMP_FILE"

if [ -z "$REFERENCE" ]; then
    log_error "Order creation failed: $response"
    exit 1
fi

# Simulate Payment Verification
verify_payment "$REFERENCE" > /dev/null

# Check final stock
FINAL_STOCK=$(db_extract "$(db_query "SELECT available FROM ticket_tiers WHERE id = '$TIER_ID'")")
FINAL_SOLD=$(db_extract "$(db_query "SELECT sold_count FROM ticket_tiers WHERE id = '$TIER_ID'")")

log_info "Final stock: available=$FINAL_STOCK, sold=$FINAL_SOLD"

# Assertions using integer math
EXPECTED_STOCK=$((INITIAL_STOCK - QUANTITY))
EXPECTED_SOLD=$((INITIAL_SOLD + QUANTITY))

assert_equals "$FINAL_STOCK" "$EXPECTED_STOCK" "Available stock should decrease"
assert_equals "$FINAL_SOLD" "$EXPECTED_SOLD" "Sold count should increase"

db_delete_order "$REFERENCE"

echo ""
log_info "Test 2: Stock NOT Reduced for Pending Orders"
echo "------------------------------------"

BEFORE_PENDING=$(db_extract "$(db_query "SELECT available FROM ticket_tiers WHERE id = '$TIER_ID'")")

TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "pending@example.com",
  "items": [{ "eventId": "$VALID_EVENT_ID", "tierName": "$VALID_TIER", "quantity": 2 }]
}
EOF
response=$(init_order "$TEMP_FILE" | grep -o '{.*}' | tail -n 1)
PENDING_REF=$(echo "$response" | jq -r '.data.reference')
rm "$TEMP_FILE"

AFTER_PENDING=$(db_extract "$(db_query "SELECT available FROM ticket_tiers WHERE id = '$TIER_ID'")")

assert_equals "$AFTER_PENDING" "$BEFORE_PENDING" "Stock should not change for pending orders"
log_success "✓ Stock not prematurely reduced"

db_delete_order "$PENDING_REF"

echo ""
log_info "Test 3: Stock NOT Going Negative"
echo "------------------------------------"

CURRENT_STOCK=$(db_extract "$(db_query "SELECT available FROM ticket_tiers WHERE id = '$TIER_ID'")")
OVERSELL_QTY=$((CURRENT_STOCK + 10))

TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "oversell@example.com",
  "items": [{ "eventId": "$VALID_EVENT_ID", "tierName": "$VALID_TIER", "quantity": $OVERSELL_QTY }]
}
EOF
response=$(init_order "$TEMP_FILE" | grep -o '{.*}' | tail -n 1)
status=$(echo "$response" | jq -r '.status // "error"')
rm "$TEMP_FILE"

if [ "$status" != "success" ]; then
    log_success "✓ Overselling correctly prevented by API"
else
    log_error "API allowed order exceeding stock capacity"
    exit 1
fi

echo ""
log_info "Test 4: Final Stock Consistency Check"
echo "------------------------------------"

# Verify capacity = sold + available
CAPACITY=$(db_extract "$(db_query "SELECT capacity FROM ticket_tiers WHERE id = '$TIER_ID'")")
CURR_AVAIL=$(db_extract "$(db_query "SELECT available FROM ticket_tiers WHERE id = '$TIER_ID'")")
CURR_SOLD=$(db_extract "$(db_query "SELECT sold_count FROM ticket_tiers WHERE id = '$TIER_ID'")")

CALCULATED=$((CURR_AVAIL + CURR_SOLD))

if [ "$CALCULATED" -eq "$CAPACITY" ]; then
    log_success "✓ Stock integrity verified: Capacity ($CAPACITY) = Avail ($CURR_AVAIL) + Sold ($CURR_SOLD)"
else
    log_error "Stock inconsistency detected! Sum: $CALCULATED, Capacity: $CAPACITY"
    exit 1
fi

print_test_summary