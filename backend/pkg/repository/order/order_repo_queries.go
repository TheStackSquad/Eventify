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
// backend/pkg/repository/postgres/postgres_order_repository.go

func (r *PostgresOrderRepository) loadOrderRelations(ctx context.Context, order *models.Order) error {
	itemsQuery := `
		SELECT 
			oi.id, 
			oi.order_id, 
			oi.event_id, 
			oi.ticket_tier_id, 
			oi.tier_name, 
			oi.quantity, 
			oi.unit_price, 
			oi.subtotal,
			e.event_title as event_title,
			e.start_date as event_start_date,
			e.end_date as event_end_date,
			COALESCE(e.city, 'N/A') as event_city,
			COALESCE(e.state, 'N/A') as event_state,
			COALESCE(e.venue_name, 'TBD') as event_venue,
			COALESCE(e.venue_address, 'No Address Provided') as event_address,
			e.event_image_url as event_thumbnail
		FROM order_items oi
		LEFT JOIN events e ON oi.event_id = e.id
		WHERE oi.order_id = $1
		ORDER BY oi.id
	`
	
	var items []models.OrderItem
	if err := r.DB.SelectContext(ctx, &items, itemsQuery, order.ID); err != nil {
		return fmt.Errorf("failed to load order items: %w", err)
	}
	order.Items = items

	return nil
}