// backend/pkg/repository/like/like_repo.go

package like

import (
	"context"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ============================================================================
// REPOSITORY INTERFACE (Updated for UUIDs)
// ============================================================================

type LikeRepository interface {
	// Single event operations
	ToggleLike(ctx context.Context, eventID uuid.UUID, userID *uuid.UUID, guestID string) (bool, error)
	GetLikeCount(ctx context.Context, eventID uuid.UUID) (int, error)
	CheckIfLiked(ctx context.Context, eventID uuid.UUID, userID *uuid.UUID, guestID string) (bool, error)

	// Batch operations
	GetLikeCountsForEvents(ctx context.Context, eventIDs []uuid.UUID) (map[string]int, error)
	GetUserLikedEvents(ctx context.Context, eventIDs []uuid.UUID, userID *uuid.UUID, guestID string) (map[string]bool, error)
}

// ============================================================================
// IMPLEMENTATION (Updated for PostgreSQL/sqlx)
// ============================================================================

type postgresLikeRepository struct {
	db *sqlx.DB
}

func NewPostgresLikeRepository(db *sqlx.DB) LikeRepository {
	return &postgresLikeRepository{db: db}
}