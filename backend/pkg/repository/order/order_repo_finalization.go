// backend/pkg/repository/ order/order_repo_finalization.go

package order

import (
    "context"
    "errors"
    "fmt"
    "time"

    "eventify/backend/pkg/models"
    "github.com/jmoiron/sqlx"

    //"github.com/google/uuid"
   // "github.com/rs/zerolog/log"
)

// UpdateOrderToPaidTx atomically updates the order status from PENDING to COMPLETED/PAID.
// This serves as the critical idempotency check within the transaction.
// ✅ FIXED (CLEAR)
func (r *PostgresOrderRepository) UpdateOrderToPaidTx(
    ctx context.Context,
    tx *sqlx.Tx,
    order *models.Order,
) error {
    // Remove confusing pre-check - let database do the work
    
    orderUpdateQuery := `
        UPDATE orders SET
            status = $1,
            updated_at = $2,
            payment_channel = $3,
            paid_at = $4,
            processed_by = $5,
            amount_paid = $6
        WHERE id = $7 
          AND status = $8  -- ✅ This is the real protection
    `
    
    now := time.Now().UTC()
    
    result, err := tx.ExecContext(ctx, orderUpdateQuery,
        string(models.OrderStatusSuccess),
        now,
        order.PaymentChannel,
        order.PaidAt,
        order.ProcessedBy,
        order.AmountPaid,
        order.ID,
        string(models.OrderStatusPending),
    )
    
    if err != nil {
        return fmt.Errorf("failed to finalize order status: %w", err)
    }
    
    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return errors.New("order not found or status was not 'PENDING' (already processed)")
    }
    
    return nil
}

// InsertOrderItemsTx creates order item records in the database using the transaction.
func (r *PostgresOrderRepository) InsertOrderItemsTx(
    ctx context.Context,
    tx *sqlx.Tx,
    order *models.Order,
) error {
    // NOTE: Ensure order.Items has IDs and OrderIDs set BEFORE calling this method
   itemQuery := `
        INSERT INTO order_items (
            id, order_id, event_id, event_title, ticket_tier_id, tier_name, quantity, unit_price, subtotal
        ) VALUES (
            :id, :order_id, :event_id, :event_title, :ticket_tier_id, :tier_name, :quantity, :unit_price, :subtotal
        )
    `
    // Use NamedExecContext for bulk insertion via sqlx if supported, otherwise loop (as implemented)

    for _, item := range order.Items {
        _, err := tx.NamedExecContext(ctx, itemQuery, item)
        if err != nil {
            return fmt.Errorf("failed to insert order items: %w", err)
        }
    }

    return nil
}

// InsertTicketsTx creates individual ticket records in the database using the transaction.
func (r *PostgresOrderRepository) InsertTicketsTx(
    ctx context.Context,
    tx *sqlx.Tx,
    order *models.Order,
    tickets []models.Ticket,
) error {
    // NOTE: Ensure tickets have IDs and OrderIDs set BEFORE calling this method
    ticketQuery := `
        INSERT INTO tickets (
            id, code, order_id, event_id, ticket_tier_id, user_id, status, is_used,
            created_at, updated_at
        ) VALUES (
            :id, :code, :order_id, :event_id, :ticket_tier_id, :user_id, :status, :is_used,
            :created_at, :updated_at
        )
    `
    // Use NamedExecContext for bulk insertion via sqlx if supported, otherwise loop (as implemented)
    for _, ticket := range tickets {
        _, err := tx.NamedExecContext(ctx, ticketQuery, ticket)
        if err != nil {
            return fmt.Errorf("failed to insert tickets: %w", err)
        }
    }

    return nil
}