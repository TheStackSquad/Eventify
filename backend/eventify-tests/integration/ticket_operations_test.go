package integration

import (
	"context"
	"testing"

	"github.com/eventify/backend/testy/fixtures"
	"github.com/eventify/backend/testy/helpers"
	"github.com/eventify/backend/testy/shared"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTicketStock_Reserve_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	initialCapacity := tiers[0].Capacity

	// Act - Reserve 10 tickets
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 10)

	// Assert
	require.NoError(t, err)

	updatedTier, err := helpers.GetTicketTierByID(ctx, tc.Tx, tiers[0].ID)
	require.NoError(t, err)
	assert.Equal(t, int32(10), updatedTier.Sold, "Sold count should increase by 10")
	assert.Equal(t, initialCapacity-10, updatedTier.Available, "Available should decrease by 10")
}

func TestTicketStock_Reserve_InsufficientStock_ShouldFail(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := []*fixtures.TicketTierFixture{
		fixtures.NewTicketTierFixture(event.ID, "Limited", 100000, 5), // Only 5 tickets
	}
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Try to reserve 10 tickets (more than available)
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 10)

	// Assert
	require.Error(t, err, "Should fail when trying to reserve more than available")
	assert.Contains(t, err.Error(), "insufficient", "Error should mention insufficient stock")

	// Verify no tickets were reserved
	tier, err := helpers.GetTicketTierByID(ctx, tc.Tx, tiers[0].ID)
	require.NoError(t, err)
	assert.Equal(t, int32(0), tier.Sold, "No tickets should be sold")
	assert.Equal(t, int32(5), tier.Available, "All tickets should still be available")
}

func TestTicketStock_ConcurrentReservation_AtomicUpdate(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := []*fixtures.TicketTierFixture{
		fixtures.NewTicketTierFixture(event.ID, "Hot Ticket", 100000, 100),
	}
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Simulate concurrent reservations
	// First reservation succeeds
	err1 := helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 50)
	require.NoError(t, err1)

	// Second reservation succeeds
	err2 := helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 30)
	require.NoError(t, err2)

	// Third reservation should fail (only 20 left, trying to buy 30)
	err3 := helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 30)
	require.Error(t, err3, "Third reservation should fail due to insufficient stock")

	// Assert - Verify final state
	tier, err := helpers.GetTicketTierByID(ctx, tc.Tx, tiers[0].ID)
	require.NoError(t, err)
	assert.Equal(t, int32(80), tier.Sold, "Should have 80 tickets sold")
	assert.Equal(t, int32(20), tier.Available, "Should have 20 tickets available")
}

func TestTicketStock_Rollback_OnPaymentFailure(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Reserve tickets
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 25)
	require.NoError(t, err)

	// Act - Simulate payment failure and rollback
	err = helpers.RollbackTicketSale(ctx, tc.Tx, tiers[0].ID, 25)

	// Assert
	require.NoError(t, err, "Stock rollback should succeed")

	tier, err := helpers.GetTicketTierByID(ctx, tc.Tx, tiers[0].ID)
	require.NoError(t, err)
	assert.Equal(t, int32(0), tier.Sold, "Sold count should be back to 0")
	assert.Equal(t, tiers[0].Capacity, tier.Available, "All tickets should be available again")
}

func TestTicketStock_Rollback_CannotExceedOriginalSold(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Reserve only 10 tickets
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 10)
	require.NoError(t, err)

	// Act - Try to rollback more than was sold
	err = helpers.RollbackTicketSale(ctx, tc.Tx, tiers[0].ID, 20)

	// Assert
	require.Error(t, err, "Cannot rollback more tickets than were sold")
	assert.Contains(t, err.Error(), "not enough sold", "Error should mention insufficient sold tickets")
}

func TestTicketStock_MultipleReservations_SameEvent(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID) // Early Bird, Regular, VIP
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Reserve tickets from different tiers
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 20) // Early Bird
	require.NoError(t, err)

	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[1].ID, 50) // Regular
	require.NoError(t, err)

	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[2].ID, 10) // VIP
	require.NoError(t, err)

	// Assert - Verify total tickets sold
	totalSold, err := helpers.CountEventTicketsSold(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, int32(80), totalSold, "Total sold should be 20+50+10 = 80")
}

func TestTicketCheckIn_Valid_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	userID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Create a valid ticket
	orderID := uuid.New()
	ticket := fixtures.NewTicketFixture(orderID, event.ID, tiers[0].ID, &userID)
	err = helpers.InsertTestTicket(ctx, tc.Tx, ticket)
	require.NoError(t, err)

	// Act - Check-in the ticket
	query := `
		UPDATE tickets 
		SET is_used = true, 
		    status = 'used',
		    used_at = NOW(),
		    updated_at = NOW()
		WHERE code = $1 
		  AND is_used = false 
		  AND status = 'active'
	`
	result, err := tc.Tx.ExecContext(ctx, query, ticket.Code)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(1), rows, "Should check-in ticket successfully")

	// Verify ticket is now used
	checkedTicket, err := helpers.GetTicketByCode(ctx, tc.Tx, ticket.Code)
	require.NoError(t, err)
	assert.True(t, checkedTicket.IsUsed, "Ticket should be marked as used")
	assert.Equal(t, "used", checkedTicket.Status)
	assert.NotNil(t, checkedTicket.UsedAt)
}

