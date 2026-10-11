// backend/pkg/handlers/auth/password_reset_token.go
package auth

import (
	"net/http"

	"github.com/eventify/backend/pkg/models"
	"github.com/gin-gonic/gin"
)

// VerifyResetToken checks if the token in the URL is still valid
func (h *AuthHandler) VerifyResetToken(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, models.PasswordResetResponse{
			Message: "Reset token is required.",
			Valid:   false,
		})
		return
	}

	isValid, err := h.AuthService.VerifyResetToken(c.Request.Context(), token)
	if err != nil || !isValid {
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

// ResetPassword updates the password and kills all active sessions
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request payload."})
		return
	}

	err := h.AuthService.ResetPassword(c.Request.Context(), req.Token, req.NewPassword)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Failed to reset password. Link may be expired."})
		return
	}

	c.JSON(http.StatusOK, models.PasswordResetResponse{
		Message: "Password reset successful! Please log in with your new password.",
	})
}
