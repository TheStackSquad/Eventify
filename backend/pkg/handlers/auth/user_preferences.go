// backend/pkg/handlers/auth/user_preferences.go

package auth

import (
	"net/http"

	repoauth "github.com/eventify/backend/pkg/repository/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type PreferencesHandler struct {
	AuthRepo repoauth.AuthRepository
}

func NewPreferencesHandler(authRepo repoauth.AuthRepository) *PreferencesHandler {
	return &PreferencesHandler{
		AuthRepo: authRepo,
	}
}

// GetPreferences - GET /api/user/preferences
func (h *PreferencesHandler) GetPreferences(c *gin.Context) {
	// Extract user ID from context (set by AuthMiddleware)
	userIDVal, exists := c.Get("user_id")
	if !exists {
		log.Error().Msg("User ID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		log.Error().Msg("Invalid user ID type in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid session"})
		return
	}

	user, err := h.AuthRepo.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID.String()).Msg("Failed to fetch user")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch preferences"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"allowReminderEmails": user.AllowReminderEmails,
	})
}

// UpdatePreferences - PATCH /api/user/preferences
func (h *PreferencesHandler) UpdatePreferences(c *gin.Context) {
	// Extract user ID from context (set by AuthMiddleware)
	userIDVal, exists := c.Get("user_id")
	if !exists {
		log.Error().Msg("User ID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		log.Error().Msg("Invalid user ID type in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid session"})
		return
	}

	var req struct {
		AllowReminderEmails bool `json:"allowReminderEmails"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("Invalid request body")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if err := h.AuthRepo.UpdateReminderPreference(c.Request.Context(), userID, req.AllowReminderEmails); err != nil {
		log.Error().Err(err).Str("user_id", userID.String()).Msg("Failed to update preferences")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update preferences"})
		return
	}

	log.Info().Str("user_id", userID.String()).Bool("allow_reminders", req.AllowReminderEmails).Msg("Email preferences updated")

	c.JSON(http.StatusOK, gin.H{
		"message":             "Preferences updated successfully",
		"allowReminderEmails": req.AllowReminderEmails,
	})
}