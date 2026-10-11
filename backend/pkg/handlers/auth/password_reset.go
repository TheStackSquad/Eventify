// backend/pkg/handlers/auth/password_reset/password_reset.go
package auth

import (
	"net/http"
	"github.com/eventify/backend/pkg/models"
	"github.com/gin-gonic/gin"
)

// ForgotPassword handles the initial request for a password reset
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req models.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid email address."})
		return
	}

	// The Service handles user lookup, token generation, and DB saving.
	// We ignore the returned link/error details for the public response to prevent enumeration.
	_, _ = h.AuthService.ForgotPassword(c.Request.Context(), req.Email)

	c.JSON(http.StatusOK, models.PasswordResetResponse{
		Message: "If that email exists, a reset link has been sent.",
	})
}