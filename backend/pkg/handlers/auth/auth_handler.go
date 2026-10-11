// backend/pkg/handlers/auth/auth_handler.go

package auth

import (
	"net/http"

	"github.com/eventify/backend/pkg/models"
	serviceauth "github.com/eventify/backend/pkg/services/auth"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// Login handles user authentication with device metadata capture
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request."})
		return
	}

	ip := c.ClientIP()
	ua := c.Request.UserAgent()

	user, tokens, err := h.AuthService.Login(
		c.Request.Context(),
		req.Email,
		req.Password,
		ip,
		ua,
		req.RememberMe,
	)

	if err != nil {
		switch err {
		case serviceauth.ErrAccountLocked:
			c.JSON(http.StatusForbidden, gin.H{"message": "Account temporarily locked."})
		case serviceauth.ErrInvalidCredentials:
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid email or password."})
		default:
			log.Error().Err(err).Msg("Auth: Unexpected error during login")
			c.JSON(http.StatusInternalServerError, gin.H{"message": "An internal error occurred."})
		}
		return
	}

	setAuthCookies(c, tokens.AccessToken, tokens.RefreshToken, req.RememberMe)

	log.Info().
		Str("user_id", user.ID.String()).
		Str("ip", ip).
		Str("user_agent", ua).
		Bool("rememberMe", req.RememberMe).
		Msg("Auth: Login successful")

	c.JSON(http.StatusOK, models.AuthResponse{
		Message: "Welcome back!",
		User:    user,
	})
}