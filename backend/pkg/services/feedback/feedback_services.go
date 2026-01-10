// backend/pkg/service/feedback/feedback_services.go

package feedback

import (
	"context"
	//"database/sql"

	"eventify/backend/pkg/models"
	repofeedback "eventify/backend/pkg/repository/feedback"
	
	"github.com/google/uuid"
)

type FeedbackService interface {
	CreateFeedback(ctx context.Context, req models.CreateFeedbackRequest, userID *uuid.UUID, guestID string) (*models.FeedbackResponse, error)
	GetAllFeedback(ctx context.Context) ([]models.FeedbackResponse, error)
	GetFeedbackByID(ctx context.Context, id string) (*models.FeedbackResponse, error)
	DeleteFeedback(ctx context.Context, id string) error
}

type feedbackService struct {
	repo repofeedback.FeedbackRepository
}

func NewFeedbackService(repo repofeedback.FeedbackRepository) FeedbackService {
	return &feedbackService{
		repo: repo,
	}
}