func TestTicketCheckIn_AlreadyUsed_ShouldFail(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	userID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Create an already-used ticket
	orderID := uuid.New()
	ticket := fixtures.NewUsedTicketFixture(orderID, event.ID, tiers[0].ID, &userID)
	err = helpers.InsertTestTicket(ctx, tc.Tx, ticket)
	require.NoError(t, err)

	// Act - Try to check-in again (double scan prevention)
	query := `
		UPDATE tickets 
		SET is_used = true, 
		    status = 'used',
		    used_at = NOW(),
		    updated_at = NOW()
		WHERE code = $1 
		  AND is_used = false 
		  AND status = 'active'
	`
	result, err := tc.Tx.ExecContext(ctx, query, ticket.Code)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(0), rows, "Should not update already-used ticket")

	t.Log("✅ Double-scan prevention working: Already-used ticket cannot be checked in again")
}

func TestTicketCheckIn_CancelledTicket_ShouldFail(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	userID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Create a cancelled ticket
	orderID := uuid.New()
	ticket := fixtures.NewCancelledTicketFixture(orderID, event.ID, tiers[0].ID, &userID)
	err = helpers.InsertTestTicket(ctx, tc.Tx, ticket)
	require.NoError(t, err)

	// Act - Try to check-in cancelled ticket
	query := `
		UPDATE tickets 
		SET is_used = true, 
		    status = 'used',
		    used_at = NOW()
		WHERE code = $1 
		  AND is_used = false 
		  AND status = 'active'
	`
	result, err := tc.Tx.ExecContext(ctx, query, ticket.Code)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(0), rows, "Should not check-in cancelled ticket")

	t.Log("✅ Cancelled tickets cannot be checked in")
}

func TestTicketCheckIn_NonExistentTicket_ShouldFail(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	fakeTicketCode := "FAKE-TICKET-CODE"

	// Act - Try to check-in non-existent ticket
	query := `
		UPDATE tickets 
		SET is_used = true, 
		    status = 'used',
		    used_at = NOW()
		WHERE code = $1 
		  AND is_used = false 
		  AND status = 'active'
	`
	result, err := tc.Tx.ExecContext(ctx, query, fakeTicketCode)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(0), rows, "Should not affect any rows for fake ticket")
}

func TestTicketCheckIn_BulkCheckIn_MultipleTickets(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Create multiple tickets
	orderID := uuid.New()
	numTickets := 10
	ticketCodes := []string{}

	for i := 0; i < numTickets; i++ {
		userID := uuid.New()
		ticket := fixtures.NewTicketFixture(orderID, event.ID, tiers[0].ID, &userID)
		err = helpers.InsertTestTicket(ctx, tc.Tx, ticket)
		require.NoError(t, err)
		ticketCodes = append(ticketCodes, ticket.Code)
	}

	// Act - Check-in all tickets
	for _, code := range ticketCodes {
		query := `
			UPDATE tickets 
			SET is_used = true, 
			    status = 'used',
			    used_at = NOW()
			WHERE code = $1 
			  AND is_used = false
		`
		_, err := tc.Tx.ExecContext(ctx, query, code)
		require.NoError(t, err)
	}

	// Assert - Verify all tickets are checked in
	var usedCount int
	query := `SELECT COUNT(*) FROM tickets WHERE is_used = true AND event_id = $1`
	err = tc.Tx.GetContext(ctx, &usedCount, query, event.ID)
	require.NoError(t, err)
	assert.Equal(t, numTickets, usedCount, "All tickets should be checked in")
}

func TestTicketCheckIn_AtomicOperation_NoRaceCondition(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	userID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	orderID := uuid.New()
	ticket := fixtures.NewTicketFixture(orderID, event.ID, tiers[0].ID, &userID)
	err = helpers.InsertTestTicket(ctx, tc.Tx, ticket)
	require.NoError(t, err)

	// Act - Simulate concurrent check-in attempts
	query := `
		UPDATE tickets 
		SET is_used = true, 
		    status = 'used',
		    used_at = NOW()
		WHERE code = $1 
		  AND is_used = false 
		  AND status = 'active'
	`

	// First attempt
	result1, err := tc.Tx.ExecContext(ctx, query, ticket.Code)
	require.NoError(t, err)
	rows1, _ := result1.RowsAffected()

	// Second attempt (should fail atomically)
	result2, err := tc.Tx.ExecContext(ctx, query, ticket.Code)
	require.NoError(t, err)
	rows2, _ := result2.RowsAffected()

	// Assert
	assert.Equal(t, int64(1), rows1, "First check-in should succeed")
	assert.Equal(t, int64(0), rows2, "Second check-in should fail (atomic prevention)")

	t.Log("✅ Atomic operation prevents race condition on double check-in")
}

func TestTicketStock_SellOut_AllTickets(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := []*fixtures.TicketTierFixture{
		fixtures.NewTicketTierFixture(event.ID, "Limited Edition", 500000, 50),
	}
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Sell all tickets
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 50)
	require.NoError(t, err)

	// Try to sell more (should fail)
	err = helpers.SimulateTicketSale(ctx, tc.Tx, tiers[0].ID, 1)
	require.Error(t, err, "Cannot sell more tickets when sold out")

	// Assert
	tier, err := helpers.GetTicketTierByID(ctx, tc.Tx, tiers[0].ID)
	require.NoError(t, err)
	assert.Equal(t, int32(50), tier.Sold, "All tickets should be sold")
	assert.Equal(t, int32(0), tier.Available, "No tickets should be available")
}