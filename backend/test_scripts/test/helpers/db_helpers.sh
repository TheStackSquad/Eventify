#!/bin/bash
# scripts/test/helpers/db_helpers_enhanced.sh
# Enhanced database helper functions

# Load environment variables from .env file
ENV_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)/.env"
if [ -f "$ENV_PATH" ]; then
    export $(grep -v '^#' "$ENV_PATH" | sed 's/#.*//g' | grep -v '^\s*$' | xargs)
fi

# Set database connection variables
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-Eventify}
DB_USER=${DB_USER:-astronautdesh}
DB_PASSWORD=${DB_PASSWORD:-astronautdesh}

# Execute SQL query
db_query() {
    local query="$1"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "$query" 2>/dev/null
}

# Check database connection
db_check_connection() {
    if db_query "SELECT 1" > /dev/null; then
        log_success "Database connection OK"
        return 0
    else
        log_error "Database connection failed"
        return 1
    fi
}

# Get order by reference
db_get_order() {
    local reference="$1"
    db_query "SELECT * FROM orders WHERE reference = '$reference'"
}

# Get order status
db_get_order_status() {
    local reference="$1"
    db_query "SELECT status FROM orders WHERE reference = '$reference'" | tail -n 1
}

# Get order full details with items
db_get_order_full() {
    local reference="$1"
    db_query "
        SELECT 
            o.reference,
            o.status,
            o.subtotal,
            o.service_fee,
            o.vat_amount,
            o.final_total,
            o.customer_email,
            COUNT(t.id) as ticket_count
        FROM orders o
        LEFT JOIN tickets t ON t.order_id = o.id
        WHERE o.reference = '$reference'
        GROUP BY o.id
    "
}

# Count tickets for an order
db_count_tickets() {
    local order_id="$1"
    db_query "SELECT COUNT(*) FROM tickets WHERE order_id = '$order_id'" | tail -n 1
}

# Get ticket details
db_get_tickets() {
    local order_id="$1"
    db_query "
        SELECT 
            t.code,
            t.status,
            t.is_used,
            tt.name as tier_name
        FROM tickets t
        JOIN ticket_tiers tt ON t.ticket_tier_id = tt.id
        WHERE t.order_id = '$order_id'
    "
}

# Get stock/available tickets for a tier
db_get_stock() {
    local tier_id="$1"
    db_query "SELECT available FROM ticket_tiers WHERE id = '$tier_id'" | tail -n 1
}

# Get tier capacity and sold
db_get_tier_info() {
    local tier_id="$1"
    db_query "
        SELECT 
            name,
            capacity,
            sold,
            available,
            price_kobo
        FROM ticket_tiers 
        WHERE id = '$tier_id'
    "
}

# Check if order exists
db_order_exists() {
    local reference="$1"
    local count=$(db_query "SELECT COUNT(*) FROM orders WHERE reference = '$reference'" | tail -n 1)
    [ "$count" -gt 0 ]
}

# Delete order (cascade to tickets and order_items)
db_delete_order() {
    local reference="$1"
    
    # Get order_id first
    local order_id=$(db_query "SELECT id FROM orders WHERE reference = '$reference'" | tail -n 1)
    
    if [ -n "$order_id" ] && [ "$order_id" != "" ]; then
        # Delete tickets first (if not cascading)
        db_query "DELETE FROM tickets WHERE order_id = '$order_id'" > /dev/null
        
        # Delete order_items
        db_query "DELETE FROM order_items WHERE order_id = '$order_id'" > /dev/null
        
        # Delete order
        db_query "DELETE FROM orders WHERE id = '$order_id'" > /dev/null
        
        log_info "Deleted order: $reference"
        return 0
    else
        log_warning "Order not found: $reference"
        return 1
    fi
}

# Assert order status
assert_db_order_status() {
    local reference="$1"
    local expected_status="$2"
    local message="${3:-Order status check}"
    
    local actual_status=$(db_get_order_status "$reference")
    assert_equals "$actual_status" "$expected_status" "$message"
}

# Get order items count
db_get_order_items_count() {
    local order_id="$1"
    db_query "SELECT COUNT(*) FROM order_items WHERE order_id = '$order_id'" | tail -n 1
}

# Get total quantity from order items
db_get_order_total_quantity() {
    local order_id="$1"
    db_query "SELECT SUM(quantity) FROM order_items WHERE order_id = '$order_id'" | tail -n 1
}

# Get order processing info
db_get_order_processing_info() {
    local reference="$1"
    db_query "
        SELECT 
            processed_by,
            webhook_attempts,
            paid_at,
            created_at,
            updated_at
        FROM orders 
        WHERE reference = '$reference'
    "
}

