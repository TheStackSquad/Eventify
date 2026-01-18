//backend/pkg/services/order/order_worker.go

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
			s.CleanupExpiredOrders(ctx, expiry)
		}
	}
}

// CleanupExpiredOrders finds abandoned orders and returns their tickets to the available pool
func (s *OrderServiceImpl) CleanupExpiredOrders(ctx context.Context, expiry time.Duration) {
	threshold := time.Now().UTC().Add(-expiry)

	// 1. Fetch orders stuck in PENDING
	expiredOrders, err := s.OrderRepo.GetExpiredPendingOrders(ctx, threshold)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch expired orders")
		return
	}

	if len(expiredOrders) == 0 {
		return
	}

	for _, order := range expiredOrders {
		// 2. Atomic cleanup transaction
		err := s.OrderRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
			// Update status to EXPIRED (This blocks any late Paystack callbacks)
			if err := s.OrderRepo.UpdateOrderStatusTx(ctx, tx, order.ID, models.OrderStatusExpired); err != nil {
				return err
			}

			// Return the tickets to the event inventory
			if err := s.releaseReservedStockTx(ctx, tx, &order); err != nil {
				return err
			}

			return nil
		})

		if err != nil {
			log.Error().Err(err).Str("ref", order.Reference).Msg("Worker failed to release stock")
			continue
		}
		log.Info().Str("ref", order.Reference).Msg("Stock reclaimed from abandoned order")
	}
}