// backend/pkg/services/like/like_services.go

package like

import (
	"context"

	repolike "github.com/eventify/backend/pkg/repository/like"
	"github.com/google/uuid"
)

// LikeToggleResponse is the DTO (Data Transfer Object) matching the frontend's expected response.
type LikeToggleResponse struct {
	EventID      string `json:"eventId"`
	NewLikeCount int    `json:"likeCount"`
	IsLiked      bool   `json:"isLikedByUser"`
}

// LikeService defines the methods for handling the like business logic.
type LikeService interface {
	// Single event operations (Updated to use uuid.UUID)
	ToggleLike(ctx context.Context, eventIDStr string, userIDStr string, guestIDStr string) (*LikeToggleResponse, error)
	GetLikeCount(ctx context.Context, eventID uuid.UUID) (int, error)
	CheckIfLiked(ctx context.Context, eventID uuid.UUID, userIDStr string, guestIDStr string) (bool, error)

	// Batch operations (Updated to use uuid.UUID)
	GetBatchLikeCounts(ctx context.Context, eventIDs []uuid.UUID) (map[string]int, error)
	GetBatchUserLikes(ctx context.Context, eventIDs []uuid.UUID, userIDStr string, guestIDStr string) (map[string]bool, error)
}

// likeService implements the LikeService interface.
type likeService struct {
	likeRepo repolike.LikeRepository
}

// NewLikeService creates a new instance of LikeService.
func NewLikeService(lr repolike.LikeRepository) LikeService {
	return &likeService{
		likeRepo: lr,
	}
}