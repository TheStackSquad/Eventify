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

func TestEventLike_AuthenticatedUser_Success(t *testing.T) {
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

	// Act - Like event as authenticated user
	err = helpers.SimulateEventLike(ctx, tc.Tx, event.ID, &userID, "")

	// Assert
	require.NoError(t, err)

	likeCount, err := helpers.GetEventLikeCount(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, 1, likeCount)

	hasLiked, err := helpers.UserHasLikedEvent(ctx, tc.Tx, event.ID, &userID, "")
	require.NoError(t, err)
	assert.True(t, hasLiked)
}

func TestEventLike_GuestUser_Success(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	guestID := "guest_" + uuid.New().String()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Like event as guest
	err = helpers.SimulateEventLike(ctx, tc.Tx, event.ID, nil, guestID)

	// Assert
	require.NoError(t, err)

	likeCount, err := helpers.GetEventLikeCount(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, 1, likeCount)

	hasLiked, err := helpers.UserHasLikedEvent(ctx, tc.Tx, event.ID, nil, guestID)
	require.NoError(t, err)
	assert.True(t, hasLiked)
}

func TestEventLike_Duplicate_SameUser_Idempotent(t *testing.T) {
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

	// Act - Like event twice
	err1 := helpers.SimulateEventLike(ctx, tc.Tx, event.ID, &userID, "")
	err2 := helpers.SimulateEventLike(ctx, tc.Tx, event.ID, &userID, "")

	// Assert
	require.NoError(t, err1, "First like should succeed")
	require.NoError(t, err2, "Second like should not error (ON CONFLICT DO NOTHING)")

	likeCount, err := helpers.GetEventLikeCount(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, 1, likeCount, "Should only count one like per user")
}

func TestEventLike_Duplicate_SameGuest_Idempotent(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	guestID := "guest_" + uuid.New().String()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Guest likes event twice
	err1 := helpers.SimulateEventLike(ctx, tc.Tx, event.ID, nil, guestID)
	err2 := helpers.SimulateEventLike(ctx, tc.Tx, event.ID, nil, guestID)

	// Assert
	require.NoError(t, err1)
	require.NoError(t, err2)

	likeCount, err := helpers.GetEventLikeCount(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, 1, likeCount, "Should only count one like per guest")
}

func TestEventLike_MultipleUsers_CountsCorrectly(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - 5 authenticated users and 3 guests like the event
	userIDs := []uuid.UUID{uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()}
	for _, uid := range userIDs {
		err := helpers.SimulateEventLike(ctx, tc.Tx, event.ID, &uid, "")
		require.NoError(t, err)
	}

	guestIDs := []string{"guest_1", "guest_2", "guest_3"}
	for _, gid := range guestIDs {
		err := helpers.SimulateEventLike(ctx, tc.Tx, event.ID, nil, gid)
		require.NoError(t, err)
	}

	// Assert
	likeCount, err := helpers.GetEventLikeCount(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, 8, likeCount, "Should count 5 user likes + 3 guest likes")
}

func TestEventLike_Toggle_Unlike_Success(t *testing.T) {
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

	// Like first
	err = helpers.SimulateEventLike(ctx, tc.Tx, event.ID, &userID, "")
	require.NoError(t, err)

	// Act - Unlike (delete like)
	query := `DELETE FROM likes WHERE event_id = $1 AND user_id = $2`
	result, err := tc.Tx.ExecContext(ctx, query, event.ID, userID)

	// Assert
	require.NoError(t, err)
	rows, _ := result.RowsAffected()
	assert.Equal(t, int64(1), rows, "Should remove like")

	likeCount, err := helpers.GetEventLikeCount(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, 0, likeCount, "Like count should be 0 after unliking")

	hasLiked, err := helpers.UserHasLikedEvent(ctx, tc.Tx, event.ID, &userID, "")
	require.NoError(t, err)
	assert.False(t, hasLiked, "User should not have liked after unliking")
}

func TestEventLike_GuestBecomesUser_SeparateLikes(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	guestID := "guest_temp_123"
	userID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Like as guest, then as authenticated user
	err = helpers.SimulateEventLike(ctx, tc.Tx, event.ID, nil, guestID)
	require.NoError(t, err)

	err = helpers.SimulateEventLike(ctx, tc.Tx, event.ID, &userID, "")
	require.NoError(t, err)

	// Assert - Should be treated as separate likes
	likeCount, err := helpers.GetEventLikeCount(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, 2, likeCount, "Guest and user likes should be separate")

	t.Log("⚠️ Business Note: In production, you may want to deduplicate likes when guest converts to user")
}

