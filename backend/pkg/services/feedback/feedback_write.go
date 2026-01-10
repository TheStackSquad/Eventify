// backend/pkg/service/feedback/feedback_write.go

package feedback

import (
	"context"
	"errors"
	"fmt"
	"time"

	"eventify/backend/pkg/models"
	"database/sql"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (s *feedbackService) CreateFeedback(ctx context.Context, req models.CreateFeedbackRequest, userID *uuid.UUID, guestID string) (*models.FeedbackResponse, error) {
	now := time.Now()
	
	feedback := &models.Feedback{
		ID:        uuid.New(), // Ensure ID is generated
		Name:      req.Name,
		Email:     req.Email,
		Type:      req.Type,
		Message:   req.Message,
		ImageURL:  req.ImageURL,
		GuestID:   guestID,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if userID != nil {
		feedback.UserID = sql.Null[uuid.UUID]{V: *userID, Valid: true}
	} else {
		feedback.UserID = sql.Null[uuid.UUID]{Valid: false}
	}

	err := s.repo.CreateFeedback(ctx, feedback)
	if err != nil {
		return nil, fmt.Errorf("failed to create feedback: %w", err)
	}

	response := feedback.ToResponse()
	return &response, nil
}

func (s *feedbackService) DeleteFeedback(ctx context.Context, id string) error {
	log.Info().Str("feedback_id", id).Msg("Deleting feedback")

	parsedID, err := uuid.Parse(id)
	if err != nil {
		log.Error().Err(err).Str("feedback_id", id).Msg("Invalid feedback ID format")
		return fmt.Errorf("invalid feedback ID format: %w", err)
	}

	err = s.repo.DeleteFeedback(ctx, parsedID)
	if err != nil {
		if errors.Is(err, errors.New("feedback not found")) {
			return fmt.Errorf("feedback not found")
		}
		log.Error().Err(err).Str("feedback_id", id).Msg("Failed to delete feedback")
		return fmt.Errorf("failed to delete feedback: %w", err)
	}

	log.Info().Str("feedback_id", id).Msg("Feedback deleted successfully")
	return nil
}