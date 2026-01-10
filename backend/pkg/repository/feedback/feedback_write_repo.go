// backend/pkg/repository/feedback/feedback_write_repo.go

package feedback

import (
	"context"
	"errors"
	"fmt"
	"time"

	"eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (r *postgresFeedbackRepository) CreateFeedback(ctx context.Context, feedback *models.Feedback) error {
	// 1. Set internal metadata (ID and timestamps)
	feedback.ID = uuid.New()
	feedback.CreatedAt = time.Now()
	feedback.UpdatedAt = time.Now()

	// 2. The SQL INSERT query
	// The ':user_id' placeholder will automatically receive NULL if feedback.UserID.Valid is false.
	query := `
		INSERT INTO feedback (id, user_id, type, message, image_url, name, email, created_at, updated_at)
		VALUES (:id, :user_id, :type, :message, :image_url, :name, :email, :created_at, :updated_at)
	`

	// 3. Execute the query using NamedExecContext
	// sqlx handles the sql.Null[uuid.UUID] -> NULL conversion automatically.
	_, err := r.db.NamedExecContext(ctx, query, feedback) 
	if err != nil {
		log.Error().Err(err).Msg("Failed to create feedback in DB")
		return fmt.Errorf("repository failed to insert feedback: %w", err)
	}

	log.Info().Str("feedback_id", feedback.ID.String()).Msg("Feedback created successfully")
	return nil
}

func (r *postgresFeedbackRepository) DeleteFeedback(ctx context.Context, id uuid.UUID) error {
	query := "DELETE FROM feedback WHERE id = $1"

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		log.Error().Err(err).Str("feedback_id", id.String()).Msg("Failed to delete feedback in DB")
		return fmt.Errorf("repository failed to delete feedback: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected after delete: %w", err)
	}

	if rowsAffected == 0 {
		log.Warn().Str("feedback_id", id.String()).Msg("No feedback found to delete in DB")
		return errors.New("feedback not found")
	}

	log.Info().Str("feedback_id", id.String()).Msg("Feedback deleted successfully")
	return nil
}