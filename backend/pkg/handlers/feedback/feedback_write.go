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

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// SuccessResponse represents a standardized success response
type SuccessResponse struct {
	Status string      `json:"status"`
	Data   interface{} `json:"data"`
}

// CreateFeedback handles user submissions of feedback (POST /api/v1/feedback)
func (h *FeedbackHandler) CreateFeedback(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Parse and validate request
	var req models.CreateFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("Failed to bind CreateFeedbackRequest")
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Status:  "error",
			Message: "Invalid request format",
			Details: err.Error(),
		})
		return
	}

	log.Debug().
		Str("name", req.Name).
		Str("email", req.Email).
		Str("type", string(req.Type)).
		Bool("has_image", req.ImageURL.Valid).
		Msg("Received feedback creation request")

	// Get User ID from context (set by OptionalAuth middleware)
	var userID *uuid.UUID
	if idVal, exists := c.Get("user_id"); exists {
		if id, ok := idVal.(uuid.UUID); ok {
			userID = &id
			log.Debug().Str("user_id", id.String()).Msg("Request from authenticated user")
		}
	}

	// Get Guest ID from cookie (set by GuestMiddleware)
	guestID, err := c.Cookie("guest_id")
	if err != nil || guestID == "" {
		log.Warn().Err(err).Msg("No guest_id cookie found")
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Status:  "error",
			Message: "Guest session required",
		})
		return
	}

	// Call service layer to create feedback
	response, err := h.service.CreateFeedback(ctx, req, userID, guestID)
	if err != nil {
		// Check for validation errors
		var validationErr models.ValidationError
		if errors.As(err, &validationErr) {
			log.Warn().Err(err).Msg("Validation error in feedback creation")
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Status:  "error",
				Message: validationErr.Error(),
			})
			return
		}

		// Check for context errors
		if errors.Is(err, context.DeadlineExceeded) {
			log.Error().Err(err).Msg("Request timeout creating feedback")
			c.JSON(http.StatusRequestTimeout, ErrorResponse{
				Status:  "error",
				Message: "Request timeout",
			})
			return
		}

		// Generic internal error
		log.Error().Err(err).Msg("Failed to create feedback")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Status:  "error",
			Message: "Failed to submit feedback. Please try again later.",
		})
		return
	}

	log.Info().
		Str("feedback_id", response.ID).
		Str("email", response.Email).
		Msg("Feedback created successfully")

	c.JSON(http.StatusCreated, SuccessResponse{
		Status: "success",
		Data:   response,
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