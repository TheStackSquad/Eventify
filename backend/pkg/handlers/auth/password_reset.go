// backend/pkg/handlers/auth/password_reset/password_reset.go

package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"
	"time"

	"github.com/eventify/backend/pkg/models"

	"github.com/gin-gonic/gin"
	//"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func generateResetToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req models.ForgotPasswordRequest
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid email address.",
		})
		return
	}

	user, err := h.AuthRepo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		c.JSON(http.StatusOK, models.PasswordResetResponse{
			Message: "If that email exists, a reset link has been sent.",
		})
		return
	}

	token, err := generateResetToken()
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate reset token")
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to process password reset request.",
		})
		return
	}

	expiry := time.Now().Add(ResetTokenExpiry)
	err = h.AuthRepo.SavePasswordResetToken(ctx, req.Email, token, expiry)
	if err != nil {
		log.Error().Err(err).Msg("Failed to save reset token")
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to process password reset request.",
		})
		return
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	resetLink := frontendURL + "/reset-password/" + token

	log.Info().
		Str("email", user.Email).
		Str("reset_link", resetLink).
		Msg("Password reset link generated")

	c.JSON(http.StatusOK, models.PasswordResetResponse{
		Message: "If that email exists, a reset link has been sent.",
	})
}