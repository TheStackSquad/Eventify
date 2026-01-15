#!/bin/bash
# scripts/test/01_test_order_init_enhanced.sh
# Enhanced order initialization tests with edge cases

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers/api_helpers.sh"
source "$SCRIPT_DIR/helpers/db_helpers.sh"
source "$SCRIPT_DIR/helpers/assertions.sh"

# Helper function to get clean JSON from init_order
get_clean_init_response() {
    local raw=$(init_order "$1")
    echo "$raw" | grep "{" | tail -n 1 | tr -d '\r'
}

echo "========================================"
echo "TEST: Enhanced Order Initialization"
echo "========================================"

db_check_connection || exit 1

# Get valid test data from database
VALID_EVENT_ID=$(db_query "SELECT id FROM events WHERE status = 'published' LIMIT 1" | tail -n 1 | tr -d ' ')
VALID_TIER=$(db_query "SELECT name FROM ticket_tiers WHERE event_id = '$VALID_EVENT_ID' AND available > 0 LIMIT 1" | tail -n 1 | tr -d ' ')

if [ -z "$VALID_EVENT_ID" ] || [ -z "$VALID_TIER" ]; then
    log_error "No valid test event/tier found. Please seed test data."
    exit 1
fi

log_info "Using test event: $VALID_EVENT_ID, tier: $VALID_TIER"

echo ""
log_info "Test 1: Valid Single Item Order"
echo "------------------------------------"
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+2348155764220",
  "items": [
    {
      "eventId": "$VALID_EVENT_ID",
      "tierName": "$VALID_TIER",
      "quantity": 1
    }
  ]
}
EOF

response=$(get_clean_init_response "$TEMP_FILE")
pretty_json "$response"

status=$(extract_json "$response" "status")
reference=$(extract_nested_json "$response" ".data.reference")

assert_equals "$status" "success" "Response status should be success"
assert_not_empty "$reference" "Reference should be generated"

if [ -n "$reference" ] && [ "$reference" != "null" ]; then
    # Verify database state
    assert_db_order_status "$reference" "pending" "Order should be pending"
    
    # Verify order structure
    order_data=$(db_query "SELECT subtotal, service_fee, vat_amount, final_total, customer_email FROM orders WHERE reference = '$reference'")
    log_info "Order breakdown: $order_data"
    
    # Verify order items were created
    item_count=$(db_query "SELECT COUNT(*) FROM order_items WHERE order_id = (SELECT id FROM orders WHERE reference = '$reference')" | tail -n 1)
    assert_equals "$item_count" "1" "Should have 1 order item"
    
    # Cleanup
    db_delete_order "$reference"
fi
rm "$TEMP_FILE"

echo ""
log_info "Test 2: Multiple Items Order"
echo "------------------------------------"
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "multi@example.com",
  "firstName": "Jane",
  "lastName": "Multi",
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

response=$(get_clean_init_response "$TEMP_FILE")
pretty_json "$response"

status=$(extract_json "$response" "status")
reference=$(extract_nested_json "$response" ".data.reference")

assert_equals "$status" "success" "Multi-item order should succeed"

if [ -n "$reference" ] && [ "$reference" != "null" ]; then
    # Verify total calculation
    subtotal=$(db_query "SELECT subtotal FROM orders WHERE reference = '$reference'" | tail -n 1)
    service_fee=$(db_query "SELECT service_fee FROM orders WHERE reference = '$reference'" | tail -n 1)
    vat_amount=$(db_query "SELECT vat_amount FROM orders WHERE reference = '$reference'" | tail -n 1)
    final_total=$(db_query "SELECT final_total FROM orders WHERE reference = '$reference'" | tail -n 1)
    
    log_info "Subtotal: $subtotal, Service Fee: $service_fee, VAT: $vat_amount, Total: $final_total"
    
    # Verify calculations (service_fee = 4% of subtotal, vat = 7.5% of (subtotal + service_fee))
    expected_service_fee=$((subtotal * 4 / 100))
    expected_vat=$(( (subtotal + expected_service_fee) * 75 / 1000 ))
    expected_total=$((subtotal + expected_service_fee + expected_vat))
    
    assert_equals "$service_fee" "$expected_service_fee" "Service fee calculation"
    assert_equals "$vat_amount" "$expected_vat" "VAT calculation"
    assert_equals "$final_total" "$expected_total" "Total calculation"
    
    db_delete_order "$reference"
fi
rm "$TEMP_FILE"

