// backend/pkg/repository/order/order_repo_idempotency.go
package order

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

// FindLiveByIdempotencyKey returns the pending, processing or paid order this caller opened with this key, or nil.
// The caller is the user id when logged in, otherwise the guest id. The WHERE clause repeats the expression of
// idx_orders_idempotency_live so the lookup is one index probe.
func (r *PostgresOrderRepository) FindLiveByIdempotencyKey(ctx context.Context, userID *uuid.UUID, guestID, key string) (*models.Order, error) {
	identity := guestID
	if userID != nil {
		identity = userID.String()
	}
	if identity == "" {
		return nil, nil
	}
	var o models.Order
	err := r.DB.GetContext(ctx, &o, `
		SELECT * FROM orders
		WHERE coalesce(user_id::text, guest_id) = $1
		  AND idempotency_key = $2
		  AND status IN ('pending', 'processing', 'success')
		ORDER BY created_at DESC
		LIMIT 1`, identity, key)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find order by idempotency key: %w", err)
	}
	return &o, nil
}

// SetAuthorizationURL stores the payment link so a replay with the same Idempotency-Key can return it.
func (r *PostgresOrderRepository) SetAuthorizationURL(ctx context.Context, orderID uuid.UUID, url string) error {
	if _, err := r.DB.ExecContext(ctx, `UPDATE orders SET authorization_url = $1 WHERE id = $2`, url, orderID); err != nil {
		return fmt.Errorf("store authorization url for order %s: %w", orderID, err)
	}
	return nil
}
