// backend/pkg/handlers/auth/auth_session.go

package auth

import (
	"net/http"
	"time"

	serviceauth "github.com/eventify/backend/pkg/services/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// RememberMeCookieName is a non-HttpOnly companion cookie that carries
// the user's original "remember me" preference across token refreshes.
//
// Why a separate cookie?
//   - Incoming request cookies do NOT include Max-Age — the browser strips
//     it. We have no way to tell from the refresh_token cookie alone whether
//     it was originally issued as a session cookie (0) or 30-day (2592000).
//   - Storing it in the refresh token JWT claims would work but requires
//     touching generateTokenPair and the JWT service.
//   - A plain boolean companion cookie is the lightest change that requires
//     no service interface modifications.
//
// Security: this cookie holds "1" or "0" — no sensitive data. It is
// deliberately NOT HttpOnly so it can be read back during refresh.
// It IS Secure+SameSite-matched to prevent it travelling to other origins.
const RememberMeCookieName = "remember_me"

// setRememberMeCookie writes the companion remember_me cookie.
// Called by setAuthCookies — not directly by handlers.
func setRememberMeCookie(c *gin.Context, rememberMe bool, maxAge int) {
	domain := getCookieDomain()
	secure := c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https"

	value := "0"
	if rememberMe {
		value = "1"
	}

	c.SetSameSite(getCookieSameSite())
	c.SetCookie(
		RememberMeCookieName,
		value,
		maxAge,    // matches the refresh token lifetime exactly
		"/",
		domain,
		secure,
		false, // NOT HttpOnly — must be readable by the refresh handler
	)
}

// isRememberMeSession reads the companion cookie to determine whether the
// original login was a "remember me" session.
// Returns false (safe default) if the cookie is absent or unreadable.
func isRememberMeSession(c *gin.Context) bool {
	val, err := c.Cookie(RememberMeCookieName)
	if err != nil {
		return false
	}
	return val == "1"
}

// RefreshToken silently rotates the access + refresh token pair.
//
// The original "remember me" preference is preserved by reading the
// remember_me companion cookie set at login — see setRememberMeCookie above.
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	oldRefreshToken, err := c.Cookie(RefreshTokenCookieName)
	if err != nil || oldRefreshToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "No active session."})
		return
	}

	currentIP := c.ClientIP()
	currentUA := c.Request.UserAgent()

	userID, tokens, err := h.AuthService.RefreshToken(
		c.Request.Context(),
		oldRefreshToken,
		time.Duration(AbsoluteSessionTimeout)*time.Second,
		currentIP,
		currentUA,
	)

	if err != nil {
		log.Debug().Err(err).Msg("Auth: Refresh process interrupted")

		switch err {
		case serviceauth.ErrSessionExpired:
			clearAuthCookies(c)
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    "SESSION_EXPIRED",
				"message": "Your session has expired. Please log in again.",
			})

		case serviceauth.ErrTokenReused:
			clearAuthCookies(c)
			log.Warn().
				Str("ip", currentIP).
				Str("user_agent", currentUA).
				Msg("🚨 Security Alert: Token reuse attempt")
			c.JSON(http.StatusForbidden, gin.H{
				"code":    "SECURITY_VIOLATION",
				"message": "Security alert: Multiple session access detected. Please log in again.",
			})

		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"message": "Temporary authentication failure. Please try again.",
			})
		}
		return
	}

	log.Info().
		Str("user_id", userID.String()).
		Str("ip", currentIP).
		Str("user_agent_preview", currentUA[:min(50, len(currentUA))]).
		Msg("Auth: Token refresh successful")

	// ✅ FIX: Read the original rememberMe preference from the companion cookie
	// and preserve it when issuing the new cookie pair.
	// Without this, every refresh would reset to the default (session cookie),
	// silently logging out "remember me" users after their first token rotation.
	rememberMe := isRememberMeSession(c)

	setAuthCookies(c, tokens.AccessToken, tokens.RefreshToken, rememberMe)

	c.JSON(http.StatusOK, gin.H{"message": "Session refreshed."})
}

// Logout handles user session termination
func (h *AuthHandler) Logout(c *gin.Context) {
	// Clear cookies immediately to protect the client
	clearAuthCookies(c)

	var userID uuid.UUID
	if val, exists := c.Get("user_id"); exists {
		if id, ok := val.(uuid.UUID); ok {
			userID = id
		}
	}

	// Cookies are already cleared — read tokens before clearAuthCookies wipes them.
	// Note: in Gin, SetCookie writes to the response but c.Cookie reads from the
	// *request*. The request cookies are still readable after calling clearAuthCookies.
	refreshToken, _ := c.Cookie(RefreshTokenCookieName)
	accessToken, _ := c.Cookie(AccessTokenCookieName)

	if userID != uuid.Nil {
		if err := h.AuthService.Logout(c.Request.Context(), userID, refreshToken, accessToken); err != nil {
			log.Error().Err(err).Msg("Auth: Logout service reported an error")
		}
	}

	log.Info().
		Str("user_id", userID.String()[:8]).
		Str("ip", c.ClientIP()).
		Bool("had_refresh", refreshToken != "").
		Bool("had_access", accessToken != "").
		Msg("Auth: Logout successful")

	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully."})
}

// min is a safe string truncation helper (Go 1.20 has this built-in as min()).
// Keep this if your Go version is < 1.21.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}