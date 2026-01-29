package integration

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/eventify/backend/testy/fixtures"
	"github.com/eventify/backend/testy/helpers"
	"github.com/eventify/backend/testy/shared"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEventDelete_Soft_WithNoSales_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Soft delete event
	query := `
		UPDATE events 
		SET is_deleted = true,
		    deleted_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1 AND is_deleted = false
	`
	result, err := tc.Tx.ExecContext(ctx, query, event.ID)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(1), rows, "Should soft delete event")

	// Verify event is marked as deleted
	deletedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.True(t, deletedEvent.IsDeleted, "Event should be marked as deleted")
	assert.NotNil(t, deletedEvent.DeletedAt, "DeletedAt should be set")
}

func TestEventDelete_Soft_WithSales_ShouldFail(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Simulate ticket sales
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 10)
	require.NoError(t, err)

	// Act - Try to soft delete with constraint check
	query := `
		UPDATE events 
		SET is_deleted = true,
		    deleted_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1 
		  AND is_deleted = false
		  AND NOT EXISTS (
		      SELECT 1 
		      FROM ticket_tiers 
		      WHERE event_id = $1 AND sold > 0
		  )
	`
	result, err := tc.Tx.ExecContext(ctx, query, event.ID)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(0), rows, "Should not delete event with ticket sales")

	// Verify event is still active
	eventCheck, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.False(t, eventCheck.IsDeleted, "Event should remain active")
}

func TestEventDelete_Soft_AfterEventEnded_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange - Create past event
	organizerID := uuid.New()
	event := fixtures.NewPastEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Simulate ticket sales for past event
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 25)
	require.NoError(t, err)

	// Act - Soft delete past event (allowed after event ends)
	query := `
		UPDATE events 
		SET is_deleted = true,
		    deleted_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1 
		  AND is_deleted = false
		  AND end_date < NOW()
	`
	result, err := tc.Tx.ExecContext(ctx, query, event.ID)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(1), rows, "Should allow deletion after event ends")

	deletedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.True(t, deletedEvent.IsDeleted)
}

func TestEventDelete_Soft_DuringActiveEvent_ShouldBeBlocked(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange - Create ongoing event
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	event.StartDate = time.Now().Add(-1 * time.Hour) // Started 1 hour ago
	event.EndDate = time.Now().Add(3 * time.Hour)    // Ends in 3 hours
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Simulate ticket sales
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 50)
	require.NoError(t, err)

	// Act - Try to delete during active event
	query := `
		UPDATE events 
		SET is_deleted = true,
		    deleted_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1 
		  AND is_deleted = false
		  AND NOT EXISTS (
		      SELECT 1 
		      FROM ticket_tiers 
		      WHERE event_id = $1 AND sold > 0
		  )
		  AND end_date < NOW()
	`
	result, err := tc.Tx.ExecContext(ctx, query, event.ID)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(0), rows, "Should not delete during active event")
}

func TestEventDelete_Permanent_After30Days_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange - Create event deleted more than 30 days ago
	organizerID := uuid.New()
	event := fixtures.NewDeletedEventFixture(organizerID)
	deletedAt := time.Now().Add(-31 * 24 * time.Hour) // 31 days ago
	event.DeletedAt = &deletedAt
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Permanently delete events older than 30 days
	query := `
		DELETE FROM events 
		WHERE is_deleted = true 
		  AND deleted_at < NOW() - INTERVAL '30 days'
		  AND id = $1
	`
	result, err := tc.Tx.ExecContext(ctx, query, event.ID)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(1), rows, "Should permanently delete old events")

	// Verify event no longer exists
	exists, err := helpers.EventExists(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.False(t, exists, "Event should be permanently deleted")
}

func TestEventDelete_Permanent_Before30Days_NotDeleted(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange - Create event deleted less than 30 days ago
	organizerID := uuid.New()
	event := fixtures.NewDeletedEventFixture(organizerID)
	deletedAt := time.Now().Add(-15 * 24 * time.Hour) // Only 15 days ago
	event.DeletedAt = &deletedAt
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Try to permanently delete
	query := `
		DELETE FROM events 
		WHERE is_deleted = true 
		  AND deleted_at < NOW() - INTERVAL '30 days'
		  AND id = $1
	`
	result, err := tc.Tx.ExecContext(ctx, query, event.ID)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(0), rows, "Should not permanently delete before 30 days")

	// Verify event still exists
	exists, err := helpers.EventExists(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.True(t, exists, "Event should still exist")
}

