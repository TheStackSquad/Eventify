// backend/pkg/services/like/like_write.go

package like

import (
	"context"

	"github.com/eventify/backend/pkg/utils"
	"github.com/google/uuid"
)

// ToggleLike executes the atomic like/unlike operation and returns the final state.
func (s *likeService) ToggleLike(ctx context.Context, eventIDStr string, userIDStr string, guestIDStr string) (*LikeToggleResponse, error) {
	// 1. Validate and Parse Event ID (Using uuid.Parse)
	eventID, err := uuid.Parse(eventIDStr)
	if err != nil {
		return nil, utils.NewError(
			utils.ErrCategoryValidation,
			"Invalid Event ID format",
			utils.ErrInvalidInput,
		)
	}

	var userID *uuid.UUID // Changed to *uuid.UUID

	// 2. Determine and Validate User/Guest ID
	if userIDStr != "" {
		// User is Authenticated: Parse and set the UserID pointer
		id, err := uuid.Parse(userIDStr) // Using uuid.Parse
		if err != nil {
			return nil, utils.NewError(
				utils.ErrCategoryValidation,
				"Invalid User ID format",
				utils.ErrInvalidInput,
			)
		}
		userID = &id // Set the pointer to the parsed UUID
	} else if guestIDStr == "" {
		// User is NOT authenticated AND no Guest ID is provided
		return nil, utils.NewError(
			utils.ErrCategoryValidation,
			"Missing user or guest identifier. Cannot record like.",
			utils.ErrInvalidInput,
		)
	}

	// If userID is nil, we proceed with the guestIDStr

	// 3. Toggle Like in Repository (Arguments are now uuid.UUID and *uuid.UUID)
	isLiked, err := s.likeRepo.ToggleLike(ctx, eventID, userID, guestIDStr)
	if err != nil {
		return nil, utils.NewError(
			utils.ErrCategoryDatabase,
			"Failed to toggle like status in DB",
			err,
		)
	}

	// 4. Get Final Like Count
	newCount, err := s.likeRepo.GetLikeCount(ctx, eventID)
	if err != nil {
		return nil, utils.NewError(
			utils.ErrCategoryDatabase,
			"Failed to retrieve final like count",
			err,
		)
	}

	// 5. Success Response
	return &LikeToggleResponse{
		EventID:      eventIDStr,
		NewLikeCount: newCount,
		IsLiked:      isLiked,
	}, nil
}