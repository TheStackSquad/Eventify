//backend/pkg/services/subscription/subscription_expiry.go
package subscription

import (
	"context"
	"time"
	"fmt"
	"database/sql"
	"runtime/debug"

	"github.com/eventify/backend/pkg/models"
	serviceemail "github.com/eventify/backend/pkg/services/email"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

// backend/pkg/services/subscription/subscription_expiry.go

func (s *subscriptionServiceImpl) StartExpiryWorker(ctx context.Context, checkInterval time.Duration) {
	log.Info().Dur("interval", checkInterval).Msg("Starting subscription worker")

	// One pass shortly after boot, so a restart never leaves work waiting for the first full interval.
	boot := time.NewTimer(30 * time.Second)
	defer boot.Stop()
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Subscription worker shutting down")
			return
		case <-boot.C:
			s.runAllTasksSafely(ctx)
		case <-ticker.C:
			s.runAllTasksSafely(ctx)
		}
	}
}

// runAllTasksSafely keeps a bug in one pass from taking the whole API down.
func (s *subscriptionServiceImpl) runAllTasksSafely(ctx context.Context) {
	defer func() {
		if p := recover(); p != nil {
			log.Error().Interface("panic", p).Str("stack", string(debug.Stack())).
				Msg("CRITICAL: subscription worker pass panicked; it runs again next interval")
		}
	}()
	s.runAllTasks(ctx)
}

// alertPaymentsNeedingReview makes held payments impossible to miss: money was taken and nothing was delivered.

func (s *subscriptionServiceImpl) alertPaymentsNeedingReview(ctx context.Context) error {
	return s.subscriptionRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
		var held []struct {
			Reference  string         `db:"reference"`
			AmountKobo int64          `db:"amount_kobo"`
			PaidKobo   sql.NullInt64  `db:"paid_amount_kobo"`
			Reason     sql.NullString `db:"review_reason"`
			CreatedAt  time.Time      `db:"created_at"`
		}
		if err := tx.SelectContext(ctx, &held, `
			SELECT reference, amount_kobo, paid_amount_kobo, review_reason, created_at
			FROM subscription_payments WHERE status = 'needs_review' ORDER BY created_at LIMIT 50`); err != nil {
			return err
		}
		for _, h := range held {
			detail := fmt.Sprintf("expected %d kobo, paid %d kobo: %s (held since %s)",
				h.AmountKobo, h.PaidKobo.Int64, h.Reason.String, h.CreatedAt.UTC().Format(time.RFC3339))
			_ = serviceemail.QueueAdminAlert(ctx, tx, "payment_held", h.Reference, detail)
		}
		return nil
	})
}

// runAllTasks orchestrates all subscription maintenance tasks
func (s *subscriptionServiceImpl) runAllTasks(ctx context.Context) {
	log.Info().Msg("Running subscription tasks")

	// Task 0: confirm payments that no webhook or redirect confirmed
	if err := s.reconcilePayments(ctx); err != nil {
		log.Error().Err(err).Msg("Payment reconciliation failed")
	}

	// Task 1: Expire old subscriptions
	if err := s.expireOldSubscriptions(ctx); err != nil {
		log.Error().Err(err).Msg("Expiry task failed")
	}

	// Task 2: Send payment success emails
	if err := s.sendPaymentSuccessEmails(ctx); err != nil {
		log.Error().Err(err).Msg("Payment email task failed")
	}

	// Task 3: Send reminder emails
	if err := s.sendReminderEmails(ctx); err != nil {
		log.Error().Err(err).Msg("Reminder email task failed")
	}

	// Task 4: Send expired notices
	if err := s.sendExpiredNotices(ctx); err != nil {
		log.Error().Err(err).Msg("Expired notice task failed")
	}

		// Task 5: money taken but nothing delivered must never go unnoticed
	if err := s.alertPaymentsNeedingReview(ctx); err != nil {
		log.Error().Err(err).Msg("Review alert task failed")
	}

	log.Info().Msg("Subscription tasks completed")
}

// expireOldSubscriptions (keep existing implementation unchanged)
func (s *subscriptionServiceImpl) expireOldSubscriptions(ctx context.Context) error {
	expired, err := s.subscriptionRepo.GetExpired(ctx)
	if err != nil {
		return err
	}

	if len(expired) == 0 {
		return nil
	}

	for _, sub := range expired {
		if err := s.processExpiredSubscription(ctx, sub.ID.String(), sub.VendorID.String()); err != nil {
			log.Error().Err(err).Str("subID", sub.ID.String()).Msg("Failed to expire")
			continue
		}
	}
	return nil
}

// processExpiredSubscription (keep existing implementation unchanged)
func (s *subscriptionServiceImpl) processExpiredSubscription(ctx context.Context, subID, vendorID string) error {
	return s.subscriptionRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
		// Same lock order as SettlePayment (vendor first), so the two can never deadlock.
		var one int
		if err := tx.QueryRowContext(ctx, `SELECT 1 FROM vendors WHERE id = $1 FOR NO KEY UPDATE`, vendorID).Scan(&one); err != nil {
			return err
		}
		// Guarded: a row renewed after GetExpired ran must not be expired.
		// The vendor tier follows via trigger_sync_vendor_tier.
		_, err := tx.ExecContext(ctx, `
			UPDATE subscriptions SET status = $1, updated_at = NOW()
			WHERE id = $2 AND status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()`,
			models.SubStatusExpired, subID)
		return err
	})
}