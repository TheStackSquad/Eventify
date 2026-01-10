//backend/pkg/repository/ vendor/vendor_data_repo.go
package vendor

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type PostgresVendorDataRepository struct {
	db *sqlx.DB
}

// GetRecentInquiries fetches most recent inquiries for a vendor.
func (r *PostgresVendorDataRepository) GetRecentInquiries(
	ctx context.Context,
	vendorID uuid.UUID,
	limit int,
) ([]models.RecentInquiry, error) {
	query := `SELECT id, name, email, message, created_at FROM inquiries WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT $2`
	rows, err := r.db.QueryContext(ctx, query, vendorID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch recent inquiries: %w", err)
	}
	defer rows.Close()

	var inquiries []models.RecentInquiry
	for rows.Next() {
		var inquiry struct {
			ID        uuid.UUID
			Name      string
			Email     string
			Message   string
			CreatedAt time.Time
		}
		if err := rows.Scan(&inquiry.ID, &inquiry.Name, &inquiry.Email, &inquiry.Message, &inquiry.CreatedAt); err != nil {
			continue // Log error in production
		}
		inquiries = append(inquiries, models.RecentInquiry{
			ID:        inquiry.ID.String(),
			Name:      inquiry.Name,
			Email:     inquiry.Email,
			Message:   inquiry.Message,
			CreatedAt: inquiry.CreatedAt,
		})
	}
	return inquiries, nil
}

// GetRecentReviews fetches most recent reviews for a vendor.
func (r *PostgresVendorDataRepository) GetRecentReviews(
	ctx context.Context,
	vendorID uuid.UUID,
	limit int,
) ([]models.RecentReview, error) {
	query := `SELECT id, rating, comment, user_name, created_at FROM reviews WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT $2`
	rows, err := r.db.QueryContext(ctx, query, vendorID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch recent reviews: %w", err)
	}
	defer rows.Close()

	var reviews []models.RecentReview
	for rows.Next() {
		var review struct {
			ID        uuid.UUID
			Rating    int32
			Comment   string
			UserName  sql.NullString
			CreatedAt time.Time
		}
		if err := rows.Scan(&review.ID, &review.Rating, &review.Comment, &review.UserName, &review.CreatedAt); err != nil {
			continue // Log error in production
		}
		userName := ""
		if review.UserName.Valid {
			userName = review.UserName.String
		}
		reviews = append(reviews, models.RecentReview{
			ID:        review.ID.String(),
			Rating:    int(review.Rating),
			Comment:   review.Comment,
			UserName:  userName,
			CreatedAt: review.CreatedAt,
		})
	}
	return reviews, nil
}