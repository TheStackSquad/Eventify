// backend/pkg/repository/feedback/onboard_repo.go

package feedback

import (
	"context"

	"eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type FeedbackRepository interface {
	CreateFeedback(ctx context.Context, feedback *models.Feedback) error
	GetAllFeedback(ctx context.Context) ([]models.Feedback, error)
	GetFeedbackByID(ctx context.Context, id uuid.UUID) (*models.Feedback, error)
	DeleteFeedback(ctx context.Context, id uuid.UUID) error
}

type postgresFeedbackRepository struct {
	db *sqlx.DB
}

func NewFeedbackRepository(db *sqlx.DB) FeedbackRepository {
	return &postgresFeedbackRepository{
		db: db,
	}
}