//backend/pkg/repository/subscription/queries_lifecycle.go

package subscription

import (
    "context"
    "database/sql"
    "fmt"
    "time"
	"github.com/jmoiron/sqlx"

    "github.com/eventify/backend/pkg/models"
    "github.com/google/uuid"
)

// 1. Add the Transaction Helper to your Subscription Repo
func (r *subscriptionRepository) RunInTransaction(ctx context.Context, fn func(tx *sqlx.Tx) error) error {
	tx, err := r.db.BeginTxx(ctx, nil)
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

// 2. Updated Atomic Update Method
func (r *subscriptionRepository) UpdateAfterPayment(ctx context.Context, id uuid.UUID, params PaymentUpdateParams) error {
    return r.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
        // Removed 'FOR UPDATE NOWAIT' - UPDATE locks the row automatically
        query := `
            UPDATE subscriptions 
            SET status = $1, 
                payment_reference = $2, 
                payment_method = $3, 
                last_payment_date = $4, 
                next_payment_date = $5, 
                expires_at = $6, 
                updated_at = NOW()
            WHERE id = $7 AND status = 'pending'
            RETURNING vendor_id, tier`

        var vendorID uuid.UUID
        var tier string
        
        err := tx.QueryRowContext(ctx, query, 
            params.Status, params.PaymentReference, params.PaymentMethod,
            params.LastPaymentDate, params.NextPaymentDate, params.ExpiresAt, id,
        ).Scan(&vendorID, &tier)

        if err != nil {
            if err == sql.ErrNoRows {
                // This is where it would go if the subscription was ALREADY active
                // (e.g., the webhook beat the user redirect). We return nil to be idempotent.
                return nil 
            }
            return err
        }

        // Sync the vendor tier
        vendorQuery := `UPDATE vendors SET subscription_tier = $1, updated_at = NOW() WHERE id = $2`
        _, err = tx.ExecContext(ctx, vendorQuery, tier, vendorID)
        return err
    })
}

const createSubscriptionQuery = `
INSERT INTO subscriptions (
	id, vendor_id, tier, status, starts_at, expires_at,
	auto_renew, price, currency,
	payment_reference, payment_method,
	last_payment_date, next_payment_date,
	created_at, updated_at
) VALUES (
	$1, $2, $3, $4, $5, $6,
	$7, $8, $9,
	$10, $11,
	$12, $13,
	$14, $15
)
`
func (r *subscriptionRepository) Create(ctx context.Context, sub *models.Subscription) (uuid.UUID, error) {
	if sub.ID == uuid.Nil {
		sub.ID = uuid.New()
	}

	now := time.Now().UTC()
	if sub.CreatedAt.IsZero() {
		sub.CreatedAt = now
	}
	if sub.UpdatedAt.IsZero() {
		sub.UpdatedAt = now
	}

	_, err := r.db.ExecContext(ctx, createSubscriptionQuery,
		sub.ID,
		sub.VendorID,
		sub.Tier,
		sub.Status,
		sub.StartsAt,
		sub.ExpiresAt,
		sub.AutoRenew,
		sub.Price,
		sub.Currency,
		sub.PaymentReference,
		sub.PaymentMethod,
		sub.LastPaymentDate,
		sub.NextPaymentDate,
		sub.CreatedAt,
		sub.UpdatedAt,
	)
	if err != nil {
		return uuid.Nil, fmt.Errorf("subscription repo create: %w", err)
	}

	return sub.ID, nil
}

const updateStatusQuery = `
UPDATE subscriptions
SET status = $1, updated_at = $2
WHERE id = $3
`

func (r *subscriptionRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status models.SubscriptionStatus) error {
	// Fetch current subscription to validate state transition
	sub, err := r.GetByID(ctx, id)
	if err != nil {
		return err
	}

	// Enforce state machine: prevent invalid transitions
	if !sub.CanTransitionTo(status) {
		return fmt.Errorf("invalid state transition: %s → %s not allowed", sub.Status, status)
	}

	result, err := r.db.ExecContext(ctx, updateStatusQuery, status, time.Now().UTC(), id)
	if err != nil {
		return fmt.Errorf("subscription repo update status: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("subscription repo update status rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("subscription repo update status: no subscription found with id %s", id)
	}

	return nil
}

func (r *subscriptionRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Subscription, error) {
	query := `SELECT * FROM subscriptions WHERE id = $1`
	
	var sub models.Subscription
	err := r.db.GetContext(ctx, &sub, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("subscription not found: %s", id)
		}
		return nil, err
	}
	
	return &sub, nil
}

func (r *subscriptionRepository) IncrementWebhookAttempts(ctx context.Context, reference string) error {
	// Using payment_reference since that's what Paystack sends back
	query := `
		UPDATE subscriptions SET 
			webhook_attempts = COALESCE(webhook_attempts, 0) + 1,
			updated_at = $1
		WHERE payment_reference = $2
	`

	result, err := r.db.ExecContext(ctx, query, time.Now().UTC(), reference)
	if err != nil {
		return fmt.Errorf("failed to increment webhook attempts: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("subscription reference %s not found", reference)
	}

	return nil
}

// GetByReference fetches a subscription by its payment_reference
func (r *subscriptionRepository) GetByReference(ctx context.Context, reference string) (*models.Subscription, error) {
	query := `SELECT * FROM subscriptions WHERE payment_reference = $1`
	var sub models.Subscription
	if err := r.db.GetContext(ctx, &sub, query, reference); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("subscription not found for reference: %s", reference)
		}
		return nil, err
	}
	return &sub, nil
}

// GetActiveByVendorID fetches the active subscription for a vendor
func (r *subscriptionRepository) GetActiveByVendorID(ctx context.Context, vendorID uuid.UUID) (*models.Subscription, error) {
	query := `
		SELECT * FROM subscriptions
		WHERE vendor_id = $1 AND status = 'active'
		ORDER BY created_at DESC
		LIMIT 1
	`
	
	var sub models.Subscription
	if err := r.db.GetContext(ctx, &sub, query, vendorID); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No active subscription found
		}
		return nil, err
	}
	
	return &sub, nil
}