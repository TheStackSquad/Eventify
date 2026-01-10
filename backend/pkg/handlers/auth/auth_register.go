//backend/pkg/handlers/auth_register.go

package auth

import (
	"context"
	"eventify/backend/pkg/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

func (h *AuthHandler) Signup(c *gin.Context) {
	var user models.User
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&user); err != nil {
		// log.Error().Err(err).Msg("Signup: Binding failed") // Descriptive but commented
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid input."})
		return
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	user.PasswordHash = string(hashedPassword)
	user.Role = models.RoleCustomer

	if _, err := h.AuthRepo.CreateUser(ctx, &user); err != nil {
		log.Error().Err(err).Msg("Auth: Signup failed")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create account."})
		return
	}

	log.Info().Msgf("Auth: New user registered: %s", user.Email) // Smart Log
	c.JSON(http.StatusCreated, models.AuthResponse{Message: "Signup successful!"})
}

func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
    
	val, _ := c.Get("user_id")
	// Type assertion is safe here if middleware guarantees it
	userID := val.(uuid.UUID) 

	user, err := h.AuthRepo.GetUserByID(ctx, userID)

	// --- FIX: Check for both user not found (nil) OR database error ---
	if err != nil || user == nil {
		log.Warn().
			Err(err).
			Msgf("Auth: User ID %s in token failed DB lookup.", userID.String()[:8])
        
		// Use 401 Unauthorized to trigger frontend session clear/redirect
        // A 404 is also acceptable but 401 is more appropriate for session failure.
		c.JSON(http.StatusUnauthorized, gin.H{
            "message": "User not found or session invalid. Please log in again.",
        })
		return
	}

	log.Debug().Msgf("Auth: Profile fetched for %s", userID.String()[:8])
	
	// Ensure the payload matches what the frontend is expecting (user: {...})
	c.JSON(http.StatusOK, gin.H{"user": user.ToUserProfile(false, false)})
}