echo ""
log_info "Test 3: Missing Required Fields"
echo "------------------------------------"
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "firstName": "John",
  "lastName": "Doe",
  "items": [
    {
      "eventId": "$VALID_EVENT_ID",
      "tierName": "$VALID_TIER",
      "quantity": 1
    }
  ]
}
EOF

response=$(get_clean_init_response "$TEMP_FILE")
pretty_json "$response"

status=$(extract_json "$response" "status")
assert_equals "$status" "error" "Should return error for missing email"
rm "$TEMP_FILE"

echo ""
log_info "Test 4: Invalid Event ID"
echo "------------------------------------"
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "items": [
    {
      "eventId": "00000000-0000-0000-0000-000000000000",
      "tierName": "$VALID_TIER",
      "quantity": 1
    }
  ]
}
EOF

response=$(get_clean_init_response "$TEMP_FILE")
pretty_json "$response"

status=$(extract_json "$response" "status")
assert_equals "$status" "error" "Should return error for invalid event ID"
rm "$TEMP_FILE"

echo ""
log_info "Test 5: Insufficient Stock"
echo "------------------------------------"
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "items": [
    {
      "eventId": "$VALID_EVENT_ID",
      "tierName": "$VALID_TIER",
      "quantity": 999999
    }
  ]
}
EOF

response=$(get_clean_init_response "$TEMP_FILE")
pretty_json "$response"

status=$(extract_json "$response" "status")
assert_equals "$status" "error" "Should return error for insufficient stock"
rm "$TEMP_FILE"

echo ""
log_info "Test 6: Zero Quantity"
echo "------------------------------------"
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "items": [
    {
      "eventId": "$VALID_EVENT_ID",
      "tierName": "$VALID_TIER",
      "quantity": 0
    }
  ]
}
EOF

response=$(get_clean_init_response "$TEMP_FILE")
pretty_json "$response"

status=$(extract_json "$response" "status")
assert_equals "$status" "error" "Should return error for zero quantity"
rm "$TEMP_FILE"

echo ""
log_info "Test 7: Negative Quantity"
echo "------------------------------------"
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "items": [
    {
      "eventId": "$VALID_EVENT_ID",
      "tierName": "$VALID_TIER",
      "quantity": -5
    }
  ]
}
EOF

response=$(get_clean_init_response "$TEMP_FILE")
pretty_json "$response"

status=$(extract_json "$response" "status")
assert_equals "$status" "error" "Should return error for negative quantity"
rm "$TEMP_FILE"

echo ""
log_info "Test 8: Empty Items Array"
echo "------------------------------------"
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "items": []
}
EOF

response=$(get_clean_init_response "$TEMP_FILE")
pretty_json "$response"

status=$(extract_json "$response" "status")
assert_equals "$status" "error" "Should return error for empty items"
rm "$TEMP_FILE"

echo ""
log_info "Test 9: Invalid Email Format"
echo "------------------------------------"
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "not-an-email",
  "firstName": "John",
  "lastName": "Doe",
  "items": [
    {
      "eventId": "$VALID_EVENT_ID",
      "tierName": "$VALID_TIER",
      "quantity": 1
    }
  ]
}
EOF

response=$(get_clean_init_response "$TEMP_FILE")
pretty_json "$response"

status=$(extract_json "$response" "status")
assert_equals "$status" "error" "Should return error for invalid email"
rm "$TEMP_FILE"

echo ""
log_info "Test 10: Guest ID Tracking"
echo "------------------------------------"
TEMP_FILE=$(mktemp)
cat <<EOF > "$TEMP_FILE"
{
  "email": "guest@example.com",
  "firstName": "Guest",
  "lastName": "User",
  "items": [
    {
      "eventId": "$VALID_EVENT_ID",
      "tierName": "$VALID_TIER",
      "quantity": 1
    }
  ]
}
EOF

response=$(get_clean_init_response "$TEMP_FILE")
pretty_json "$response"

status=$(extract_json "$response" "status")
reference=$(extract_nested_json "$response" ".data.reference")

assert_equals "$status" "success" "Guest order should succeed"

if [ -n "$reference" ] && [ "$reference" != "null" ]; then
    guest_id=$(db_query "SELECT guest_id FROM orders WHERE reference = '$reference'" | tail -n 1)
    assert_not_empty "$guest_id" "Guest ID should be recorded"
    log_info "Guest ID: $guest_id"
    
    db_delete_order "$reference"
fi
rm "$TEMP_FILE"

print_test_summary