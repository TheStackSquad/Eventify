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
	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEventUpdate_BasicFields_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Update basic fields
	newTitle := "TEST_Updated_Event_Title"
	newDescription := "This is an updated description for testing"
	newCategory := "Business"

	query := `
		UPDATE events 
		SET event_title = $1, 
		    event_description = $2, 
		    category = $3,
		    updated_at = NOW()
		WHERE id = $4
	`
	_, err = tc.Tx.ExecContext(ctx, query, newTitle, newDescription, newCategory, event.ID)

	// Assert
	require.NoError(t, err)

	updatedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, newTitle, updatedEvent.EventTitle)
	assert.Equal(t, newDescription, updatedEvent.EventDescription)
	assert.Equal(t, newCategory, updatedEvent.Category)
	assert.True(t, updatedEvent.UpdatedAt.After(event.UpdatedAt), "updated_at should be newer")
}

func TestEventUpdate_VenueDetails_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Update venue details
	newVenue := "Updated Convention Center"
	newAddress := "456 New Street"
	newCity := "Abuja"

	query := `
		UPDATE events 
		SET venue_name = $1, 
		    venue_address = $2, 
		    city = $3,
		    updated_at = NOW()
		WHERE id = $4
	`
	_, err = tc.Tx.ExecContext(ctx, query, newVenue, newAddress, newCity, event.ID)

	// Assert
	require.NoError(t, err)

	updatedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	require.NotNil(t, updatedEvent.VenueName)
	assert.Equal(t, newVenue, *updatedEvent.VenueName)
	assert.Equal(t, newAddress, *updatedEvent.VenueAddress)
	assert.Equal(t, newCity, *updatedEvent.City)
}

func TestEventUpdate_DateChange_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Change event dates
	newStartDate := time.Now().Add(72 * time.Hour)  // 3 days from now
	newEndDate := newStartDate.Add(6 * time.Hour)

	query := `
		UPDATE events 
		SET start_date = $1, 
		    end_date = $2,
		    updated_at = NOW()
		WHERE id = $3
	`
	_, err = tc.Tx.ExecContext(ctx, query, newStartDate, newEndDate, event.ID)

	// Assert
	require.NoError(t, err)

	updatedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.True(t, updatedEvent.StartDate.Equal(newStartDate))
	assert.True(t, updatedEvent.EndDate.Equal(newEndDate))
}

func TestEventUpdate_TagsUpdate_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	event.Tags = []string{"old", "tags"}
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Update tags
	newTags := []string{"new", "updated", "tags", "test"}
	query := `
		UPDATE events 
		SET tags = $1,
		    updated_at = NOW()
		WHERE id = $2
	`
	_, err = tc.Tx.ExecContext(ctx, query, pq.Array(newTags), event.ID)

	// Assert
	require.NoError(t, err)

	updatedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Len(t, updatedEvent.Tags, 4)
	assert.Contains(t, updatedEvent.Tags, "new")
	assert.Contains(t, updatedEvent.Tags, "updated")
}

func TestEventUpdate_TicketTierPrice_WithNoSales_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Update price when no tickets sold
	newPrice := int32(1500000) // ₦15,000
	query := `
		UPDATE ticket_tiers 
		SET price_kobo = $1,
		    updated_at = NOW()
		WHERE id = $2 AND sold = 0
	`
	result, err := tc.Tx.ExecContext(ctx, query, newPrice, tiers[0].ID)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(1), rows, "Should update tier with no sales")

	updatedTier, err := helpers.GetTicketTierByID(ctx, tc.Tx, tiers[0].ID)
	require.NoError(t, err)
	assert.Equal(t, newPrice, updatedTier.PriceKobo)
}

func TestEventUpdate_TicketTierPrice_WithSales_ShouldFail(t *testing.T) {
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
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 5)
	require.NoError(t, err)

	// Act - Try to update price after sales (should be blocked by trigger)
	newPrice := int32(2000000)
	query := `
		UPDATE ticket_tiers 
		SET price_kobo = $1,
		    updated_at = NOW()
		WHERE id = $2
	`
	_, err = tc.Tx.ExecContext(ctx, query, newPrice, tiers[0].ID)

	// Assert
	require.Error(t, err, "Should not allow price change after sales")
	assert.Contains(t, err.Error(), "sold", "Error should mention sold tickets")
}

func TestEventUpdate_TicketTierCapacity_IncreasAllowed_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	originalCapacity := tiers[0].Capacity

	// Act - Increase capacity
	newCapacity := originalCapacity + 50
	query := `
		UPDATE ticket_tiers 
		SET capacity = $1,
		    available = available + ($1 - capacity),
		    updated_at = NOW()
		WHERE id = $2
	`
	_, err = tc.Tx.ExecContext(ctx, query, newCapacity, tiers[0].ID)

	// Assert
	require.NoError(t, err)

	updatedTier, err := helpers.GetTicketTierByID(ctx, tc.Tx, tiers[0].ID)
	require.NoError(t, err)
	assert.Equal(t, newCapacity, updatedTier.Capacity)
	assert.Equal(t, newCapacity, updatedTier.Available)
}