# Check for duplicate ticket codes
db_check_duplicate_tickets() {
    local order_id="$1"
    db_query "
        SELECT code, COUNT(*) as count 
        FROM tickets 
        WHERE order_id = '$order_id' 
        GROUP BY code 
        HAVING COUNT(*) > 1
    "
}

# Get order financial breakdown
db_get_order_financials() {
    local reference="$1"
    db_query "
        SELECT 
            subtotal,
            service_fee,
            vat_amount,
            final_total,
            amount_paid
        FROM orders 
        WHERE reference = '$reference'
    "
}

# Verify stock consistency
db_verify_stock_consistency() {
    local tier_id="$1"
    db_query "
        SELECT 
            capacity,
            sold,
            available,
            (capacity - sold) as calculated_available,
            CASE 
                WHEN available = (capacity - sold) THEN 'CONSISTENT'
                ELSE 'INCONSISTENT'
            END as status
        FROM ticket_tiers 
        WHERE id = '$tier_id'
    "
}

# Get all pending orders
db_get_pending_orders() {
    db_query "
        SELECT 
            reference,
            customer_email,
            final_total,
            created_at
        FROM orders 
        WHERE status = 'pending'
        ORDER BY created_at DESC
    "
}

# Get orders by status
db_get_orders_by_status() {
    local status="$1"
    db_query "
        SELECT 
            reference,
            customer_email,
            status,
            final_total,
            created_at
        FROM orders 
        WHERE status = '$status'
        ORDER BY created_at DESC
        LIMIT 10
    "
}

# Count tickets by status
db_count_tickets_by_status() {
    local order_id="$1"
    local status="$2"
    db_query "SELECT COUNT(*) FROM tickets WHERE order_id = '$order_id' AND status = '$status'" | tail -n 1
}

# Get unused tickets count
db_get_unused_tickets_count() {
    local order_id="$1"
    db_query "SELECT COUNT(*) FROM tickets WHERE order_id = '$order_id' AND is_used = false" | tail -n 1
}

# Verify order integrity (comprehensive check)
db_verify_order_integrity() {
    local reference="$1"
    
    log_info "Verifying order integrity: $reference"
    
    local order_id=$(db_query "SELECT id FROM orders WHERE reference = '$reference'" | tail -n 1)
    if [ -z "$order_id" ]; then
        log_error "Order not found"
        return 1
    fi
    
    # Check 1: Order items exist
    local items_count=$(db_get_order_items_count "$order_id")
    if [ "$items_count" -eq 0 ]; then
        log_error "No order items found"
        return 1
    fi
    log_info "✓ Order items: $items_count"
    
    # Check 2: Tickets match quantity (if order is success)
    local order_status=$(db_get_order_status "$reference")
    if [ "$order_status" == "success" ]; then
        local expected_tickets=$(db_get_order_total_quantity "$order_id")
        local actual_tickets=$(db_count_tickets "$order_id")
        
        if [ "$expected_tickets" != "$actual_tickets" ]; then
            log_error "Ticket count mismatch: expected $expected_tickets, got $actual_tickets"
            return 1
        fi
        log_info "✓ Tickets: $actual_tickets (matches quantity)"
        
        # Check 3: No duplicate ticket codes
        local duplicates=$(db_check_duplicate_tickets "$order_id")
        if [ -n "$duplicates" ]; then
            log_error "Duplicate ticket codes found: $duplicates"
            return 1
        fi
        log_info "✓ No duplicate ticket codes"
    fi
    
    # Check 4: Financial calculations
    local financials=$(db_get_order_financials "$reference")
    log_info "✓ Financials: $financials"
    
    log_success "Order integrity verified"
    return 0
}

