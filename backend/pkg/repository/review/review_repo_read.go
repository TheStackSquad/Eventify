//backend/pkg/repository/review/review_repo_read.go

package review

import (
	"context"
	//"database/sql"
	"fmt"
	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

func (r *PostgresReviewRepository) GetByVendorID(ctx context.Context, id uuid.UUID) ([]models.Review, error) {
	var reviews []models.Review
	// Explicitly select columns and COALESCE strings to avoid any NULL during scan
	query := `
		SELECT id, vendor_id, user_id, rating, comment, 
		       COALESCE(user_name, 'Annonymos') as user_name, 
		       COALESCE(email, '') as email, 
		       ip_address, is_verified, trust_weight, created_at, updated_at 
		FROM reviews 
		WHERE vendor_id = $1 
		ORDER BY created_at DESC`
	
	err := r.DB.SelectContext(ctx, &reviews, query, id)
	return reviews, err
}

func (r *PostgresReviewRepository) GetApprovedByVendorID(ctx context.Context, id uuid.UUID) ([]models.Review, error) {
	var reviews []models.Review
	err := r.DB.SelectContext(ctx, &reviews, "SELECT * FROM reviews WHERE vendor_id = $1 AND is_approved = TRUE ORDER BY created_at DESC", id)
	return reviews, err
}

func (r *PostgresReviewRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Review, error) {
	var review models.Review
	err := r.DB.GetContext(ctx, &review, "SELECT * FROM reviews WHERE id = $1", id)
	if err != nil { return nil, err }
	return &review, nil
}

func (r *PostgresReviewRepository) GetAverageRating(ctx context.Context, vendorID uuid.UUID) (float64, int64, error) {
	return r.calculateWeightedAverage(ctx, vendorID, false)
}

func (r *PostgresReviewRepository) GetApprovedAverageRating(ctx context.Context, vendorID uuid.UUID) (float64, int64, error) {
	return r.calculateWeightedAverage(ctx, vendorID, true)
}

func (r *PostgresReviewRepository) calculateWeightedAverage(ctx context.Context, vendorID uuid.UUID, approvedOnly bool) (float64, int64, error) {
	filter := "vendor_id = $1"
	if approvedOnly { filter += " AND is_approved = TRUE" }

	// Ensure trust_weight is used to calculate a more accurate rating for 20k MAU
	query := fmt.Sprintf(`
		SELECT COALESCE(SUM(CAST(rating AS FLOAT) * trust_weight) / NULLIF(SUM(trust_weight), 0), 0), COUNT(id)
		FROM reviews WHERE %s`, filter)

	var avg float64
	var count int64
	err := r.DB.QueryRowContext(ctx, query, vendorID).Scan(&avg, &count)
	return avg, count, err
}