//backend/pkg/repository/review/reviews_repo.go

package review

import (
	"context"
	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ReviewRepository interface {
	// Write Operations
	Create(ctx context.Context, review *models.Review) error
	
	// Trust/Verification Operations
	CheckInteraction(ctx context.Context, vendorID uuid.UUID, userID *uuid.UUID, emailOrIP string) (bool, error)
	
	// Read Operations
	FindByID(ctx context.Context, id uuid.UUID) (*models.Review, error)
	GetByVendorID(ctx context.Context, vendorID uuid.UUID) ([]models.Review, error)
	GetApprovedByVendorID(ctx context.Context, vendorID uuid.UUID) ([]models.Review, error)
	GetAverageRating(ctx context.Context, vendorID uuid.UUID) (float64, int64, error)
}

type PostgresReviewRepository struct {
	DB *sqlx.DB
}

func NewPostgresReviewRepository(db *sqlx.DB) ReviewRepository {
	return &PostgresReviewRepository{DB: db} //this line throws an error 
}