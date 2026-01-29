package helpers

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/eventify/backend/testy/fixtures"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// InsertTestEvent inserts a test event into the database
func InsertTestEvent(ctx context.Context, db *sqlx.DB, event *fixtures.EventFixture) error {
	query := `
		INSERT INTO events (
			id, organizer_id, event_title, event_description, event_slug,
			category, event_type, event_image_url, venue_name, venue_address,
			city, state, country, virtual_platform, meeting_link,
			start_date, end_date, max_attendees, paystack_subaccount_code,
			tags, is_deleted, deleted_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16, $17, $18, $19,
			$20, $21, $22, $23, $24
		)
	`

	_, err := db.ExecContext(ctx, query,
		event.ID, event.OrganizerID, event.EventTitle, event.EventDescription,
		event.EventSlug, event.Category, event.EventType, event.EventImageURL,
		event.VenueName, event.VenueAddress, event.City, event.State,
		event.Country, event.VirtualPlatform, event.MeetingLink,
		event.StartDate, event.EndDate, event.MaxAttendees,
		event.PaystackSubaccountCode, pq.Array(event.Tags),
		event.IsDeleted, event.DeletedAt, event.CreatedAt, event.UpdatedAt,
	)

	return err
}

// InsertTestTicketTier inserts a test ticket tier into the database
func InsertTestTicketTier(ctx context.Context, db *sqlx.DB, tier *fixtures.TicketTierFixture) error {
	query := `
		INSERT INTO ticket_tiers (
			id, event_id, name, description, price_kobo,
			capacity, sold, available, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := db.ExecContext(ctx, query,
		tier.ID, tier.EventID, tier.Name, tier.Description, tier.PriceKobo,
		tier.Capacity, tier.Sold, tier.Available, tier.CreatedAt, tier.UpdatedAt,
	)

	return err
}

// InsertTestTicket inserts a test ticket into the database
func InsertTestTicket(ctx context.Context, db *sqlx.DB, ticket *fixtures.TicketFixture) error {
	query := `
		INSERT INTO tickets (
			id, code, order_id, event_id, ticket_tier_id, user_id,
			status, is_used, used_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err := db.ExecContext(ctx, query,
		ticket.ID, ticket.Code, ticket.OrderID, ticket.EventID,
		ticket.TicketTierID, ticket.UserID, ticket.Status, ticket.IsUsed,
		ticket.UsedAt, ticket.CreatedAt, ticket.UpdatedAt,
	)

	return err
}

// InsertTestEventWithTiers inserts an event with its ticket tiers
func InsertTestEventWithTiers(ctx context.Context, db *sqlx.DB, event *fixtures.EventFixture, tiers []*fixtures.TicketTierFixture) error {
	// Insert event
	if err := InsertTestEvent(ctx, db, event); err != nil {
		return fmt.Errorf("failed to insert event: %w", err)
	}

	// Insert tiers
	for _, tier := range tiers {
		if err := InsertTestTicketTier(ctx, db, tier); err != nil {
			return fmt.Errorf("failed to insert tier %s: %w", tier.Name, err)
		}
	}

	return nil
}

// GetEventByID retrieves an event by ID
func GetEventByID(ctx context.Context, db *sqlx.DB, eventID uuid.UUID) (*fixtures.EventFixture, error) {
	var event fixtures.EventFixture
	query := `
		SELECT 
			id, organizer_id, event_title, event_description, event_slug,
			category, event_type, event_image_url, venue_name, venue_address,
			city, state, country, virtual_platform, meeting_link,
			start_date, end_date, max_attendees, paystack_subaccount_code,
			tags, is_deleted, deleted_at, created_at, updated_at
		FROM events WHERE id = $1
	`

	err := db.GetContext(ctx, &event, query, eventID)
	if err != nil {
		return nil, err
	}

	return &event, nil
}

// GetTicketTierByID retrieves a ticket tier by ID
func GetTicketTierByID(ctx context.Context, db *sqlx.DB, tierID uuid.UUID) (*fixtures.TicketTierFixture, error) {
	var tier fixtures.TicketTierFixture
	query := `
		SELECT 
			id, event_id, name, description, price_kobo,
			capacity, sold, available, created_at, updated_at
		FROM ticket_tiers WHERE id = $1
	`

	err := db.GetContext(ctx, &tier, query, tierID)
	if err != nil {
		return nil, err
	}

	return &tier, nil
}

// GetTicketByCode retrieves a ticket by its code
func GetTicketByCode(ctx context.Context, db *sqlx.DB, code string) (*fixtures.TicketFixture, error) {
	var ticket fixtures.TicketFixture
	query := `
		SELECT 
			id, code, order_id, event_id, ticket_tier_id, user_id,
			status, is_used, used_at, created_at, updated_at
		FROM tickets WHERE code = $1
	`

	err := db.GetContext(ctx, &ticket, query, code)
	if err != nil {
		return nil, err
	}

	return &ticket, nil
}

// CountEventTicketsSold returns the total tickets sold for an event
func CountEventTicketsSold(ctx context.Context, db *sqlx.DB, eventID uuid.UUID) (int32, error) {
	var total int32
	query := `SELECT COALESCE(SUM(sold), 0) FROM ticket_tiers WHERE event_id = $1`
	err := db.GetContext(ctx, &total, query, eventID)
	return total, err
}

// EventExists checks if an event exists by ID
func EventExists(ctx context.Context, db *sqlx.DB, eventID uuid.UUID) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM events WHERE id = $1)`
	err := db.GetContext(ctx, &exists, query, eventID)
	return exists, err
}

// EventIsDeleted checks if an event is soft-deleted
func EventIsDeleted(ctx context.Context, db *sqlx.DB, eventID uuid.UUID) (bool, error) {
	var isDeleted bool
	query := `SELECT is_deleted FROM events WHERE id = $1`
	err := db.GetContext(ctx, &isDeleted, query, eventID)
	return isDeleted, err
}

// CleanupTestEvents removes all test events
func CleanupTestEvents(ctx context.Context, db *sqlx.DB) error {
	query := `DELETE FROM events WHERE event_title LIKE 'TEST_%'`
	_, err := db.ExecContext(ctx, query)
	return err
}

// AssertEventField is a helper for testing event fields
func AssertEventField(t *testing.T, expected, actual interface{}, fieldName string) {
	t.Helper()
	if expected != actual {
		t.Errorf("%s mismatch: expected %v, got %v", fieldName, expected, actual)
	}
}

// AssertEventNotNil checks that critical event fields are not nil
func AssertEventNotNil(t *testing.T, event *fixtures.EventFixture) {
	t.Helper()
	if event.ID == uuid.Nil {
		t.Error("Event ID should not be nil")
	}
	if event.OrganizerID == uuid.Nil {
		t.Error("Organizer ID should not be nil")
	}
	if event.EventTitle == "" {
		t.Error("Event title should not be empty")
	}
}

// WaitForEventUpdate polls the database until an event is updated or timeout
func WaitForEventUpdate(ctx context.Context, db *sqlx.DB, eventID uuid.UUID, originalUpdatedAt time.Time, timeout time.Duration) (bool, error) {
	deadline := time.Now().Add(timeout)
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return false, ctx.Err()
		case <-ticker.C:
			var updatedAt time.Time
			err := db.GetContext(ctx, &updatedAt, `SELECT updated_at FROM events WHERE id = $1`, eventID)
			if err != nil {
				return false, err
			}
			if updatedAt.After(originalUpdatedAt) {
				return true, nil
			}
			if time.Now().After(deadline) {
				return false, nil
			}
		}
	}
}

// SimulateTicketSale simulates selling tickets by updating the sold count
func SimulateTicketSale(ctx context.Context, db *sqlx.DB, tierID uuid.UUID, quantity int32) error {
	query := `
		UPDATE ticket_tiers 
		SET sold = sold + $1, 
		    available = available - $1,
		    updated_at = NOW()
		WHERE id = $2 AND available >= $1
	`
	result, err := db.ExecContext(ctx, query, quantity, tierID)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("insufficient tickets available")
	}

	return nil
}

// RollbackTicketSale reverses a ticket sale
func RollbackTicketSale(ctx context.Context, db *sqlx.DB, tierID uuid.UUID, quantity int32) error {
	query := `
		UPDATE ticket_tiers 
		SET sold = sold - $1, 
		    available = available + $1,
		    updated_at = NOW()
		WHERE id = $2 AND sold >= $1
	`
	result, err := db.ExecContext(ctx, query, quantity, tierID)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("cannot rollback: not enough sold tickets")
	}

	return nil
}

// GetEventLikeCount returns the number of likes for an event
func GetEventLikeCount(ctx context.Context, db *sqlx.DB, eventID uuid.UUID) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM event_likes WHERE event_id = $1`
	err := db.GetContext(ctx, &count, query, eventID)
	return count, err
}

// SimulateEventLike adds a like to an event
func SimulateEventLike(ctx context.Context, db *sqlx.DB, eventID uuid.UUID, userID *uuid.UUID, guestID string) error {
	query := `
		INSERT INTO event_likes (id, event_id, user_id, guest_id, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT DO NOTHING
	`
	_, err := db.ExecContext(ctx, query, uuid.New(), eventID, userID, guestID)
	return err
}

// UserHasLikedEvent checks if a user/guest has liked an event
func UserHasLikedEvent(ctx context.Context, db *sqlx.DB, eventID uuid.UUID, userID *uuid.UUID, guestID string) (bool, error) {
	var exists bool
	query := `
		SELECT EXISTS(
			SELECT 1 FROM event_likes 
			WHERE event_id = $1 
			AND (user_id = $2 OR guest_id = $3)
		)
	`
	err := db.GetContext(ctx, &exists, query, eventID, userID, sql.NullString{String: guestID, Valid: guestID != ""})
	return exists, err
}