// backend/pkg/handlers/feedback/feedback_read.go
// Feedback handler - read operations (admin only)

package feedback

import (
	"errors"
	"eventify/backend/pkg/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// GetAllFeedback retrieves all feedback (admin only)
// GET /api/admin/feedback
func (h *FeedbackHandler) GetAllFeedback(c *gin.Context) {
	log.Info().Msg("Admin fetching all feedback")

	feedbackList, err := h.service.GetAllFeedback(c.Request.Context())
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch feedback")
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to fetch feedback",
		})
		return
	}

	log.Info().
		Int("count", len(feedbackList)).
		Msg("Successfully fetched feedback for admin")

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"data":     feedbackList,
		"count":    len(feedbackList),
		"message":  "Feedback retrieved successfully",
	})
}

// GetFeedbackByID retrieves a specific feedback by ID (admin only)
// GET /api/admin/feedback/:id
func (h *FeedbackHandler) GetFeedbackByID(c *gin.Context) {
	feedbackID := c.Param("id")

	log.Info().
		Str("feedback_id", feedbackID).
		Msg("Admin fetching feedback by ID")

	response, err := h.service.GetFeedbackByID(c.Request.Context(), feedbackID)
	if err != nil {
		if errors.Is(err, models.ErrFeedbackNotFound) {
			log.Warn().
				Str("feedback_id", feedbackID).
				Msg("Feedback not found")
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Feedback not found",
			})
			return
		}

		// Check for invalid ID format
		if _, parseErr := uuid.Parse(feedbackID); parseErr != nil {
			log.Warn().
				Str("feedback_id", feedbackID).
				Msg("Invalid ID format")
			c.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Invalid feedback ID format",
			})
			return
		}

		log.Error().
			Err(err).
			Str("feedback_id", feedbackID).
			Msg("Failed to fetch feedback")
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to fetch feedback",
		})
		return
	}

	log.Info().
		Str("feedback_id", feedbackID).
		Msg("Feedback retrieved successfully")

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   response,
	})
}