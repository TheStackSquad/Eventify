// backend/pkg/services/like/like_read.go

package like

import (
	"context"

	"eventify/backend/pkg/utils"
	"github.com/google/uuid"
)

// GetLikeCount retrieves the total like count for a single event
func (s *likeService) GetLikeCount(ctx context.Context, eventID uuid.UUID) (int, error) { // eventID is now uuid.UUID
	return s.likeRepo.GetLikeCount(ctx, eventID)
}

// CheckIfLiked checks if a user/guest has liked a specific event
func (s *likeService) CheckIfLiked(ctx context.Context, eventID uuid.UUID, userIDStr string, guestIDStr string) (bool, error) { // eventID is now uuid.UUID
	var userID *uuid.UUID // Changed to *uuid.UUID

	if userIDStr != "" {
		id, err := uuid.Parse(userIDStr) // Using uuid.Parse
		if err != nil {
			return false, err
		}
		userID = &id
	}

	return s.likeRepo.CheckIfLiked(ctx, eventID, userID, guestIDStr)
}

// GetBatchLikeCounts retrieves like counts for multiple events in a single query
// Performance: 1 database query regardless of event count
func (s *likeService) GetBatchLikeCounts(ctx context.Context, eventIDs []uuid.UUID) (map[string]int, error) { // eventIDs is now []uuid.UUID
	// Delegate directly to repository
	likeCounts, err := s.likeRepo.GetLikeCountsForEvents(ctx, eventIDs)
	if err != nil {
		return nil, utils.NewError(
			utils.ErrCategoryDatabase,
			"Failed to retrieve batch like counts",
			err,
		)
	}

	return likeCounts, nil
}

// GetBatchUserLikes checks if a user/guest has liked multiple events in a single query
// Performance: 1 database query regardless of event count
func (s *likeService) GetBatchUserLikes(ctx context.Context, eventIDs []uuid.UUID, userIDStr string, guestIDStr string) (map[string]bool, error) { // eventIDs is now []uuid.UUID
	// Parse user ID if authenticated
	var userID *uuid.UUID // Changed to *uuid.UUID

	if userIDStr != "" {
		id, err := uuid.Parse(userIDStr) // Using uuid.Parse
		if err != nil {
			return nil, utils.NewError(
				utils.ErrCategoryValidation,
				"Invalid User ID format in batch operation",
				err,
			)
		}
		userID = &id
	}

	// Delegate to repository
	userLikes, err := s.likeRepo.GetUserLikedEvents(ctx, eventIDs, userID, guestIDStr)
	if err != nil {
		return nil, utils.NewError(
			utils.ErrCategoryDatabase,
			"Failed to retrieve batch user likes",
			err,
		)
	}

	return userLikes, nil
}