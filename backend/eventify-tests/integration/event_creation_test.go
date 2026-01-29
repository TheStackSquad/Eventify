package integration

import (
	"context"
	"testing"
	"time"

	"github.com/eventify/backend/testy/fixtures"
	"github.com/eventify/backend/testy/helpers"
	"github.com/eventify/backend/testy/shared"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestMain sets up and tears down the test database
func TestMain(m *testing.M) {
	if err := shared.InitTestDB(); err != nil {
		panic(err)
	}
	defer shared.CloseTestDB()
	m.Run()
}

func TestEventCreation_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)

	// Act
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)

	// Assert
	require.NoError(t, err, "Event creation should succeed")

	// Verify event was created
	savedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err, "Should retrieve created event")
	assert.Equal(t, event.EventTitle, savedEvent.EventTitle)
	assert.Equal(t, event.OrganizerID, savedEvent.OrganizerID)
	assert.False(t, savedEvent.IsDeleted, "New event should not be deleted")

	// Verify ticket tiers were created
	for _, tier := range tiers {
		savedTier, err := helpers.GetTicketTierByID(ctx, tc.Tx, tier.ID)
		require.NoError(t, err, "Should retrieve created tier")
		assert.Equal(t, tier.Name, savedTier.Name)
		assert.Equal(t, tier.PriceKobo, savedTier.PriceKobo)
		assert.Equal(t, tier.Capacity, savedTier.Capacity)
		assert.Equal(t, int32(0), savedTier.Sold, "New tier should have 0 sales")
		assert.Equal(t, tier.Capacity, savedTier.Available, "Available should equal capacity")
	}
}

func TestEventCreation_VirtualEvent_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewVirtualEventFixture(organizerID)
	tiers := []*fixtures.TicketTierFixture{
		fixtures.NewTicketTierFixture(event.ID, "Standard", 0, 1000), // Free virtual event
	}

	// Act
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)

	// Assert
	require.NoError(t, err, "Virtual event creation should succeed")

	savedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, "virtual", savedEvent.EventType)
	assert.NotNil(t, savedEvent.MeetingLink, "Virtual event should have meeting link")
	assert.Nil(t, savedEvent.VenueName, "Virtual event should not have venue")
}

func TestEventCreation_WithPaystackSubaccount_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	subaccountCode := "ACCT_test123456"
	event := fixtures.NewEventFixtureWithPaystack(organizerID, subaccountCode)
	tiers := fixtures.StandardTicketTiers(event.ID)

	// Act
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)

	// Assert
	require.NoError(t, err, "Event with Paystack subaccount should succeed")

	savedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	require.NotNil(t, savedEvent.PaystackSubaccountCode)
	assert.Equal(t, subaccountCode, *savedEvent.PaystackSubaccountCode)
}

func TestEventCreation_DuplicateSlug_ShouldFail(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event1 := fixtures.NewEventFixture(organizerID)
	event1.EventSlug.String = "duplicate-slug-test"
	event1.EventSlug.Valid = true

	event2 := fixtures.NewEventFixture(organizerID)
	event2.EventSlug.String = "duplicate-slug-test" // Same slug
	event2.EventSlug.Valid = true

	// Act
	err1 := helpers.InsertTestEvent(ctx, tc.Tx, event1)
	err2 := helpers.InsertTestEvent(ctx, tc.Tx, event2)

	// Assert
	require.NoError(t, err1, "First event should be created")
	require.Error(t, err2, "Second event with duplicate slug should fail")
	assert.Contains(t, err2.Error(), "duplicate", "Error should mention duplicate")
}

func TestEventCreation_PastStartDate_ShouldFail(t *testing.T) {
	// This would typically be handled at the service/handler layer
	// Here we're documenting the validation requirement
	t.Skip("Validation should be handled at service layer, not database layer")
}

func TestEventCreation_EndBeforeStart_ShouldFail(t *testing.T) {
	// This would typically be handled at the service/handler layer
	t.Skip("Validation should be handled at service layer, not database layer")
}

func TestEventCreation_WithTags_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	event.Tags = []string{"technology", "networking", "innovation", "lagos"}
	tiers := fixtures.StandardTicketTiers(event.ID)

	// Act
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)

	// Assert
	require.NoError(t, err)

	savedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Len(t, savedEvent.Tags, 4)
	assert.Contains(t, savedEvent.Tags, "technology")
	assert.Contains(t, savedEvent.Tags, "lagos")
}

func TestEventCreation_MultipleTicketTiers_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := []*fixtures.TicketTierFixture{
		fixtures.NewTicketTierFixture(event.ID, "Early Bird", 500000, 50),
		fixtures.NewTicketTierFixture(event.ID, "Regular", 1000000, 150),
		fixtures.NewTicketTierFixture(event.ID, "VIP", 2500000, 30),
		fixtures.NewTicketTierFixture(event.ID, "VVIP", 5000000, 10),
		fixtures.NewTicketTierFixture(event.ID, "Corporate Table", 20000000, 5),
	}

	// Act
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)

	// Assert
	require.NoError(t, err)

	// Verify all tiers were created with correct prices
	totalCapacity := int32(0)
	for _, tier := range tiers {
		savedTier, err := helpers.GetTicketTierByID(ctx, tc.Tx, tier.ID)
		require.NoError(t, err)
		assert.Equal(t, tier.PriceKobo, savedTier.PriceKobo)
		totalCapacity += savedTier.Capacity
	}

	assert.Equal(t, int32(245), totalCapacity, "Total capacity should match sum of all tiers")
}

func TestEventCreation_FreeTickets_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := []*fixtures.TicketTierFixture{
		fixtures.NewTicketTierFixture(event.ID, "Free Entry", 0, 500),
	}

	// Act
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)

	// Assert
	require.NoError(t, err)

	savedTier, err := helpers.GetTicketTierByID(ctx, tc.Tx, tiers[0].ID)
	require.NoError(t, err)
	assert.Equal(t, int32(0), savedTier.PriceKobo, "Free tickets should have 0 price")
}

func TestEventCreation_TimestampsAreSet(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	beforeCreation := time.Now()

	// Act
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	afterCreation := time.Now()

	// Assert
	require.NoError(t, err)

	savedEvent, err := helpers.GetEventByID(ctx, tc.Tx, event.ID)
	require.NoError(t, err)

	assert.True(t, savedEvent.CreatedAt.After(beforeCreation) || savedEvent.CreatedAt.Equal(beforeCreation))
	assert.True(t, savedEvent.CreatedAt.Before(afterCreation) || savedEvent.CreatedAt.Equal(afterCreation))
	assert.Equal(t, savedEvent.CreatedAt, savedEvent.UpdatedAt, "For new event, created_at should equal updated_at")
}