# Clean up test data (orders created in last hour)
db_cleanup_test_orders() {
    log_info "Cleaning up test orders..."
    
    db_query "
        DELETE FROM tickets 
        WHERE order_id IN (
            SELECT id FROM orders 
            WHERE customer_email LIKE '%@example.com' 
            AND created_at > NOW() - INTERVAL '1 hour'
        )
    " > /dev/null
    
    db_query "
        DELETE FROM order_items 
        WHERE order_id IN (
            SELECT id FROM orders 
            WHERE customer_email LIKE '%@example.com' 
            AND created_at > NOW() - INTERVAL '1 hour'
        )
    " > /dev/null
    
    local deleted=$(db_query "
        DELETE FROM orders 
        WHERE customer_email LIKE '%@example.com' 
        AND created_at > NOW() - INTERVAL '1 hour'
        RETURNING id
    " | wc -l)
    
    log_success "Cleaned up $deleted test orders"
}

# Export functions
export -f db_query db_check_connection
export -f db_get_order db_get_order_status db_get_order_full
export -f db_count_tickets db_get_tickets db_get_stock db_get_tier_info
export -f db_order_exists db_delete_order
export -f assert_db_order_status
export -f db_get_order_items_count db_get_order_total_quantity
export -f db_get_order_processing_info
export -f db_check_duplicate_tickets db_get_order_financials
export -f db_verify_stock_consistency
export -f db_get_pending_orders db_get_orders_by_status
export -f db_count_tickets_by_status db_get_unused_tickets_count
export -f db_verify_order_integrity db_cleanup_test_orders


































# #!/bin/bash
# # scripts/test/helpers/db_helpers.sh

# # --- 1. Load Environment Variables ---
# # Locate .env relative to this script (3 levels up: helpers -> test -> test_scripts -> backend)
# ENV_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/.env"

# if [ -f "$ENV_PATH" ]; then
#     # Improved loader: 
#     # 1. Strip inline comments (anything after #)
#     # 2. Ignore lines starting with # 
#     # 3. Export only valid KEY=VALUE pairs
#     export $(sed 's/#.*//g' "$ENV_PATH" | grep -v '^\s*$' | xargs)
#     # echo "DEBUG: Loaded .env from $ENV_PATH" # Uncomment for debugging
# else
#     echo "⚠️ Warning: .env not found at $ENV_PATH"
# fi

# # --- 2. Logging & Defaults ---
# log_success() { echo -e "✅ $1"; }
# log_error()   { echo -e "❌ $1"; }
# log_info()    { echo -e "ℹ️ $1"; }

# DB_HOST="${DB_HOST:-localhost}"
# DB_PORT="${DB_PORT:-5432}"
# DB_NAME="${DB_NAME:-eventify_db}"
# DB_USER="${DB_USER:-postgres}"
# DB_PASSWORD="${DB_PASSWORD:-postgres}"

# # --- 3. Database Functions ---

# db_query() {
#     local sql=$1
#     PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "$sql"
# }

# db_get_order() {
#     local reference=$1
#     db_query "SELECT id, reference, status, final_total, amount_paid FROM orders WHERE reference = '$reference'"
# }

# db_get_order_status() {
#     local reference=$1
#     db_query "SELECT status FROM orders WHERE reference = '$reference'"
# }

# db_count_tickets() {
#     local order_id=$1
#     db_query "SELECT COUNT(*) FROM tickets WHERE order_id = '$order_id'"
# }

# db_get_stock() {
#     local event_id=$1
#     local tier_name=$2
#     db_query "SELECT available FROM ticket_tiers WHERE event_id = '$event_id' AND tier_name = '$tier_name'"
# }

# db_order_exists() {
#     local reference=$1
#     local count=$(db_query "SELECT COUNT(*) FROM orders WHERE reference = '$reference'")
#     [ "$count" -gt 0 ]
# }

# db_delete_order() {
#     local reference=$1
#     local order_id=$(db_query "SELECT id FROM orders WHERE reference = '$reference'")
#     if [ -n "$order_id" ]; then
#         db_query "DELETE FROM tickets WHERE order_id = '$order_id'"
#         db_query "DELETE FROM order_items WHERE order_id = '$order_id'"
#         db_query "DELETE FROM orders WHERE id = '$order_id'"
#         log_info "Deleted test order: $reference"
#     fi
# }

# # Verify tickets exist for a specific order
# db_verify_tickets_generated() {
#     local order_id=$1
#     local expected_count=$2
    
#     # Query the tickets table using the order_id
#     local actual_count=$(db_query "SELECT count(*) FROM tickets WHERE order_id = '$order_id'" | tr -d ' ')
    
#     if [ "$actual_count" -eq "$expected_count" ]; then
#         return 0
#     else
#         echo "❌ Expected $expected_count tickets, found $actual_count"
#         return 1
#     fi
# }

# db_check_connection() {
#     if db_query "SELECT 1" > /dev/null 2>&1; then
#         log_success "Database connection OK"
#         return 0
#     else
#         log_error "Database connection failed ($DB_USER @ $DB_NAME)"
#         return 1
#     fi
# }

# # --- 4. Export Functions for Subshells ---
# export -f db_query db_get_order db_get_order_status
# export -f db_count_tickets db_get_stock db_order_exists
# export -f db_delete_order db_check_connection