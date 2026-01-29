//backend/pkg/handlers/auth/auth_session.go

package auth

import (
	"net/http"
	 "time"
	"github.com/eventify/backend/pkg/models"
	serviceauth "github.com/eventify/backend/pkg/services/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Login handles user authentication with device metadata capture
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request."})
		return
	}

	// 1. Capture Metadata
	// We extract the IP and UserAgent here to pass to the service for security auditing
	ip := c.ClientIP()
	ua := c.Request.UserAgent()

	// 2. Service Call
	// The signature now matches the updated AuthService interface
	user, tokens, err := h.AuthService.Login(c.Request.Context(), req.Email, req.Password, ip, ua)
	
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

	// 3. Set Persistence
	setAuthCookies(c, tokens.AccessToken, tokens.RefreshToken)

	// 4. Response
	log.Info().
		Str("user_id", user.ID.String()).
		Str("ip", ip).
		Msg("Auth: Login successful")

	c.JSON(http.StatusOK, models.AuthResponse{
		Message: "Welcome back!",
		User:    user,
	})
}
// RefreshToken handles token rotation with metadata awareness
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	oldRefreshToken, err := c.Cookie(RefreshTokenCookieName)
	if err != nil || oldRefreshToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "No active session."})
		return
	}

	// 1. GATHER METADATA
	ipAddress := c.ClientIP()
	userAgent := c.Request.UserAgent()

	// 2. ATTEMPT REFRESH
	// FIXED: Pass ipAddress and userAgent to satisfy the "want 5 arguments" error
	tokens, err := h.AuthService.RefreshToken(
		c.Request.Context(), 
		oldRefreshToken, 
		time.Duration(AbsoluteSessionTimeout)*time.Second, // Ensure correct type
		ipAddress, 
		userAgent,
	)

	if err != nil {
		log.Debug().Err(err).Msg("Auth: Refresh process interrupted")

		switch err {
		case serviceauth.ErrSessionExpired:
			clearAuthCookies(c)
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": "SESSION_EXPIRED",
				"message": "Your session has expired. Please log in again.",
			})

		case serviceauth.ErrTokenReused: // Now defined in serviceauth
			clearAuthCookies(c)
			log.Warn().Str("ip", ipAddress).Msg("🚨 Security Alert: Token reuse attempt")
			c.JSON(http.StatusForbidden, gin.H{
				"code": "SECURITY_VIOLATION",
				"message": "Security alert: Multiple session access detected. Please log in again.",
			})

		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"message": "Temporary authentication failure. Please try again.",
			})
		}
		return
	}

	setAuthCookies(c, tokens.AccessToken, tokens.RefreshToken)
	c.JSON(http.StatusOK, gin.H{"message": "Session refreshed."})
}
// Logout handles user session termination
func (h *AuthHandler) Logout(c *gin.Context) {
	// 1. Clear cookies IMMEDIATELY to protect the client
	clearAuthCookies(c)

	var userID uuid.UUID
	if val, exists := c.Get("user_id"); exists {
		if id, ok := val.(uuid.UUID); ok {
			userID = id
		}
	}

	// 2. Extract tokens from cookies (Gin can still read them if called before the response is sent)
	refreshToken, _ := c.Cookie(RefreshTokenCookieName)
	accessToken, _ := c.Cookie(AccessTokenCookieName)

	// 3. Delegate ALL revocation logic to the service
	// This now handles Refresh revocation AND Access blacklisting in one call
	if userID != uuid.Nil {
		err := h.AuthService.Logout(c.Request.Context(), userID, refreshToken, accessToken)
		if err != nil {
			log.Error().Err(err).Msg("Auth: Logout service reported an error")
			// We don't return 500 here because the client is already "logged out" locally
		}
	}

	log.Info().
		Str("user_id", userID.String()[:8]).
		Bool("has_refresh", refreshToken != "").
		Bool("has_access", accessToken != "").
		Msg("Auth: Logout successful")

	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully."})
}