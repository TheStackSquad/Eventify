// backend/pkg/repository/ order/order_repo_finalization.go

package order

import (
    "context"
    "errors"
    "fmt"
    "time"

    "github.com/eventify/backend/pkg/models"
    "github.com/jmoiron/sqlx"

    "github.com/google/uuid"
   // "github.com/rs/zerolog/log"
)

// UpdateOrderToPaidTx atomically updates the order status from PENDING to COMPLETED/PAID.
// This serves as the critical idempotency check within the transaction.
// ✅ FIXED (CLEAR)
func (r *PostgresOrderRepository) UpdateOrderToPaidTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error {
	// We include paystack_fee and app_profit in the update just in case 
	// final values were adjusted during the verification process.
	orderUpdateQuery := `
		UPDATE orders SET
			status = $1,
			updated_at = $2,
			payment_channel = $3,
			paid_at = $4,
			processed_by = $5,
			amount_paid = $6,
			paystack_fee = $7,
			app_profit = $8
		WHERE id = $9 
		  AND status = $10
	`
	
	now := time.Now().UTC()
	
	result, err := tx.ExecContext(ctx, orderUpdateQuery,
		string(models.OrderStatusSuccess),
		now,
		order.PaymentChannel,
		order.PaidAt,
		order.ProcessedBy,
		order.AmountPaid,
		order.PaystackFee,
		order.AppProfit,
		order.ID,
		string(models.OrderStatusPending),
	)
	
	if err != nil {
		return fmt.Errorf("failed to finalize order status: %w", err)
	}
	
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("order not found or status was not 'pending' (already processed)")
	}
	
	return nil
}


// InsertOrderItemsTx creates order item records with COMPLETE event snapshot data
func (r *PostgresOrderRepository) InsertOrderItemsTx(
	ctx context.Context,
	tx *sqlx.Tx,
	order *models.Order,
) error {
	if len(order.Items) == 0 {
		return errors.New("cannot insert order with no items")
	}

	// ✅ ENFORCEMENT: Validate all items have complete event snapshot BEFORE insert
	for i, item := range order.Items {
		if item.EventID == uuid.Nil {
			return fmt.Errorf("item %d missing event_id", i)
		}
		if item.EventTitle == "" {
			return fmt.Errorf("item %d missing event_title", i)
		}
		if item.EventStartDate.IsZero() {
			return fmt.Errorf("item %d missing event_start_date", i)
		}
		if item.EventEndDate.IsZero() {
			return fmt.Errorf("item %d missing event_end_date", i)
		}
		if item.EventCity == "" {
			return fmt.Errorf("item %d missing event_city", i)
		}
		if item.EventState == "" {
			return fmt.Errorf("item %d missing event_state", i)
		}
		if item.EventVenue == "" {
			return fmt.Errorf("item %d missing event_venue", i)
		}
		// Note: EventAddress can be empty (COALESCE handles it)
		if item.EventThumbnail == "" {
			return fmt.Errorf("item %d missing event_thumbnail", i)
		}
	}

	// ✅ COMPLETE INSERT QUERY with all 16 fields
	itemQuery := `
		INSERT INTO order_items (
			id, 
			order_id, 
			event_id, 
			ticket_tier_id, 
			event_title,
			tier_name, 
			quantity, 
			unit_price, 
			subtotal,
			event_start_date,
			event_end_date,
			event_city,
			event_state,
			event_venue,
			event_address,
			event_thumbnail,
			created_at
		) VALUES (
			:id, 
			:order_id, 
			:event_id, 
			:ticket_tier_id, 
			:event_title,
			:tier_name, 
			:quantity, 
			:unit_price, 
			:subtotal,
			:event_start_date,
			:event_end_date,
			:event_city,
			:event_state,
			:event_venue,
			:event_address,
			:event_thumbnail,
			:created_at
		)
	`

	// Execute insert for each item
	for _, item := range order.Items {
		// Ensure created_at is set
		if item.CreatedAt.IsZero() {
			item.CreatedAt = time.Now().UTC()
		}

		_, err := tx.NamedExecContext(ctx, itemQuery, item)
		if err != nil {
			return fmt.Errorf("failed to insert order item %s: %w", item.ID, err)
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