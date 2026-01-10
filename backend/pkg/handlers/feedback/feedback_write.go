// backend/pkg/handlers/feedback/feedback_write.go

package feedback

import (
	"context"
	"errors"
	"net/http"
	"time"

	"eventify/backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// CreateFeedback handles user submissions of feedback (POST /api/v1/feedback)
func (h *FeedbackHandler) CreateFeedback(c *gin.Context) {
	var req models.CreateFeedbackRequest
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid request format"})
		return
	}

	// 1. Get User/Guest ID from context
	var userID *uuid.UUID
	if idVal, exists := c.Get("user_id"); exists {
		if id, ok := idVal.(uuid.UUID); ok {
			userID = &id
		}
	}
	// Assuming Guest ID is handled by a previous middleware and retrieved from cookies or context
	guestID, _ := c.Cookie("guest_id") // Adjust if you store guestID in context

	// 2. Call service layer
	response, err := h.service.CreateFeedback(ctx, req, userID, guestID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create feedback")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to submit feedback"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"status": "success",
		"data":   response,
	})
}

// DeleteFeedback handles admin requests to remove feedback (DELETE /api/v1/admin/feedback/:id)
func (h *FeedbackHandler) DeleteFeedback(c *gin.Context) {
	feedbackID := c.Param("id")

	if _, err := uuid.Parse(feedbackID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid feedback ID format"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	err := h.service.DeleteFeedback(ctx, feedbackID)
	if err != nil {
		if errors.Is(err, errors.New("feedback not found")) {
			c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Feedback not found"})
			return
		}
		log.Error().Err(err).Str("feedback_id", feedbackID).Msg("Failed to delete feedback")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to delete feedback"})
		return
	}

	log.Info().Str("feedback_id", feedbackID).Msg("Feedback deleted by admin")
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Feedback deleted"})
}