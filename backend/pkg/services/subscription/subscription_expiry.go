//backend/pkg/services/subscription/subscription_expiry.go
package subscription

import (
	"context"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

// backend/pkg/services/subscription/subscription_expiry.go

func (s *subscriptionServiceImpl) StartExpiryWorker(ctx context.Context, checkInterval time.Duration) {
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()

	log.Info().Dur("interval", checkInterval).Msg("Starting subscription worker")

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Subscription worker shutting down")
			return
		case <-ticker.C:
			s.runAllTasks(ctx)
		}
	}
}

// runAllTasks orchestrates all subscription maintenance tasks
func (s *subscriptionServiceImpl) runAllTasks(ctx context.Context) {
	log.Info().Msg("Running subscription tasks")

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
		_, err := tx.ExecContext(ctx,
			`UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2`,
			models.SubStatusExpired, subID,
		)
		if err != nil {
			return err
		}

		_, err = tx.ExecContext(ctx,
			`UPDATE vendors SET subscription_tier = $1, updated_at = NOW() WHERE id = $2`,
			models.TierFree, vendorID,
		)
		return err
	})
}