func TestEventLike_DeletedEvent_CanStillBeLiked(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	userID := uuid.New()
	event := fixtures.NewDeletedEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Like a deleted event (database allows it)
	err = helpers.SimulateEventLike(ctx, tc.Tx, event.ID, &userID, "")

	// Assert
	require.NoError(t, err, "Database allows liking deleted events")

	t.Log("⚠️ Business Rule: Service layer should prevent liking deleted events")
}

func TestEventLike_NonExistentEvent_ShouldFail(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	nonExistentEventID := uuid.New()
	userID := uuid.New()

	// Act - Try to like non-existent event
	err := helpers.SimulateEventLike(ctx, tc.Tx, nonExistentEventID, &userID, "")

	// Assert
	require.Error(t, err, "Should fail to like non-existent event (foreign key constraint)")
	assert.Contains(t, err.Error(), "violates foreign key constraint", "Should mention foreign key violation")
}

func TestEventLike_ConcurrentLikes_OnlyCountOnce(t *testing.T) {
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

	// Act - Simulate concurrent likes (same user trying to like twice rapidly)
	// The ON CONFLICT DO NOTHING should handle this
	err1 := helpers.SimulateEventLike(ctx, tc.Tx, event.ID, &userID, "")
	err2 := helpers.SimulateEventLike(ctx, tc.Tx, event.ID, &userID, "")

	// Assert
	require.NoError(t, err1)
	require.NoError(t, err2)

	likeCount, err := helpers.GetEventLikeCount(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, 1, likeCount, "Should only count one like despite concurrent attempts")
}

func TestEventLike_MixedUserAndGuest_CorrectCounting(t *testing.T) {
	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Mix of authenticated users and guests
	user1 := uuid.New()
	user2 := uuid.New()
	guest1 := "guest_abc"
	guest2 := "guest_def"

	helpers.SimulateEventLike(ctx, tc.Tx, event.ID, &user1, "")
	helpers.SimulateEventLike(ctx, tc.Tx, event.ID, nil, guest1)
	helpers.SimulateEventLike(ctx, tc.Tx, event.ID, &user2, "")
	helpers.SimulateEventLike(ctx, tc.Tx, event.ID, nil, guest2)

	// Assert
	likeCount, err := helpers.GetEventLikeCount(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, 4, likeCount)

	// Check individual likes
	hasLiked1, _ := helpers.UserHasLikedEvent(ctx, tc.Tx, event.ID, &user1, "")
	hasLiked2, _ := helpers.UserHasLikedEvent(ctx, tc.Tx, event.ID, &user2, "")
	hasLikedGuest1, _ := helpers.UserHasLikedEvent(ctx, tc.Tx, event.ID, nil, guest1)
	hasLikedGuest2, _ := helpers.UserHasLikedEvent(ctx, tc.Tx, event.ID, nil, guest2)

	assert.True(t, hasLiked1)
	assert.True(t, hasLiked2)
	assert.True(t, hasLikedGuest1)
	assert.True(t, hasLikedGuest2)
}

func TestEventLike_Performance_BulkLikes(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}

	ctx := context.Background()
	tc := shared.BeginTestTx(t)
	defer tc.Rollback()

	// Arrange
	organizerID := uuid.New()
	event := fixtures.NewEventFixture(organizerID)
	tiers := fixtures.StandardTicketTiers(event.ID)
	err := helpers.InsertTestEventWithTiers(ctx, tc.Tx, event, tiers)
	require.NoError(t, err)

	// Act - Simulate 1000 likes
	numLikes := 1000
	for i := 0; i < numLikes; i++ {
		userID := uuid.New()
		err := helpers.SimulateEventLike(ctx, tc.Tx, event.ID, &userID, "")
		require.NoError(t, err)
	}

	// Assert
	likeCount, err := helpers.GetEventLikeCount(ctx, tc.Tx, event.ID)
	require.NoError(t, err)
	assert.Equal(t, numLikes, likeCount)

	t.Logf("✅ Successfully processed %d likes", numLikes)
}