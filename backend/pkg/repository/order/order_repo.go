// backend/pkg/repository/order/order_repo.go

package order

import (
	"context"
	"errors"
	"time"
	"fmt"
	"math/rand" 
	
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog/log"
	"github.com/eventify/backend/pkg/models"
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
	TransitionPendingOrderTx(ctx context.Context, tx *sqlx.Tx, orderID uuid.UUID, to models.OrderStatus) (bool, error)

	SavePendingOrderTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) (uuid.UUID, error)
	UpdateOrderToPaidTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error
	InsertOrderItemsTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error
	InsertTicketsTx(ctx context.Context, tx *sqlx.Tx, order *models.Order, tickets []models.Ticket) error
	QueueEmailTx(ctx context.Context, tx *sqlx.Tx, outbox *models.EmailOutbox) error
	QueueEmailOnceTx(ctx context.Context, tx *sqlx.Tx, outbox *models.EmailOutbox, dedupeKey string) error
	LoadOrderRelations(ctx context.Context, order *models.Order) error
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
const (
	txMaxAttempts = 3
	txLockTimeout = "3s"
)

// isRetryableTxError: Postgres deadlock (40P01) and serialization (40001) failures.
// The server already rolled the transaction back, so it is safe to run again.
func isRetryableTxError(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "40P01" || pgErr.Code == "40001"
	}
	return false
}

func (r *PostgresOrderRepository) RunInTransaction(ctx context.Context, fn func(tx *sqlx.Tx) error) error {
	var err error
	for attempt := 1; attempt <= txMaxAttempts; attempt++ {
		err = r.runTxOnce(ctx, fn)
		if err == nil || !isRetryableTxError(err) || attempt == txMaxAttempts {
			return err
		}
		log.Warn().Err(err).Int("attempt", attempt).Msg("Transaction hit a deadlock or serialization failure; retrying")
		select {
		case <-ctx.Done():
			return err
		case <-time.After(time.Duration(10*attempt+rand.Intn(20)) * time.Millisecond): // #nosec G404 -- retry jitter only
		}
	}
	return err
}
// runTxOnce uses a NAMED result so a failed Commit is actually returned (F-011).
func (r *PostgresOrderRepository) runTxOnce(ctx context.Context, fn func(tx *sqlx.Tx) error) (err error) {
	tx, err := r.DB.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
		if err != nil {
			_ = tx.Rollback()
			return
		}
		err = tx.Commit()
	}()
	// Fail fast instead of waiting on a row lock until the request times out.
	if _, err = tx.ExecContext(ctx, "SET LOCAL lock_timeout = '"+txLockTimeout+"'"); err != nil {
		return err
	}
	return fn(tx)
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
			final_total, amount_paid, paystack_fee, app_profit, customer_email, customer_first_name, customer_last_name,
            customer_phone, ip_address, user_agent, processed_by, webhook_attempts,
            created_at, updated_at
        ) VALUES (
            :id, :user_id, :guest_id, :reference, :status, :subtotal, :service_fee, :vat_amount,
			:final_total, :amount_paid, :paystack_fee, :app_profit, :customer_email, :customer_first_name, :customer_last_name,
            :customer_phone, :ip_address, :user_agent, :processed_by, :webhook_attempts,
            :created_at, :updated_at
        )`

	_, err := tx.NamedExecContext(ctx, insertQuery, order)
	return order.ID, err
}

func (r *PostgresOrderRepository) GetExpiredPendingOrders(ctx context.Context, threshold time.Time) ([]models.Order, error) {
    var orders []models.Order
    
    // 1. Fetch the base orders
    query := `SELECT * FROM orders WHERE status = 'pending' AND created_at <= $1 LIMIT 100`
    err := r.DB.SelectContext(ctx, &orders, query, threshold)
    if err != nil {
        return nil, err
    }

    if len(orders) == 0 {
        return orders, nil
    }

    // 2. Collect all Order IDs for batch hydration
    orderIDs := make([]uuid.UUID, len(orders))
    orderMap := make(map[uuid.UUID]*models.Order)
    for i := range orders {
        orderIDs[i] = orders[i].ID
        orderMap[orders[i].ID] = &orders[i]
    }

    // 3. Fetch all items for these orders in ONE query (Efficient)
    var allItems []models.OrderItem
    itemsQuery, args, err := sqlx.In(`SELECT * FROM order_items WHERE order_id IN (?)`, orderIDs)
    if err != nil {
        return nil, err
    }
    itemsQuery = r.DB.Rebind(itemsQuery)
    
    err = r.DB.SelectContext(ctx, &allItems, itemsQuery, args...)
    if err != nil {
        return nil, err
    }

    // 4. Distribute items to their respective orders
    for _, item := range allItems {
        if order, ok := orderMap[item.OrderID]; ok {
            order.Items = append(order.Items, item)
        }
    }

    return orders, nil
}

func (r *PostgresOrderRepository) QueueEmailTx(ctx context.Context, tx *sqlx.Tx, outbox *models.EmailOutbox) error {
	query := `
		INSERT INTO email_outbox (recipient_email, subject, template_type, payload, status)
		VALUES (:recipient_email, :subject, :template_type, :payload, :status)`
	
	_, err := tx.NamedExecContext(ctx, query, outbox)
	if err != nil {
		return fmt.Errorf("failed to queue email: %w", err)
	}
	return nil
}

// QueueEmailOnceTx queues an email in the caller's transaction. A second call with the same
// dedupeKey is ignored, so one order can never queue two ticket emails.
func (r *PostgresOrderRepository) QueueEmailOnceTx(ctx context.Context, tx *sqlx.Tx, o *models.EmailOutbox, dedupeKey string) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO email_outbox (recipient_email, subject, template_type, payload, status, dedupe_key)
		VALUES ($1, $2, $3, $4::jsonb, 'pending', $5)
		ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
		o.RecipientEmail, o.Subject, o.TemplateType, string(o.Payload), dedupeKey)
	if err != nil {
		return fmt.Errorf("failed to queue email: %w", err)
	}
	return nil
}