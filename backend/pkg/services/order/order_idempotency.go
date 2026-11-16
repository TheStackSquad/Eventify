// backend/pkg/services/order/order_idempotency.go
package order

import (
	"context"
	"errors"
	"fmt"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

var (
	// ErrIdempotencyInProgress: another request with the same key is still being processed. The client retries shortly.
	ErrIdempotencyInProgress = errors.New("a request with this idempotency key is still being processed")
	// ErrIdempotencyKeyReused: the key was already used for a different request.
	ErrIdempotencyKeyReused = errors.New("this idempotency key was already used for a different request")
)

const idempotencyIndex = "idx_orders_idempotency_live"

// replayIdempotent looks for a live order opened with the same key by the same caller.
// found=false means nothing exists and the caller should create the order. found=true means the answer is final:
// either the original order (Replayed set) or an error.
func (s *OrderServiceImpl) replayIdempotent(ctx context.Context, req *models.OrderInitializationRequest, userID *uuid.UUID, guestID string) (order *models.Order, authURL string, found bool, err error) {
	existing, err := s.OrderRepo.FindLiveByIdempotencyKey(ctx, userID, guestID, req.IdempotencyKey)
	if err != nil {
		return nil, "", false, fmt.Errorf("idempotency lookup: %w", err)
	}
	if existing == nil {
		return nil, "", false, nil
	}
	if existing.IdempotencyHash.Valid && existing.IdempotencyHash.String != req.IdempotencyHash() {
		return nil, "", true, ErrIdempotencyKeyReused
	}
	if !existing.AuthorizationURL.Valid || existing.AuthorizationURL.String == "" {
		return nil, "", true, ErrIdempotencyInProgress
	}
	existing.Replayed = true
	return existing, existing.AuthorizationURL.String, true, nil
}

// isIdempotencyConflict reports whether err is the unique violation of idx_orders_idempotency_live:
// a concurrent request with the same key inserted its order first.
func isIdempotencyConflict(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == idempotencyIndex
}
