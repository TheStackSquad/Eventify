// backend/pkg/repository/order/order_repo.go

package order

import (
	"context"
	"fmt"
	"errors"
	"time"
	"eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// StockReduction is a structure used by the Service layer to aggregate the total
// quantity of a ticket tier required for a given order, before passing it to the
// event repository for stock decrement.
type StockReduction struct {
	EventID 	 uuid.UUID
	TicketTierID uuid.UUID
	TierName 	 string
	Quantity 	 int32
}

type OrderRepository interface {
	// --- Non-Transactional Methods ---
	RunInTransaction(ctx context.Context, fn func(tx *sqlx.Tx) error) error
	GetOrderByReference(ctx context.Context, reference string) (*models.Order, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.Order, error)
	UpdateOrderStatus(ctx context.Context, id uuid.UUID, newStatus models.OrderStatus) error
	IncrementWebhookAttempts(ctx context.Context, reference string) error
	SavePendingOrder(ctx context.Context, order *models.Order) (uuid.UUID, error)

	// --- Transactional Methods ---
	SavePendingOrderTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) (uuid.UUID, error)
	UpdateOrderToPaidTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error
	InsertOrderItemsTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error
	InsertTicketsTx(ctx context.Context, tx *sqlx.Tx, order *models.Order, tickets []models.Ticket) error
}

type PostgresOrderRepository struct {
	DB *sqlx.DB
}

func NewPostgresOrderRepository(db *sqlx.DB) *PostgresOrderRepository {
	return &PostgresOrderRepository{
		DB: db,
	}
}

// RunInTransaction (implementation omitted for brevity, assumed correct)
func (r *PostgresOrderRepository) RunInTransaction(ctx context.Context, fn func(tx *sqlx.Tx) error) error {
	tx, err := r.DB.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		} else if err != nil {
			tx.Rollback()
		} else {
			err = tx.Commit()
		}
	}()
	err = fn(tx)
	return err
}

// SavePendingOrderTx saves a new pending order using an external transaction (sqlx.Tx)
func (r *PostgresOrderRepository) SavePendingOrderTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) (uuid.UUID, error) {
	if order == nil {
		return uuid.Nil, errors.New("order object cannot be nil")
	}

	if order.ID == uuid.Nil {
		order.ID = uuid.New()
	}

	now := time.Now() // Note: You need to ensure 'time' is imported here if not already.
	order.CreatedAt = now
	order.UpdatedAt = now

	// The query is similar to SavePendingOrder, but execution uses the passed transaction (tx)
	insertQuery := `
		INSERT INTO orders (
			id, user_id, guest_id, reference, status, subtotal, service_fee, vat_amount, 
			final_total, amount_paid, customer_email, customer_first_name, customer_last_name, 
			customer_phone, ip_address, user_agent, processed_by, webhook_attempts,
			created_at, updated_at
		) VALUES (
			:id, :user_id, :guest_id, :reference, :status, :subtotal, :service_fee, :vat_amount, 
			:final_total, :amount_paid, :customer_email, :customer_first_name, :customer_last_name, 
			:customer_phone, :ip_address, :user_agent, :processed_by, :webhook_attempts,
			:created_at, :updated_at
		)`

	_, err := tx.NamedExecContext(ctx, insertQuery, order)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to insert pending order in transaction: %w", err)
	}

	return order.ID, nil
}
