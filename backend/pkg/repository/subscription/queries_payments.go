// backend/pkg/repository/subscription/queries_payments.go

package subscription

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/models"
)

var ErrPaymentNotFound = errors.New("subscription payment not found")

const paymentColumns = `reference, vendor_id, subscription_id, tier, amount_kobo, currency, status,
	paid_amount_kobo, paid_currency, channel, review_reason, webhook_attempts,
	paid_at, applied_at, created_at, updated_at`

// CreatePayment records the payment intent BEFORE the customer reaches Paystack.
func (r *subscriptionRepository) CreatePayment(ctx context.Context, p *models.SubscriptionPayment) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO subscription_payments (reference, vendor_id, tier, amount_kobo, currency, status)
		VALUES ($1, $2, $3, $4, $5, 'initiated')`,
		p.Reference, p.VendorID, p.Tier, p.AmountKobo, p.Currency)
	if err != nil {
		return fmt.Errorf("subscription repo create payment: %w", err)
	}
	p.Status = models.PaymentInitiated
	return nil
}

func (r *subscriptionRepository) GetPaymentByReference(ctx context.Context, reference string) (*models.SubscriptionPayment, error) {
	var p models.SubscriptionPayment
	err := r.db.GetContext(ctx, &p,
		`SELECT `+paymentColumns+` FROM subscription_payments WHERE reference = $1`, reference)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrPaymentNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("subscription repo get payment: %w", err)
	}
	return &p, nil
}

func (r *subscriptionRepository) MarkPaymentFailed(ctx context.Context, reference, reason string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE subscription_payments SET status = 'failed', review_reason = $2
		WHERE reference = $1 AND status = 'initiated'`, reference, reason)
	if err != nil {
		return fmt.Errorf("subscription repo mark payment failed: %w", err)
	}
	return nil
}

func (r *subscriptionRepository) ListInitiatedBetween(ctx context.Context, createdAfter, createdBefore time.Time, limit int) ([]string, error) {
	var refs []string
	err := r.db.SelectContext(ctx, &refs, `
		SELECT reference FROM subscription_payments
		WHERE status = 'initiated' AND created_at > $1 AND created_at <= $2
		ORDER BY created_at ASC LIMIT $3`, createdAfter, createdBefore, limit)
	if err != nil {
		return nil, fmt.Errorf("subscription repo list initiated: %w", err)
	}
	return refs, nil
}

func (r *subscriptionRepository) AbandonStalePayments(ctx context.Context, createdBefore time.Time) (int64, error) {
	res, err := r.db.ExecContext(ctx, `
		UPDATE subscription_payments
		SET status = 'failed', review_reason = 'abandoned: unpaid after retention window'
		WHERE status = 'initiated' AND created_at <= $1`, createdBefore)
	if err != nil {
		return 0, fmt.Errorf("subscription repo abandon stale: %w", err)
	}
	return res.RowsAffected()
}