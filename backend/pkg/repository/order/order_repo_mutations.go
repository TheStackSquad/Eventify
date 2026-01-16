// backend/pkg/repository/order/order_repo_mutations.go

package order

import (
	"context"
	"errors"
	"fmt"
	"time"
	"github.com/jmoiron/sqlx"

	"eventify/backend/pkg/models"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// SavePendingOrder creates a new pending order in the database
func (r *PostgresOrderRepository) SavePendingOrder(ctx context.Context, order *models.Order) (uuid.UUID, error) {
	if order == nil {
		return uuid.Nil, errors.New("order object cannot be nil")
	}

	if order.ID == uuid.Nil {
		order.ID = uuid.New()
	}

	now := time.Now()
	order.CreatedAt = now
	order.UpdatedAt = now

	// ✅ FIXED: Added guest_id to the INSERT query
query := `
		INSERT INTO orders (
			id, user_id, guest_id, reference, status, subtotal, service_fee, vat_amount, 
			final_total, amount_paid, paystack_fee, app_profit, customer_email, 
			customer_first_name, customer_last_name, customer_phone, ip_address, 
			user_agent, processed_by, webhook_attempts, created_at, updated_at
		) VALUES (
			:id, :user_id, :guest_id, :reference, :status, :subtotal, :service_fee, :vat_amount, 
			:final_total, :amount_paid, :paystack_fee, :app_profit, :customer_email, 
			:customer_first_name, :customer_last_name, :customer_phone, :ip_address, 
			:user_agent, :processed_by, :webhook_attempts, :created_at, :updated_at
		)
	`

	_, err := r.DB.NamedExecContext(ctx, query, order)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to insert pending order: %w", err)
	}

	// log.Info().
	// 	Str("order_id", order.ID.String()).
	// 	Str("reference", order.Reference).
	// 	Str("guest_id", order.GuestID.String).
	// 	Bool("has_user_id", order.UserID != nil).
	// 	Msg("Pending order saved to database")

	return order.ID, nil
}

// UpdateOrderStatus updates the status of an existing order
func (r *PostgresOrderRepository) UpdateOrderStatus(ctx context.Context, id uuid.UUID, newStatus models.OrderStatus) error {
	query := `UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3`

	result, err := r.DB.ExecContext(ctx, query, newStatus, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update order status for ID %s: %w", id.String(), err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("order not found or status already set")
	}

	log.Info().
		Str("order_id", id.String()).
		Str("new_status", string(newStatus)).
		Msg("Order status updated")

	return nil
}

// IncrementWebhookAttempts increments the webhook retry counter for an order
func (r *PostgresOrderRepository) IncrementWebhookAttempts(ctx context.Context, reference string) error {
	query := `
		UPDATE orders SET 
			webhook_attempts = COALESCE(webhook_attempts, 0) + 1,
			updated_at = $1
		WHERE reference = $2
	`

	result, err := r.DB.ExecContext(ctx, query, time.Now(), reference)
	if err != nil {
		return fmt.Errorf("failed to increment webhook attempts for reference %s: %w", reference, err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("order reference not found during webhook attempt increment")
	}

	return nil
}

// UpdateOrderStatusTx updates the order status within an existing transaction.
// This is used by the background worker and failure handlers.
func (r *PostgresOrderRepository) UpdateOrderStatusTx(ctx context.Context, tx *sqlx.Tx, orderID uuid.UUID, status models.OrderStatus) error {
	query := `UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3`
	_, err := tx.ExecContext(ctx, query, status, time.Now().UTC(), orderID)
	if err != nil {
		return fmt.Errorf("failed to update order status in tx: %w", err)
	}
	return nil
}