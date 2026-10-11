//backend/pkg/repository/subscription/queries_maintenance.go

package subscription

import (
	"context"
	"fmt"
	//"time"

	//"github.com/google/uuid"
     "github.com/eventify/backend/pkg/models"
	//"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)


func (r *subscriptionRepository) GetExpired(ctx context.Context) ([]models.Subscription, error) {
    query := `
        SELECT * FROM subscriptions 
        WHERE status = $1 
          AND expires_at IS NOT NULL 
          AND expires_at < NOW()`
    
    var expired []models.Subscription
    err := r.db.SelectContext(ctx, &expired, query, models.SubStatusActive)
    return expired, err
}

// GetNeedingPaymentEmail fetches subscriptions needing payment confirmation
func (r *subscriptionRepository) GetNeedingPaymentEmail(ctx context.Context) ([]EmailRecipient, error) {
	query := `
		SELECT 
			s.id AS subscription_id,
			s.vendor_id,
			v.name AS vendor_name,
			v.owner_id AS user_id,
			u.email AS user_email,
			u.name AS user_name,
			s.tier,
			s.expires_at,
			s.price,
			s.currency
		FROM subscriptions s
		JOIN vendors v ON s.vendor_id = v.id
		JOIN users u ON v.owner_id = u.id
		WHERE s.status = 'active'
		  AND s.payment_success_sent_at IS NULL
		  AND s.last_payment_date IS NOT NULL
		ORDER BY s.last_payment_date ASC
		LIMIT 100
	`

	var recipients []EmailRecipient
	if err := r.db.SelectContext(ctx, &recipients, query); err != nil {
		log.Error().Err(err).Msg("Failed to fetch payment email recipients")
		return nil, err
	}

	return recipients, nil
}

// GetNeedingReminder7D fetches subscriptions expiring in 7 days
func (r *subscriptionRepository) GetNeedingReminder7D(ctx context.Context) ([]EmailRecipient, error) {
	query := `
		SELECT 
			s.id AS subscription_id,
			s.vendor_id,
			v.name AS vendor_name,
			v.owner_id AS user_id,
			u.email AS user_email,
			u.name AS user_name,
			s.tier,
			s.expires_at,
			s.price,
			s.currency
		FROM subscriptions s
		JOIN vendors v ON s.vendor_id = v.id
		JOIN users u ON v.owner_id = u.id
		WHERE s.status = 'active'
		  AND s.auto_renew = true
		  AND s.reminder_7d_sent_at IS NULL
		  AND s.expires_at <= NOW() + INTERVAL '7 days'
		  AND s.expires_at > NOW() + INTERVAL '6 days'
		  AND u.allow_reminder_emails = true
		ORDER BY s.expires_at ASC
		LIMIT 100
	`

	var recipients []EmailRecipient
	if err := r.db.SelectContext(ctx, &recipients, query); err != nil {
		log.Error().Err(err).Msg("Failed to fetch 7-day reminder recipients")
		return nil, err
	}

	return recipients, nil
}

// GetNeedingReminder3D fetches subscriptions expiring in 3 days
func (r *subscriptionRepository) GetNeedingReminder3D(ctx context.Context) ([]EmailRecipient, error) {
	query := `
		SELECT 
			s.id AS subscription_id,
			s.vendor_id,
			v.name AS vendor_name,
			v.owner_id AS user_id,
			u.email AS user_email,
			u.name AS user_name,
			s.tier,
			s.expires_at,
			s.price,
			s.currency
		FROM subscriptions s
		JOIN vendors v ON s.vendor_id = v.id
		JOIN users u ON v.owner_id = u.id
		WHERE s.status = 'active'
		  AND s.auto_renew = true
		  AND s.reminder_3d_sent_at IS NULL
		  AND s.expires_at <= NOW() + INTERVAL '3 days'
		  AND s.expires_at > NOW() + INTERVAL '2 days'
		  AND u.allow_reminder_emails = true
		ORDER BY s.expires_at ASC
		LIMIT 100
	`

	var recipients []EmailRecipient
	if err := r.db.SelectContext(ctx, &recipients, query); err != nil {
		log.Error().Err(err).Msg("Failed to fetch 3-day reminder recipients")
		return nil, err
	}

	return recipients, nil
}

// GetNeedingReminder1D fetches subscriptions expiring in 1 day
func (r *subscriptionRepository) GetNeedingReminder1D(ctx context.Context) ([]EmailRecipient, error) {
	query := `
		SELECT 
			s.id AS subscription_id,
			s.vendor_id,
			v.name AS vendor_name,
			v.owner_id AS user_id,
			u.email AS user_email,
			u.name AS user_name,
			s.tier,
			s.expires_at,
			s.price,
			s.currency
		FROM subscriptions s
		JOIN vendors v ON s.vendor_id = v.id
		JOIN users u ON v.owner_id = u.id
		WHERE s.status = 'active'
		  AND s.auto_renew = true
		  AND s.reminder_1d_sent_at IS NULL
		  AND s.expires_at <= NOW() + INTERVAL '1 day'
		  AND s.expires_at > NOW()
		  AND u.allow_reminder_emails = true
		ORDER BY s.expires_at ASC
		LIMIT 100
	`

	var recipients []EmailRecipient
	if err := r.db.SelectContext(ctx, &recipients, query); err != nil {
		log.Error().Err(err).Msg("Failed to fetch 1-day reminder recipients")
		return nil, err
	}

	return recipients, nil
}

// GetNeedingExpiredNotice fetches expired subscriptions without notice sent
func (r *subscriptionRepository) GetNeedingExpiredNotice(ctx context.Context) ([]EmailRecipient, error) {
	query := `
		SELECT 
			s.id AS subscription_id,
			s.vendor_id,
			v.name AS vendor_name,
			v.owner_id AS user_id,
			u.email AS user_email,
			u.name AS user_name,
			s.tier,
			s.expires_at,
			s.price,
			s.currency
		FROM subscriptions s
		JOIN vendors v ON s.vendor_id = v.id
		JOIN users u ON v.owner_id = u.id
		WHERE s.status = 'expired'
		  AND s.expired_notice_sent_at IS NULL
		ORDER BY s.expires_at DESC
		LIMIT 100
	`

	var recipients []EmailRecipient
	if err := r.db.SelectContext(ctx, &recipients, query); err != nil {
		log.Error().Err(err).Msg("Failed to fetch expired notice recipients")
		return nil, err
	}

	return recipients, nil
}

// UpdateEmailTracking marks emails as sent (follows PaymentUpdateParams pattern)
func (r *subscriptionRepository) UpdateEmailTracking(ctx context.Context, params EmailTrackingParams) error {
	// Build dynamic query based on which fields are provided
	query := `UPDATE subscriptions SET updated_at = NOW()`
	args := []interface{}{}
	argIdx := 1

	if params.PaymentSuccessSentAt != nil {
		query += fmt.Sprintf(`, payment_success_sent_at = $%d`, argIdx)
		args = append(args, params.PaymentSuccessSentAt)
		argIdx++
	}
	if params.Reminder7DSentAt != nil {
		query += fmt.Sprintf(`, reminder_7d_sent_at = $%d`, argIdx)
		args = append(args, params.Reminder7DSentAt)
		argIdx++
	}
	if params.Reminder3DSentAt != nil {
		query += fmt.Sprintf(`, reminder_3d_sent_at = $%d`, argIdx)
		args = append(args, params.Reminder3DSentAt)
		argIdx++
	}
	if params.Reminder1DSentAt != nil {
		query += fmt.Sprintf(`, reminder_1d_sent_at = $%d`, argIdx)
		args = append(args, params.Reminder1DSentAt)
		argIdx++
	}
	if params.ExpiredNoticeSentAt != nil {
		query += fmt.Sprintf(`, expired_notice_sent_at = $%d`, argIdx)
		args = append(args, params.ExpiredNoticeSentAt)
		argIdx++
	}

	query += fmt.Sprintf(` WHERE id = $%d`, argIdx)
	args = append(args, params.SubscriptionID)

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		log.Error().Err(err).Str("subscription_id", params.SubscriptionID.String()).Msg("Failed to update email tracking")
		return err
	}

	return nil
}