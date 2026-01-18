// backend/pkg/repository/like/like_write_repo.go

package like

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

// ToggleLike executes the atomic like/unlike operation (read + write)
func (r *postgresLikeRepository) ToggleLike(ctx context.Context, eventID uuid.UUID, userID *uuid.UUID, guestID string) (bool, error) {
	filterClause, args, err := findLikeFilter(eventID, userID, guestID)
	if err != nil {
		return false, err
	}

	// 1. Attempt to UNLIKE (DELETE the existing row)
	deleteQuery := fmt.Sprintf("DELETE FROM likes WHERE %s RETURNING id", filterClause)

	// Note: We use QueryRowContext to see if a row was found/deleted.
	var deletedID uuid.UUID
	err = r.db.QueryRowContext(ctx, deleteQuery, args...).Scan(&deletedID)

	if err == nil {
		// If Scan succeeds, a row was deleted (Unliked)
		return false, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		// Real database error
		return false, fmt.Errorf("failed to delete like: %w", err)
	}

	// 2. Row was not found (sql.ErrNoRows), so proceed to LIKE (INSERT a new row)
	newLike := models.Like{
		ID:        uuid.New(), // Generate new UUID
		EventID:   eventID,
		CreatedAt: time.Now(),
	}

	// Set User/Guest ID using your nullable helper functions
	if userID != nil {
		newLike.UserID = models.ToNullUUID(*userID)
	} else {
		// Assuming models.ToNullString is correctly defined for standard string
		newLike.GuestID = models.ToNullString(guestID)
	}

	// SQL INSERT
	insertQuery := `
		INSERT INTO likes (id, event_id, user_id, guest_id, created_at)
		VALUES (:id, :event_id, :user_id, :guest_id, :created_at)
	`
	_, err = r.db.NamedExecContext(ctx, insertQuery, newLike)
	if err != nil {
		return false, fmt.Errorf("failed to insert like: %w", err)
	}

	return true, nil // Successfully inserted (Liked)
}