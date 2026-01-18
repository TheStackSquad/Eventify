// backend/pkg/repository/event/event_write_repo.go

package event

import (
	"context"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// WRITE OPERATIONS

// CreateEvent (within transaction)
// CreateEvent (within transaction) - FIX: Use QueryRowxContext to capture the RETURNING ID
func (r *postgresEventRepository) CreateEvent(
	ctx context.Context,
	tx *sqlx.Tx,
	event *models.Event,
) (uuid.UUID, error) { 
	
	// Ensure ID is generated before the insert attempt, but rely on DB for confirmation
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
    
    // --- START FIX ---
	row := tx.QueryRowxContext(ctx, query, // Use QueryRowxContext instead of ExecContext
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
    // --- END FIX ---
	
	event.ID = insertedEventID 
	
	return insertedEventID, nil // <-- Return the confirmed ID
}

func (r *postgresEventRepository) CreateTicketTier(
	ctx context.Context,
	tx *sqlx.Tx,
	tier *models.TicketTier,
) error {
	
	query := `
		INSERT INTO ticket_tiers (
			id, event_id, name, description, price_kobo,
			capacity, sold, available, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	
	_, err := tx.ExecContext(ctx, query,
		tier.ID,
		tier.EventID,
		tier.Name,
		tier.Description,
		tier.PriceKobo,
		tier.Capacity,
		tier.Sold,
		tier.Available,
		tier.CreatedAt,
		tier.UpdatedAt,
	)
	
	if err != nil {
		return fmt.Errorf("failed to create ticket tier %s: %w", tier.Name, err)
	}
	
	return nil
}

// CreateTicketTiers - Plural helper method (calls singular method in loop)
func (r *postgresEventRepository) CreateTicketTiers(
	ctx context.Context,
	tx *sqlx.Tx,
	tiers []models.TicketTier,
) error {
	
	for _, tier := range tiers {
		if err := r.CreateTicketTier(ctx, tx, &tier); err != nil {
			return err
		}
	}
	
	return nil
}

// DecrementTicketStockTx (Reserving tickets)
func (r *postgresEventRepository) DecrementTicketStockTx(
	ctx context.Context,
	tx *sqlx.Tx,
	eventID uuid.UUID,
	tierName string,
	quantity int32,
) error {
	// We check (capacity - sold) >= quantity to ensure we don't oversell
	query := `
        UPDATE ticket_tiers 
        SET sold = sold + $1,
            available = available - $1, -- Added this to keep 'available' column in sync
            updated_at = NOW()
        WHERE event_id = $2 
          AND name = $3 
          AND (capacity - sold) >= $1`
	
	result, err := tx.ExecContext(ctx, query, quantity, eventID, tierName)
	if err != nil {
		return fmt.Errorf("stock decrement failed: %w", err)
	}
	
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("insufficient stock for tier '%s' (requested: %d)", tierName, quantity)
	}
	
	return nil
}

// IncrementTicketStockTx (Releasing reserved tickets back to inventory)
func (r *postgresEventRepository) IncrementTicketStockTx(
	ctx context.Context, 
	tx *sqlx.Tx, 
	eventID uuid.UUID, 
	tierName string, 
	quantity int32,
) error {
	query := `
        UPDATE ticket_tiers 
        SET sold = sold - $1,
            available = available + $1,
            updated_at = NOW()
        WHERE event_id = $2 
          AND name = $3 
          AND sold >= $1`

	result, err := tx.ExecContext(ctx, query, quantity, eventID, tierName)
	if err != nil {
		return fmt.Errorf("stock increment failed: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("failed to release stock: tier not found or invalid sold_count for %s", tierName)
	}
	return nil
}

// UpdateEvent
func (r *postgresEventRepository) UpdateEvent(
	ctx context.Context,
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
			updated_at = $17
		WHERE id = $18 AND is_deleted = false
	`
	
	result, err := r.db.ExecContext(ctx, query,
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
		time.Now(),
		event.ID,
	)
	
	if err != nil {
		return fmt.Errorf("failed to update event: %w", err)
	}
	
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("event not found")
	}
	
	return nil
}

// SoftDeleteEvent
func (r *postgresEventRepository) SoftDeleteEvent(
	ctx context.Context,
	eventID uuid.UUID,
) error {
	
	query := `
		UPDATE events 
		SET is_deleted = true, deleted_at = $1, updated_at = $1
		WHERE id = $2 AND is_deleted = false
	`
	
	result, err := r.db.ExecContext(ctx, query, time.Now(), eventID)
	if err != nil {
		return fmt.Errorf("failed to delete event: %w", err)
	}
	
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("event not found or already deleted")
	}
	
	return nil
}