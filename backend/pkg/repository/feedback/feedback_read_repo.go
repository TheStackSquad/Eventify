// backend/pkg/repository/feedback/feedback_read_repo.go

package feedback

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (r *postgresFeedbackRepository) GetAllFeedback(ctx context.Context) ([]models.Feedback, error) {
	var feedbackList []models.Feedback

	query := `
		SELECT *
		FROM feedback
		ORDER BY created_at DESC
	`

	err := r.db.SelectContext(ctx, &feedbackList, query)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch all feedback from DB")
		return nil, fmt.Errorf("repository failed to fetch all feedback: %w", err)
	}

	log.Info().Int("count", len(feedbackList)).Msg("Fetched all feedback")
	return feedbackList, nil
}

func (r *postgresFeedbackRepository) GetFeedbackByID(ctx context.Context, id uuid.UUID) (*models.Feedback, error) {
	var feedback models.Feedback
	query := "SELECT * FROM feedback WHERE id = $1"

	err := r.db.GetContext(ctx, &feedback, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Str("feedback_id", id.String()).Msg("Feedback not found in DB")
			return nil, errors.New("feedback not found")
		}
		log.Error().Err(err).Str("feedback_id", id.String()).Msg("Failed to fetch feedback")
		return nil, fmt.Errorf("repository failed to fetch feedback: %w", err)
	}

	return &feedback, nil
}