func TestEventDelete_Permanent_CascadeToTicketTiers(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewDeletedEventFixture(organizerID)
	deletedAt := time.Now().Add(-31 * 24 * time.Hour)
	event.DeletedAt = &deletedAt
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Permanently delete event (should cascade to ticket_tiers)
	query := `DELETE FROM events WHERE id = $1`
	_, err = tc.Tx.ExecContext(ctx, query, event.ID)

	// Assert
	require.NoError(t, err)

	// Verify ticket tiers are also deleted (cascade)
	for _, tier := range tiers {
		_, err := helpers.GetTicketTierByID(ctx, tc.Tx, tier.ID)
		assert.Error(t, err, "Ticket tier should be deleted via cascade")
		assert.Equal(t, sql.ErrNoRows, err)
	}
}

func TestEventDelete_Soft_Idempotent(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Soft delete twice
	query := `
		UPDATE events 
		SET is_deleted = true,
		    deleted_at = COALESCE(deleted_at, NOW()),
		    updated_at = NOW()
		WHERE id = $1
	`
	
	// First deletion
	result1, err := tc.Tx.ExecContext(ctx, query, event.ID)
	require.NoError(t, err)
	rows1, _ := result1.RowsAffected()

	// Second deletion (should be idempotent)
	result2, err := tc.Tx.ExecContext(ctx, query, event.ID)
	require.NoError(t, err)
	rows2, _ := result2.RowsAffected()

	// Assert
	assert.Equal(t, int64(1), rows1, "First deletion should update")
	assert.Equal(t, int64(1), rows2, "Second deletion should also update (but no change in is_deleted)")

	deletedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.True(t, deletedEvent.IsDeleted)
}

func TestEventDelete_Restore_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewDeletedEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Restore deleted event
	query := `
		UPDATE events 
		SET is_deleted = false,
		    deleted_at = NULL,
		    updated_at = NOW()
		WHERE id = $1 AND is_deleted = true
	`
	result, err := tc.Tx.ExecContext(ctx, query, event.ID)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(1), rows, "Should restore event")

	restoredEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.False(t, restoredEvent.IsDeleted, "Event should be active")
	assert.Nil(t, restoredEvent.DeletedAt, "DeletedAt should be null")
}

func TestEventDelete_BulkPermanentCleanup(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange - Create multiple old deleted events
	organizerID := uuid.New()
	oldDeletedAt := time.Now().Add(-35 * 24 * time.Hour) // 35 days ago
	
	eventIDs := []uuid.UUID{}
	for i := 0; i < 5; i++ {
		event := fixtures.NewDeletedEventFixture(organizerID)
		event.DeletedAt = &oldDeletedAt
		tiers := []*fixtures.TicketTierFixture{
			fixtures.NewTicketTierFixture(event.ID, "Test Tier", 100000, 100),
		}
		err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
		require.NoError(t, err)
		eventIDs = append(eventIDs, event.ID)
	}

	// Act - Bulk permanent cleanup
	query := `
		DELETE FROM events 
		WHERE is_deleted = true 
		  AND deleted_at < NOW() - INTERVAL '30 days'
	`
	result, err := tc.Tx.ExecContext(ctx, query)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.GreaterOrEqual(t, int(rows), 5, "Should delete at least 5 old events")

	// Verify all events are gone
	for _, eventID := range eventIDs {
		exists, _ := helpers.EventExists(ctx, tc.Tx, eventID)
		assert.False(t, exists, "Event should be permanently deleted")
	}
}

func TestEventDelete_OnlyDeletedEvents_AreTargeted(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	
	// Active event
	activeEvent := fixtures.NewEventFixture(organizerID)
	activeTiers := fixtures.StandardTicketTiers(activeEvent.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, activeEvent, activeTiers)
	require.NoError(t, err)

	// Deleted event
	deletedEvent := fixtures.NewDeletedEventFixture(organizerID)
	deletedAt := time.Now().Add(-31 * 24 * time.Hour)
	deletedEvent.DeletedAt = &deletedAt
	deletedTiers := fixtures.StandardTicketTiers(deletedEvent.ID)
	err = helpers.InsertTestEventWithTiers(ctx, tc.Tx, deletedEvent, deletedTiers)
	require.NoError(t, err)

	// Act - Permanent cleanup
	query := `
		DELETE FROM events 
		WHERE is_deleted = true 
		  AND deleted_at < NOW() - INTERVAL '30 days'
	`
	_, err = tc.Tx.ExecContext(ctx, query)

	// Assert
	require.NoError(t, err)

	// Active event should still exist
	activeExists, _ := helpers.EventExists(ctx, tc.Tx, activeEvent.ID)
	assert.True(t, activeExists, "Active event should not be deleted")

	// Deleted event should be gone
	deletedExists, _ := helpers.EventExists(ctx, tc.Tx, deletedEvent.ID)
	assert.False(t, deletedExists, "Deleted event should be permanently removed")
}