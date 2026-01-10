// backend/pkg/repository/like/like_read_repo.go

package like

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// Helper function to find the like using a user or guest ID
func findLikeFilter(eventID uuid.UUID, userID *uuid.UUID, guestID string) (string, []any, error) {
	if userID != nil {
		return "event_id = $1 AND user_id = $2", []any{eventID, *userID}, nil
	}
	if guestID != "" {
		return "event_id = $1 AND guest_id = $2", []any{eventID, guestID}, nil
	}
	return "", nil, errors.New("cannot identify like without user_id or guest_id")
}

// GetLikeCount retrieves the total like count for a single event
func (r *postgresLikeRepository) GetLikeCount(ctx context.Context, eventID uuid.UUID) (int, error) {
	query := "SELECT COUNT(id) FROM likes WHERE event_id = $1"
	var count int
	err := r.db.QueryRowContext(ctx, query, eventID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get like count: %w", err)
	}
	return count, nil
}

// CheckIfLiked checks if a user/guest has liked a specific event
func (r *postgresLikeRepository) CheckIfLiked(ctx context.Context, eventID uuid.UUID, userID *uuid.UUID, guestID string) (bool, error) {
	filterClause, args, err := findLikeFilter(eventID, userID, guestID)
	if err != nil {
		// If neither ID is provided, it's not liked by an identifiable entity
		return false, nil
	}

	query := fmt.Sprintf("SELECT 1 FROM likes WHERE %s LIMIT 1", filterClause)

	var exists int
	err = r.db.QueryRowContext(ctx, query, args...).Scan(&exists)

	if err == nil {
		return true, nil // Row found
	}
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil // Row not found
	}

	return false, fmt.Errorf("failed to check like status: %w", err)
}

// GetLikeCountsForEvents retrieves like counts for multiple events in a single query
func (r *postgresLikeRepository) GetLikeCountsForEvents(ctx context.Context, eventIDs []uuid.UUID) (map[string]int, error) {
	if len(eventIDs) == 0 {
		return make(map[string]int), nil
	}

	// 1. Prepare the query using pq.Array for efficient IN clause
	query := `
		SELECT 
			event_id,
			COUNT(id) AS count
		FROM likes
		WHERE event_id = ANY($1) -- $1 is an array of UUIDs
		GROUP BY event_id
	`

	// 2. Query the database
	rows, err := r.db.QueryContext(ctx, query, pq.Array(eventIDs))
	if err != nil {
		return nil, fmt.Errorf("failed to get batch like counts: %w", err)
	}
	defer rows.Close()

	// 3. Process results
	result := make(map[string]int)
	for rows.Next() {
		var eventID uuid.UUID
		var count int
		if err := rows.Scan(&eventID, &count); err != nil {
			return nil, fmt.Errorf("failed to scan batch like count row: %w", err)
		}

		// Use .String() instead of .Hex()
		result[eventID.String()] = count
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	return result, nil
}

// GetUserLikedEvents retrieves which events the current user/guest has liked
func (r *postgresLikeRepository) GetUserLikedEvents(ctx context.Context, eventIDs []uuid.UUID, userID *uuid.UUID, guestID string) (map[string]bool, error) {
	if len(eventIDs) == 0 || (userID == nil && guestID == "") {
		return make(map[string]bool), nil
	}

	// 1. Build the dynamic WHERE clause for user or guest
	var filterClause string
	var args []any

	// The first argument $1 will always be the array of event IDs
	args = append(args, pq.Array(eventIDs))

	if userID != nil {
		filterClause = "user_id = $2" // $2 is the user ID
		args = append(args, *userID)
	} else if guestID != "" {
		filterClause = "guest_id = $2" // $2 is the guest ID
		args = append(args, guestID)
	} else {
		// Already checked this at the start, but good safety net
		return make(map[string]bool), nil
	}

	// 2. Prepare the final query
	query := fmt.Sprintf(`
		SELECT event_id
		FROM likes
		WHERE event_id = ANY($1) AND %s
	`, filterClause)

	// 3. Execute the query
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get batch user likes: %w", err)
	}
	defer rows.Close()

	// 4. Process results
	result := make(map[string]bool)
	for rows.Next() {
		var eventID uuid.UUID
		if err := rows.Scan(&eventID); err != nil {
			return nil, fmt.Errorf("failed to scan batch user like row: %w", err)
		}
		result[eventID.String()] = true // Use .String()
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	return result, nil
}