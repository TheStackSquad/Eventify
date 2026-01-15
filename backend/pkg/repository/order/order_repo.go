// backend/pkg/repository/order/order_repo.go

package order

import (
	"context"
	"errors"
	"time"
	"eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// StockReduction is used by the Service layer
type StockReduction struct {
	EventID      uuid.UUID
	TicketTierID uuid.UUID
	TierName     string
	Quantity     int32
}

type OrderRepository interface {
	RunInTransaction(ctx context.Context, fn func(tx *sqlx.Tx) error) error
	GetOrderByReference(ctx context.Context, reference string) (*models.Order, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.Order, error)
	UpdateOrderStatus(ctx context.Context, id uuid.UUID, newStatus models.OrderStatus) error
	UpdateOrderStatusTx(ctx context.Context, tx *sqlx.Tx, orderID uuid.UUID, status models.OrderStatus) error
	IncrementWebhookAttempts(ctx context.Context, reference string) error
	SavePendingOrder(ctx context.Context, order *models.Order) (uuid.UUID, error)
	GetExpiredPendingOrders(ctx context.Context, threshold time.Time) ([]models.Order, error)

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

// --- IMPLEMENTATIONS ---

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

func (r *PostgresOrderRepository) SavePendingOrderTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) (uuid.UUID, error) {
	if order == nil {
		return uuid.Nil, errors.New("order object cannot be nil")
	}
	if order.ID == uuid.Nil {
		order.ID = uuid.New()
	}

	now := time.Now().UTC()
	order.CreatedAt = now
	order.UpdatedAt = now

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
	return order.ID, err
}

func (r *PostgresOrderRepository) GetExpiredPendingOrders(ctx context.Context, threshold time.Time) ([]models.Order, error) {
	var orders []models.Order
	query := `SELECT * FROM orders WHERE status = 'pending' AND created_at <= $1`
	err := r.DB.SelectContext(ctx, &orders, query, threshold)
	return orders, err
}

