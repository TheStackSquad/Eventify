#!/bin/bash
# scripts/test/07_test_webhook.sh

set -e

# Load helpers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers/api_helpers.sh"
source "$SCRIPT_DIR/helpers/db_helpers.sh"
source "$SCRIPT_DIR/helpers/assertions.sh"

echo "========================================"
echo "TEST: Paystack Webhook Integration"
echo "========================================"

db_check_connection || exit 1

# 1. Initialize a valid order to get a real reference
log_info "Step 1: Creating order to be fulfilled via Webhook..."
raw_init=$(init_order "$SCRIPT_DIR/fixtures/valid_order.json")
init_res=$(echo "$raw_init" | tr -d '\r' | grep -o '{.*}')

REFERENCE=$(echo "$init_res" | jq -r '.data.reference')
AMOUNT=$(echo "$init_res" | jq -r '.data.amount_kobo')

if [ -z "$REFERENCE" ] || [ "$REFERENCE" == "null" ]; then
    log_error "Failed to initialize order for webhook test"
    exit 1
fi

log_info "Reference: $REFERENCE (Amount: $AMOUNT)"

# 2. Create the temporary fixture file (Minified JSON for better signature matching)
PAYLOAD_FILE="$SCRIPT_DIR/fixtures/current_webhook.json"
cat <<EOF > "$PAYLOAD_FILE"
{"event":"charge.success","data":{"id":123456,"domain":"test","status":"success","reference":"$REFERENCE","amount":$AMOUNT,"paid_at":"2026-01-14T18:30:00Z","channel":"card","currency":"NGN","customer":{"email":"test@example.com"}}}
EOF

# 3. Generate HMAC-SHA512 Signature
# Ensure this key matches your server's .env exactly
PAYSTACK_SECRET_KEY=${PAYSTACK_SECRET_KEY:-"sk_test_88fabc001828fd93ff9c173bfef4e60a51df4cb4"}
SIGNATURE=$(openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" "$PAYLOAD_FILE" | sed 's/^.* //')

echo ""
log_info "Step 2: Sending Webhook to /api/webhooks/paystack"
echo "------------------------------------"

# 4. Use --data-binary to ensure no newline translation occurs
response=$(curl -s -X POST "$API_BASE_URL/api/webhooks/paystack" \
    -H "Content-Type: application/json" \
    -H "x-paystack-signature: $SIGNATURE" \
    --data-binary @"$PAYLOAD_FILE")

log_success "Webhook sent. Response: $response"

# 5. Verify Database and Ticket Generation
log_info "Step 3: Verifying Database and Ticket Generation..."
sleep 2 # Give the server a moment to finish the transaction

order_status=$(db_query "SELECT status FROM orders WHERE reference = '$REFERENCE'" | tr -d ' ')
assert_equals "$order_status" "success" "Order should be success"

# Count tickets linked to this order
ticket_count=$(db_query "SELECT count(*) FROM tickets t JOIN orders o ON t.order_id = o.id WHERE o.reference = '$REFERENCE'" | tr -d ' ')

if [ "$ticket_count" -gt 0 ]; then
    log_success "PASS: $ticket_count tickets generated for this order!"
else
    log_error "FAIL: Order marked success but no tickets found in DB."
    exit 1
fi

# Cleanup
# rm "$PAYLOAD_FILE" # Uncomment to delete after test
db_delete_order "$REFERENCE"

print_test_summary