func TestEventUpdate_TicketTierCapacity_DecreaseBelowSold_ShouldFail(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Simulate selling 50 tickets
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 50)
	require.NoError(t, err)

	// Act - Try to reduce capacity below sold count (should be blocked by trigger)
	newCapacity := int32(40) // Less than 50 sold
	query := `
		UPDATE ticket_tiers 
		SET capacity = $1,
		    updated_at = NOW()
		WHERE id = $2
	`
	_, err = tc.Tx.ExecContext(ctx, query, newCapacity, tiers[0].ID)

	// Assert
	require.Error(t, err, "Should not allow capacity below sold count")
	assert.Contains(t, err.Error(), "capacity", "Error should mention capacity constraint")
}

func TestEventUpdate_PaystackSubaccount_WithNoSales_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Update Paystack subaccount
	newSubaccount := "ACCT_new123456"
	query := `
		UPDATE events 
		SET paystack_subaccount_code = $1,
		    updated_at = NOW()
		WHERE id = $2
	`
	_, err = tc.Tx.ExecContext(ctx, query, newSubaccount, event.ID)

	// Assert
	require.NoError(t, err)

	updatedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	require.NotNil(t, updatedEvent.PaystackSubaccountCode)
	assert.Equal(t, newSubaccount, *updatedEvent.PaystackSubaccountCode)
}

func TestEventUpdate_PaystackSubaccount_WithSales_ShouldBeBlocked(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	subaccount := "ACCT_original123"
	event := fixtures.NewEventFixtureWithPaystack(organizerID, subaccount)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Simulate ticket sales
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 10)
	require.NoError(t, err)

	// Act - Try to change Paystack subaccount after sales
	// This should be validated at the service layer
	newSubaccount := "ACCT_different456"
	query := `
		UPDATE events 
		SET paystack_subaccount_code = $1,
		    updated_at = NOW()
		WHERE id = $2
	`
	_, err = tc.Tx.ExecContext(ctx, query, newSubaccount, event.ID)

	// Note: This test documents that database allows the update
	// The business rule enforcement should happen at service layer
	assert.NoError(t, err, "Database allows update, but service layer should prevent it")

	t.Log("⚠️ Business Rule: Service layer must prevent Paystack subaccount changes after ticket sales")
}

func TestEventUpdate_VenueDetails_WithSales_ShouldBeBlocked(t *testing.T) {
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
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 20)
	require.NoError(t, err)

	// Act - Try to change venue after sales
	// Database allows this, but service layer should prevent it
	newVenue := "Completely Different Venue"
	query := `
		UPDATE events 
		SET venue_name = $1,
		    updated_at = NOW()
		WHERE id = $2
	`
	_, err = tc.Tx.ExecContext(ctx, query, newVenue, event.ID)

	// Assert
	assert.NoError(t, err, "Database allows update, but service layer should prevent it")

	t.Log("⚠️ Business Rule: Service layer must prevent venue/address changes after ticket sales")
}

func TestEventUpdate_MultipleFields_Atomic_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Update multiple fields atomically
	newTitle := "TEST_Atomic_Update"
	newDescription := "Atomic multi-field update"
	newCategory := "Conference"
	newTags := []string{"atomic", "test", "update"}

	query := `
		UPDATE events 
		SET event_title = $1,
		    event_description = $2,
		    category = $3,
		    tags = $4,
		    updated_at = NOW()
		WHERE id = $5
	`
	_, err = tc.Tx.ExecContext(ctx, query, newTitle, newDescription, newCategory, pq.Array(newTags), event.ID)

	// Assert
	require.NoError(t, err)

	updatedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, newTitle, updatedEvent.EventTitle)
	assert.Equal(t, newDescription, updatedEvent.EventDescription)
	assert.Equal(t, newCategory, updatedEvent.Category)
	assert.Len(t, updatedEvent.Tags, 3)
}

func TestEventUpdate_DeletedEvent_ShouldNotUpdate(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewDeletedEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Try to update a deleted event
	newTitle := "TEST_Should_Not_Update"
	query := `
		UPDATE events 
		SET event_title = $1,
		    updated_at = NOW()
		WHERE id = $2 AND is_deleted = false
	`
	result, err := tc.Tx.ExecContext(ctx, query, newTitle, event.ID)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(0), rows, "Should not update deleted event")

	// Verify event title unchanged
	unchangedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.NotEqual(t, newTitle, unchangedEvent.EventTitle)
}

func TestEventUpdate_UpdatedAtTimestamp_IsRefreshed(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	originalUpdatedAt := event.UpdatedAt
	time.Sleep(100 * time.Millisecond) // Ensure time difference

	// Act - Update event
	query := `
		UPDATE events 
		SET event_title = $1,
		    updated_at = NOW()
		WHERE id = $2
	`
	_, err = tc.Tx.ExecContext(ctx, query, "TEST_Updated", event.ID)
	require.NoError(t, err)

	// Assert
	updatedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.True(t, updatedEvent.UpdatedAt.After(originalUpdatedAt), 
		"updated_at should be refreshed after update")
}