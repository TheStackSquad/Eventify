//backend/pkg/services/subscription/subscription_reconcile.go


package subscription

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/services/paystack"
	"github.com/rs/zerolog/log"
)

const (
	reconcileMinAge = 10 * time.Minute // let the webhook and the redirect go first
	reconcileMaxAge = 72 * time.Hour   // after this an unpaid checkout is abandoned
	reconcileBatch  = 50
)

// reconcilePayments confirms with Paystack any payment that no webhook or
// redirect confirmed, then retires checkouts nobody completed.
func (s *subscriptionServiceImpl) reconcilePayments(ctx context.Context) error {
	now := time.Now().UTC()
	refs, err := s.subscriptionRepo.ListInitiatedBetween(ctx, now.Add(-reconcileMaxAge), now.Add(-reconcileMinAge), reconcileBatch)
	if err != nil {
		return fmt.Errorf("list initiated payments: %w", err)
	}

	for _, ref := range refs {
		err := s.settle(ctx, ref)
		switch {
		case err == nil:
			log.Warn().Str("reference", ref).Msg("♻️ Reconciled a payment that no webhook or redirect confirmed")
		case errors.Is(err, ErrPaymentNotSuccessful), errors.Is(err, paystack.ErrTransactionNotFound), errors.Is(err, ErrPaymentNeedsReview):
			// not paid (yet) or already parked: nothing to do
		default:
			log.Error().Err(err).Str("reference", ref).Msg("Reconciliation attempt failed; will retry next run")
		}
	}

	if n, err := s.subscriptionRepo.AbandonStalePayments(ctx, now.Add(-reconcileMaxAge)); err != nil {
		return fmt.Errorf("abandon stale payments: %w", err)
	} else if n > 0 {
		log.Info().Int64("count", n).Msg("Retired abandoned checkouts")
	}

	return nil
}