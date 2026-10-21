// backend/pkg/services/order/order_worker.go

package order

import (
	"context"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

// StartStockReleaseWorker begins a background loop to reclaim expired inventory.
// interval: how often the worker checks for expired orders.
// expiry: how old a pending order must be to be considered abandoned.
func (s *OrderServiceImpl) StartStockReleaseWorker(ctx context.Context, interval time.Duration, expiry time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	log.Info().Msgf("Stock Release Worker started (Interval: %v, Expiry: %v)", interval, expiry)

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Stock Release Worker shutting down...")
			return
		case <-ticker.C:
			if err := s.ReleaseExpiredStock(ctx, expiry); err != nil {
				log.Error().Err(err).Msg("Stock release worker failed to release expired stock")
			}
		}
	}
}

// ReleaseExpiredStock finds abandoned orders and returns their tickets to the available pool
func (s *OrderServiceImpl) ReleaseExpiredStock(ctx context.Context, expiry time.Duration) error {
	threshold := time.Now().UTC().Add(-expiry)

	expiredOrders, err := s.OrderRepo.GetExpiredPendingOrders(ctx, threshold)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch expired orders")
		return err
	}
	if len(expiredOrders) == 0 {
		return nil
	}

	for i := range expiredOrders {
		order := expiredOrders[i]
		released := false

		err := s.OrderRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
			released = false
			moved, err := s.OrderRepo.TransitionPendingOrderTx(ctx, tx, order.ID, models.OrderSubStatusExpired)
			if err != nil {
				return err
			}
			if !moved {
				return nil // paid or closed in the meantime: leave its stock alone
			}
			released = true
			return s.releaseReservedStockTx(ctx, tx, &order)
		})

		switch {
		case err != nil:
			log.Error().Err(err).Str("ref", order.Reference).Msg("Worker failed to release stock")
		case released:
			log.Info().Str("ref", order.Reference).Msg("Stock reclaimed from abandoned order")
		default:
			log.Info().Str("ref", order.Reference).Msg("Order was paid or closed before expiry; stock left untouched")
		}
	}
	return nil
}
