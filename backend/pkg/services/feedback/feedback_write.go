// backend/pkg/service/feedback/feedback_write.go

package feedback

import (
	"context"
	"database/sql"
	"fmt"
	"time"
	"errors"

	"github.com/eventify/backend/pkg/models"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (s *feedbackService) CreateFeedback(ctx context.Context, req models.CreateFeedbackRequest, userID *uuid.UUID, guestID string) (*models.FeedbackResponse, error) {
	// Validate the request
	if err := req.Validate(); err != nil {
		log.Warn().Err(err).Msg("Feedback request validation failed")
		return nil, err
	}

	now := time.Now()
	
	feedback := &models.Feedback{
		ID:        uuid.New(),
		Name:      req.Name,
		Email:     req.Email,
		Type:      req.Type,
		Message:   req.Message,
		GuestID:   guestID,
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Handle optional UserID
	if userID != nil {
		feedback.UserID = sql.Null[uuid.UUID]{V: *userID, Valid: true}
		log.Debug().Str("user_id", userID.String()).Msg("Feedback associated with user")
	} else {
		feedback.UserID = sql.Null[uuid.UUID]{Valid: false}
		log.Debug().Str("guest_id", guestID).Msg("Feedback from guest user")
	}

	// Handle optional ImageURL - convert from pointer to sql.NullString
	feedback.ImageURL = models.ToSQLNullString(req.ImageURL)
	if feedback.ImageURL.Valid {
		log.Debug().Str("image_url", feedback.ImageURL.String).Msg("Feedback includes image")
	}

	// Create feedback in repository
	err := s.repo.CreateFeedback(ctx, feedback)
	if err != nil {
		log.Error().Err(err).Str("email", req.Email).Msg("Failed to create feedback in repository")
		return nil, fmt.Errorf("failed to create feedback: %w", err)
	}

	log.Info().
		Str("feedback_id", feedback.ID.String()).
		Str("type", string(feedback.Type)).
		Str("email", feedback.Email).
		Bool("has_image", feedback.ImageURL.Valid).
		Msg("Feedback created successfully")

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