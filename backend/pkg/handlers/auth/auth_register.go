//backend/pkg/handlers/auth_register.go
package auth

import (
	"net/http"
	"github.com/eventify/backend/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Signup handles new user registration
func (h *AuthHandler) Signup(c *gin.Context) {
	var user models.User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid input details."})
		return
	}

	userID, err := h.AuthService.Signup(c.Request.Context(), &user)
	if err != nil {
		log.Error().Err(err).Msg("Auth: Signup service failure")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Could not create account."})
		return
	}

	log.Info().Str("user_id", userID.String()[:8]).Msg("Auth: New user registered")
	c.JSON(http.StatusCreated, models.AuthResponse{Message: "Signup successful!"})
}

// GetCurrentUser fetches the authenticated user's profile
func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	val, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized access."})
		return
	}

	userID := val.(uuid.UUID) 

	userProfile, err := h.AuthService.GetUserProfile(c.Request.Context(), userID)
	if err != nil {
		log.Warn().Err(err).Str("user_id", userID.String()[:8]).Msg("Auth: User profile not found")
		clearAuthCookies(c)
		c.JSON(http.StatusUnauthorized, gin.H{"message": "User session invalid."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": userProfile})
}