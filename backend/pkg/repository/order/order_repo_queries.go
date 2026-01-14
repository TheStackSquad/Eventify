// backend/pkg/repository/ order/order_repo_queries.go

package order

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"eventify/backend/pkg/models"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// GetOrderByReference retrieves an order by its payment reference
func (r *PostgresOrderRepository) GetOrderByReference(ctx context.Context, reference string) (*models.Order, error) {
	var order models.Order
	query := `SELECT * FROM orders WHERE reference = $1`

	err := r.DB.GetContext(ctx, &order, query, reference)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Optionally load related items and payments
	if err := r.loadOrderRelations(ctx, &order); err != nil {
		log.Warn().Err(err).Str("order_id", order.ID.String()).Msg("Failed to load order relations")
		// Don't fail the request, just log the warning
	}

	return &order, nil
}

// GetByID retrieves an order by its unique ID
func (r *PostgresOrderRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Order, error) {
	var order models.Order
	query := `SELECT * FROM orders WHERE id = $1`

	err := r.DB.GetContext(ctx, &order, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Optionally load related items and payments
	if err := r.loadOrderRelations(ctx, &order); err != nil {
		log.Warn().Err(err).Str("order_id", order.ID.String()).Msg("Failed to load order relations")
	}

	return &order, nil
}

// loadOrderRelations loads order items and payment records for an order
func (r *PostgresOrderRepository) loadOrderRelations(ctx context.Context, order *models.Order) error {
	// Load order items
	itemsQuery := `
		SELECT id, order_id, event_id, ticket_tier_id, tier_name, quantity, unit_price, subtotal
		FROM order_items 
		WHERE order_id = $1
		ORDER BY id
	`
	var items []models.OrderItem
	if err := r.DB.SelectContext(ctx, &items, itemsQuery, order.ID); err != nil {
		return fmt.Errorf("failed to load order items: %w", err)
	}
	order.Items = items

	return nil
}