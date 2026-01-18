// backend/pkg/service/feedback/feedback_read.go

package feedback

import (
	"context"
	"errors"
	"fmt"

	"github.com/eventify/backend/pkg/models"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (s *feedbackService) GetAllFeedback(ctx context.Context) ([]models.FeedbackResponse, error) {
	log.Info().Msg("Fetching all feedback submissions")

	feedbackList, err := s.repo.GetAllFeedback(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch feedback from repository")
		return nil, fmt.Errorf("failed to fetch feedback: %w", err)
	}

	responses := make([]models.FeedbackResponse, 0, len(feedbackList))
	for _, feedback := range feedbackList {
		responses = append(responses, feedback.ToResponse())
	}

	log.Info().Int("count", len(responses)).Msg("Successfully fetched all feedback")
	return responses, nil
}

func (s *feedbackService) GetFeedbackByID(ctx context.Context, id string) (*models.FeedbackResponse, error) {
	// 1. Parse the string ID into a UUID
	parsedID, err := uuid.Parse(id)
	if err != nil {
		// Return a generic error if parsing fails; the handler catches this
		return nil, fmt.Errorf("invalid feedback ID format: %w", err)
	}
	
	// 2. Call the repository to fetch the data
	feedback, err := s.repo.GetFeedbackByID(ctx, parsedID)
	if err != nil {
		// Check for the "not found" error returned by the repository
		if errors.Is(err, errors.New("feedback not found")) {
			// Translate repository error into the model error expected by the handler
			return nil, models.ErrFeedbackNotFound
		}
		return nil, fmt.Errorf("failed to retrieve feedback: %w", err)
	}

	// 3. Convert the model to the response DTO
	response := feedback.ToResponse()
	return &response, nil
}