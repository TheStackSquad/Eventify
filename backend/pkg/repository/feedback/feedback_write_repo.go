// backend/pkg/repository/feedback/feedback_write_repo.go

package feedback

import (
	"context"
	"github.com/google/uuid"
	"errors"
	"fmt"

	"eventify/backend/pkg/models"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog/log"
)

func (r *postgresFeedbackRepository) CreateFeedback(ctx context.Context, feedback *models.Feedback) error {
	// Validate that required fields are set (defensive programming)
	if feedback.ID.String() == "00000000-0000-0000-0000-000000000000" {
		return fmt.Errorf("feedback ID is required")
	}
	if feedback.GuestID == "" {
		return fmt.Errorf("guest_id is required")
	}
	if feedback.Name == "" || feedback.Email == "" || feedback.Message == "" {
		return fmt.Errorf("name, email, and message are required fields")
	}

	query := `
		INSERT INTO feedback (
			id, 
			user_id, 
			guest_id, 
			type, 
			message, 
			image_url, 
			name, 
			email, 
			created_at, 
			updated_at
		)
		VALUES (
			:id, 
			:user_id, 
			:guest_id, 
			:type, 
			:message, 
			:image_url, 
			:name, 
			:email, 
			:created_at, 
			:updated_at
		)
	`

	result, err := r.db.NamedExecContext(ctx, query, feedback)
	if err != nil {
		// Check for specific database errors
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			log.Error().
				Str("code", pgErr.Code).
				Str("detail", pgErr.Detail).
				Str("constraint", pgErr.ConstraintName).
				Msg("Database constraint violation")

			// Handle specific constraint violations
			switch pgErr.Code {
			case "23505": // unique_violation
				return fmt.Errorf("duplicate feedback entry")
			case "23503": // foreign_key_violation
				return fmt.Errorf("invalid user reference")
			case "23502": // not_null_violation
				return fmt.Errorf("required field missing: %s", pgErr.ColumnName)
			default:
				return fmt.Errorf("database error: %s", pgErr.Message)
			}
		}

		log.Error().Err(err).
			Str("feedback_id", feedback.ID.String()).
			Msg("Failed to insert feedback into database")
		return fmt.Errorf("repository failed to insert feedback: %w", err)
	}

	// Verify the insert was successful
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Warn().Err(err).Msg("Could not verify rows affected")
	} else if rowsAffected == 0 {
		log.Warn().Msg("No rows were inserted")
		return fmt.Errorf("no rows inserted")
	}

	log.Debug().
		Str("feedback_id", feedback.ID.String()).
		Str("type", string(feedback.Type)).
		Bool("has_user", feedback.UserID.Valid).
		Bool("has_image", feedback.ImageURL.Valid).
		Msg("Feedback inserted into database successfully")

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