//backend/pkg/repository/review/reviews_repo.go

package review

import (
	"context"
	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ReviewRepository interface {
	Create(ctx context.Context, review *models.Review) error
	CheckInteraction(ctx context.Context, vendorID uuid.UUID, userID *uuid.UUID, emailOrIP string) (bool, error)
	FindByID(ctx context.Context, id uuid.UUID) (*models.Review, error)
	GetByVendorID(ctx context.Context, vendorID uuid.UUID) ([]models.Review, error)
	GetApprovedByVendorID(ctx context.Context, vendorID uuid.UUID) ([]models.Review, error)
	GetAverageRating(ctx context.Context, vendorID uuid.UUID) (float64, int64, error)
	GetApprovedAverageRating(ctx context.Context, vendorID uuid.UUID) (float64, int64, error) // Added this
}

type PostgresReviewRepository struct {
	DB *sqlx.DB
}

func NewPostgresReviewRepository(db *sqlx.DB) ReviewRepository {
	return &PostgresReviewRepository{DB: db}
}