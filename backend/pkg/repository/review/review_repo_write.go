// backend/pkg/repository/review/review_repo_write.go

package review

import (
	"context"
	"fmt"
	"errors"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/lib/pq"
)
var ErrDuplicateReview = errors.New("models: review unique constraint violation")

// Create persists a review to the database.
// Review object should have IsVerified and TrustWeight set by service layer.
func (r *PostgresReviewRepository) Create(ctx context.Context, review *models.Review) error {
	if review.ID == uuid.Nil {
		review.ID = uuid.New()
	}

	query := `
		INSERT INTO reviews (
			id, vendor_id, user_id, user_name, email, rating, comment, 
			ip_address, is_verified, trust_weight, created_at, updated_at
		) VALUES (
			:id, :vendor_id, :user_id, :user_name, :email, :rating, :comment, 
			:ip_address, :is_verified, :trust_weight, NOW(), NOW()
		)`

_, err := r.DB.NamedExecContext(ctx, query, review)
	if err != nil {
		// 1. Check for Postgres specific error
		if pgErr, ok := err.(*pq.Error); ok {
			// 23505 is the code for unique_violation
			if pgErr.Code == "23505" || pgErr.Constraint == "idx_reviews_one_per_user_vendor" {
				return ErrDuplicateReview
			}
		}
		return fmt.Errorf("database error: %w", err)
	}

	return nil
}

// CheckInteraction verifies if a user has prior interaction with a vendor.
// Checks by userID (authenticated) or IP (guest).
func (r *PostgresReviewRepository) CheckInteraction(
	ctx context.Context,
	vendorID uuid.UUID,
	userID *uuid.UUID,
	ip string,
) (bool, error) {
	var exists bool
	var query string
	var args []interface{}

	// Authenticated user check
	if userID != nil {
		query = `SELECT EXISTS(SELECT 1 FROM inquiries WHERE vendor_id = $1 AND user_id = $2 LIMIT 1)`
		args = []interface{}{vendorID, userID}
	} else {
		// Guest user check by IP
		query = `SELECT EXISTS(SELECT 1 FROM inquiries WHERE vendor_id = $1 AND ip_address = $2 LIMIT 1)`
		args = []interface{}{vendorID, ip}
	}

	err := r.DB.GetContext(ctx, &exists, query, args...)
	if err != nil {
		return false, fmt.Errorf("database error during interaction check: %w", err)
	}

	return exists, nil
}