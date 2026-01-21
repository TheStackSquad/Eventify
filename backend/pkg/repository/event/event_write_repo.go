// backend/pkg/repository/event/event_write_repo.go

package event

import (
	"context"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// WRITE OPERATIONS

// CreateEvent inserts a new event and returns the generated ID
func (r *postgresEventRepository) CreateEvent(
	ctx context.Context,
	tx *sqlx.Tx,
	event *models.Event,
) (uuid.UUID, error) {
	// Generate ID if not provided
	if event.ID == uuid.Nil {
		event.ID = uuid.New()
	}

	query := `
		INSERT INTO events (
			id, organizer_id, event_title, event_description, category,
			event_type, event_image_url, venue_name, venue_address,
			city, state, country, virtual_platform, meeting_link,
			start_date, end_date, max_attendees, paystack_subaccount_code,
			tags, is_deleted, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16, $17, $18, $19,
			$20, $21, $22
		)
		RETURNING id
	`

	var insertedEventID uuid.UUID

	// Use QueryRowxContext to capture the RETURNING ID
	row := tx.QueryRowxContext(ctx, query,
		event.ID,
		event.OrganizerID,
		event.EventTitle,
		event.EventDescription,
		event.Category,
		event.EventType,
		event.EventImageURL,
		event.VenueName,
		event.VenueAddress,
		event.City,
		event.State,
		event.Country,
		event.VirtualPlatform,
		event.MeetingLink,
		event.StartDate,
		event.EndDate,
		event.MaxAttendees,
		event.PaystackSubaccountCode,
		pq.Array(event.Tags),
		event.IsDeleted,
		event.CreatedAt,
		event.UpdatedAt,
	)

	// Scan the result from the query
	if err := row.Scan(&insertedEventID); err != nil {
		return uuid.Nil, fmt.Errorf("failed to create event and retrieve ID: %w", err)
	}

	event.ID = insertedEventID
	return insertedEventID, nil
}

// CreateTicketTier inserts a single ticket tier
func (r *postgresEventRepository) CreateTicketTier(
	ctx context.Context,
	tx *sqlx.Tx,
	tier *models.TicketTier,
) error {
	// Generate ID if not provided
	if tier.ID == uuid.Nil {
		tier.ID = uuid.New()
	}

	// Ensure available equals (capacity - sold)
	tier.Available = tier.Capacity - tier.Sold

	query := `
		INSERT INTO ticket_tiers (
			id, event_id, name, description, price_kobo,
			capacity, sold, available, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	now := time.Now()
	_, err := tx.ExecContext(ctx, query,
		tier.ID,
		tier.EventID,
		tier.Name,
		tier.Description,
		tier.PriceKobo,
		tier.Capacity,
		tier.Sold,
		tier.Available,
		now,
		now,
	)

	if err != nil {
		return fmt.Errorf("failed to create ticket tier '%s': %w", tier.Name, err)
	}

	return nil
}

// CreateTicketTiers creates multiple ticket tiers for an event
func (r *postgresEventRepository) CreateTicketTiers(
	ctx context.Context,
	tx *sqlx.Tx,
	eventID uuid.UUID,
	tiers []models.TicketTier,
) error {
	for i := range tiers {
		// Link tier to parent event
		tiers[i].EventID = eventID

		if err := r.CreateTicketTier(ctx, tx, &tiers[i]); err != nil {
			return fmt.Errorf("error creating tier at index %d: %w", i, err)
		}
	}
	return nil
}

// DecrementTicketStockTx reserves tickets by decrementing available stock using Tier ID
func (r *postgresEventRepository) DecrementTicketStockTx(
	ctx context.Context,
	tx *sqlx.Tx,
	tierID uuid.UUID,
	quantity int32,
) error {
	// We use the 'available' column in the WHERE clause to ensure the DB constraint 
	// handles concurrency (Atomic update)
	query := `
		UPDATE ticket_tiers 
		SET sold = sold + $1,
			available = available - $1,
			updated_at = NOW()
		WHERE id = $2 
		  AND available >= $1
	`

	result, err := tx.ExecContext(ctx, query, quantity, tierID)
	if err != nil {
		return fmt.Errorf("stock decrement failed: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		// This triggers if the ID is wrong OR if available < quantity
		return fmt.Errorf("insufficient stock or invalid tier ID (requested: %d)", quantity)
	}

	return nil
}
// IncrementTicketStockTx releases reserved tickets back to inventory using the UUID
func (r *postgresEventRepository) IncrementTicketStockTx(
	ctx context.Context,
	tx *sqlx.Tx,
	tierID uuid.UUID,
	quantity int32,
) error {
	query := `
		UPDATE ticket_tiers 
		SET sold = sold - $1,
			available = available + $1,
			updated_at = NOW()
		WHERE id = $2 
			AND sold >= $1
	`

	result, err := tx.ExecContext(ctx, query, quantity, tierID)
	if err != nil {
		return fmt.Errorf("stock increment failed: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("failed to release stock: tier %s not found or invalid sold_count", tierID)
	}

	return nil
}

// UpdateEvent updates an existing event (supports transactions)
func (r *postgresEventRepository) UpdateEvent(
	ctx context.Context,
	tx *sqlx.Tx,
	event *models.Event,
) error {
	query := `
		UPDATE events SET
			event_title = $1,
			event_description = $2,
			category = $3,
			event_type = $4,
			event_image_url = $5,
			venue_name = $6,
			venue_address = $7,
			city = $8,
			state = $9,
			country = $10,
			virtual_platform = $11,
			meeting_link = $12,
			start_date = $13,
			end_date = $14,
			max_attendees = $15,
			tags = $16,
			event_slug = $17,
			updated_at = $18
		WHERE id = $19 AND is_deleted = false
	`

	result, err := tx.ExecContext(ctx, query,
		event.EventTitle,
		event.EventDescription,
		event.Category,
		event.EventType,
		event.EventImageURL,
		event.VenueName,
		event.VenueAddress,
		event.City,
		event.State,
		event.Country,
		event.VirtualPlatform,
		event.MeetingLink,
		event.StartDate,
		event.EndDate,
		event.MaxAttendees,
		pq.Array(event.Tags),
		event.EventSlug,
		time.Now(),
		event.ID,
	)

	if err != nil {
		return fmt.Errorf("failed to update event %s: %w", event.ID, err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("event not found or already deleted")
	}

	return nil
}

// SoftDeleteEvent marks an event as deleted if no tickets have been sold
func (r *postgresEventRepository) SoftDeleteEvent(
	ctx context.Context,
	eventID uuid.UUID,
) error {
	query := `
		UPDATE events 
		SET is_deleted = true, 
			deleted_at = $1, 
			updated_at = $1
		WHERE id = $2 
			AND is_deleted = false
			AND NOT EXISTS (
				SELECT 1 
				FROM ticket_tiers 
				WHERE event_id = $2 
					AND sold > 0
			)
	`

	result, err := r.db.ExecContext(ctx, query, time.Now(), eventID)
	if err != nil {
		return fmt.Errorf("database error during soft delete: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("cannot delete event: event not found, already deleted, or has active ticket sales")
	}

	return nil
}

// SyncTicketTiers synchronizes ticket tiers (inserts, updates, deletes)
func (r *postgresEventRepository) SyncTicketTiers(
	ctx context.Context,
	tx *sqlx.Tx,
	eventID uuid.UUID,
	incomingTiers []models.TicketTier,
) error {
	// Get existing tiers
	var existingTiers []models.TicketTier
	err := tx.SelectContext(ctx, &existingTiers,
		"SELECT id, sold FROM ticket_tiers WHERE event_id = $1", eventID)
	if err != nil {
		return fmt.Errorf("failed to fetch existing tiers for sync: %w", err)
	}

	// Create lookup maps
	existingMap := make(map[uuid.UUID]models.TicketTier)
	for _, et := range existingTiers {
		existingMap[et.ID] = et
	}

	incomingMap := make(map[uuid.UUID]bool)
	for _, it := range incomingTiers {
		if it.ID != uuid.Nil {
			incomingMap[it.ID] = true
		}
	}

	// Handle deletions
	for _, et := range existingTiers {
		if !incomingMap[et.ID] {
			// Cannot delete tier if tickets were sold
			if et.Sold > 0 {
				return fmt.Errorf("cannot delete tier %s because tickets have already been sold", et.ID)
			}
			_, err := tx.ExecContext(ctx, "DELETE FROM ticket_tiers WHERE id = $1", et.ID)
			if err != nil {
				return fmt.Errorf("failed to delete removed tier: %w", err)
			}
		}
	}

	// Handle updates and inserts
	for i := range incomingTiers {
		tier := &incomingTiers[i]
		tier.EventID = eventID
		tier.Available = tier.Capacity - tier.Sold // Maintain consistency

		if _, exists := existingMap[tier.ID]; exists && tier.ID != uuid.Nil {
			// Update existing tier
			query := `
				UPDATE ticket_tiers SET
					name = $1, description = $2, price_kobo = $3,
					capacity = $4, sold = $5, available = $6, updated_at = NOW()
				WHERE id = $7 AND event_id = $8
			`
			_, err := tx.ExecContext(ctx, query,
				tier.Name, tier.Description, tier.PriceKobo,
				tier.Capacity, tier.Sold, tier.Available,
				tier.ID, eventID,
			)
			if err != nil {
				return fmt.Errorf("failed to update tier %s: %w", tier.Name, err)
			}
		} else {
			// Insert new tier
			if err := r.CreateTicketTier(ctx, tx, tier); err != nil {
				return err
			}
		}
	}

	return nil
}