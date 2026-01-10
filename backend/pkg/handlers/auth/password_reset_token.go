// backend/pkg/handlers/auth/password_reset_token.go

package auth

import (
	"context"
	"net/http"
	"time"

	"eventify/backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

func (h *AuthHandler) VerifyResetToken(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, models.PasswordResetResponse{
			Message: "Reset token is required.",
			Valid:   false,
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := h.AuthRepo.GetUserByResetToken(ctx, token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.PasswordResetResponse{
			Message: "Invalid or expired reset token.",
			Valid:   false,
		})
		return
	}

	c.JSON(http.StatusOK, models.PasswordResetResponse{
		Message: "Reset token is valid.",
		Valid:   true,
	})
}

// Invalidate all sessions on password change

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request.",
		})
		return
	}

	user, err := h.AuthRepo.GetUserByResetToken(ctx, req.Token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": "Invalid or expired reset token.",
		})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword(
		[]byte(req.NewPassword),
		bcrypt.DefaultCost,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to hash new password")
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to reset password.",
		})
		return
	}

	err = h.AuthRepo.UpdatePassword(ctx, user.ID, string(hashedPassword))
	if err != nil {
		log.Error().Err(err).Msg("Failed to update password")
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to reset password.",
		})
		return
	}

	// Clear reset token
	_ = h.AuthRepo.ClearPasswordResetToken(ctx, user.ID)

	// ✅ WEEK 2 ENHANCEMENT: Revoke ALL refresh tokens (force re-login on all devices)
	err = h.RefreshTokenRepo.RevokeAllUserTokens(ctx, user.ID)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to revoke all user tokens after password reset")
		// Continue anyway - password was changed successfully
	} else {
		log.Info().
			Str("user_id", user.ID.String()).
			Msg("All sessions invalidated after password reset")
	}

	log.Info().Str("user_id", user.ID.String()).Msg("Password reset successful")

	c.JSON(http.StatusOK, models.PasswordResetResponse{
		Message: "Password reset successful! Please log in with your new password.",
	})
}