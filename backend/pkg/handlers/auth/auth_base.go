// backend/pkg/handlers/auth/auth_base.go

package auth

import (
	"net/http"
	"os"
	"time"

	"github.com/eventify/backend/pkg/middleware"
	serviceauth "github.com/eventify/backend/pkg/services/auth"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

type AuthHandler struct {
	AuthService serviceauth.AuthService
}

func NewAuthHandler(authService serviceauth.AuthService) *AuthHandler {
	return &AuthHandler{
		AuthService: authService,
	}
}

// Cookie configuration constants
const (
	AccessTokenCookieName  = "access_token"
	RefreshTokenCookieName = "refresh_token"

	// Access token is always short-lived regardless of rememberMe.
	// It gets silently refreshed by the refresh token — no need to extend it.
	AccessMaxAge = 3600 * 24 // 24 hours

	// ✅ FIX: Two distinct refresh token lifetimes.
	//
	// ShortSessionMaxAge = 0
	//   Passing 0 to Gin's SetCookie omits the Max-Age attribute entirely,
	//   which makes the cookie a SESSION cookie — the browser discards it
	//   when the window/tab is closed. This is the secure default.
	//
	// PersistentSessionMaxAge = 30 days
	//   Cookie survives browser restarts. Used when rememberMe=true.
	ShortSessionMaxAge      = 0            // session cookie — expires on browser close
	PersistentSessionMaxAge = 3600 * 24 * 30 // 30 days

	// Hard ceiling: even a "remember me" session cannot exceed 30 days
	AbsoluteSessionTimeout = 3600 * 24 * 30

	ResetTokenExpiry = 15 * time.Minute
)

func getCookieDomain() string {
	domain := os.Getenv("COOKIE_DOMAIN")
	if domain == "" || domain == "localhost" {
		return ""
	}
	return domain
}

func getCookieSameSite() http.SameSite {
	switch os.Getenv("COOKIE_SAMESITE") {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	case "lax":
		return http.SameSiteLaxMode
	default:
		return http.SameSiteLaxMode
	}
}

// setAuthCookies writes the access + refresh token cookies and generates a CSRF token.
//
// ✅ FIX: Now accepts rememberMe bool.
//
// Cookie lifetime strategy:
//
//   rememberMe=false → refresh cookie has NO Max-Age (session cookie).
//     The browser deletes it when closed. This is the secure default —
//     the user must log in again after closing the browser.
//
//   rememberMe=true  → refresh cookie has Max-Age=30 days.
//     Survives browser restarts. The backend refresh token TTL is also
//     set to 30 days (controlled in auth_service.go) so both sides match.
//
// The access token cookie is always 24h — it is refreshed silently by the
// refresh flow and does not need to be extended for "remember me" sessions.
func setAuthCookies(c *gin.Context, accessToken, refreshToken string, rememberMe bool) {
	domain := getCookieDomain()
	secure := os.Getenv("COOKIE_SECURE") == "true"
	sameSite := getCookieSameSite()

	// SameSite=None requires Secure=true (browser enforced)
	if sameSite == http.SameSiteNoneMode {
		secure = true
	}

	// ✅ FIX: Select refresh token cookie lifetime based on rememberMe
	refreshMaxAge := ShortSessionMaxAge
	if rememberMe {
		refreshMaxAge = PersistentSessionMaxAge
	}

	log.Debug().
		Bool("rememberMe", rememberMe).
		Int("refreshMaxAgeSecs", refreshMaxAge).
		Msg("Auth: Setting auth cookies")

	// Access token — always 24h regardless of rememberMe
	c.SetSameSite(sameSite)
	c.SetCookie(
		AccessTokenCookieName,
		accessToken,
		AccessMaxAge,
		"/",
		domain,
		secure,
		true, // httpOnly
	)

	// Refresh token — lifetime depends on rememberMe
	c.SetSameSite(sameSite)
	c.SetCookie(
		RefreshTokenCookieName,
		refreshToken,
		refreshMaxAge, // ✅ 0 = session cookie, 2592000 = 30 days
		"/",
		domain,
		secure,
		true, // httpOnly
	)

	// ✅ Write the remember_me companion cookie so RefreshToken can
	// preserve the original session preference across token rotations.
	// Lifetime matches the refresh token exactly.
	setRememberMeCookie(c, rememberMe, refreshMaxAge)

	// Generate CSRF token for the newly authenticated session
	csrfToken, err := middleware.GenerateAndSetCSRFToken(c)
	if err != nil {
		log.Error().Err(err).Msg("Auth: Failed to generate CSRF token")
		// Don't fail the login — CSRF token is defence-in-depth, not a blocker
	} else {
		log.Debug().
			Str("csrf_preview", csrfToken[:8]+"...").
			Msg("Auth: CSRF token generated for session")
	}
}

// clearAuthCookies removes all authentication and CSRF cookies on logout
func clearAuthCookies(c *gin.Context) {
	domain := getCookieDomain()
	sameSite := getCookieSameSite()

	c.SetSameSite(sameSite)
	c.SetCookie(AccessTokenCookieName, "", -1, "/", domain, false, true)

	c.SetSameSite(sameSite)
	c.SetCookie(RefreshTokenCookieName, "", -1, "/", domain, false, true)

	c.SetSameSite(sameSite)
	c.SetCookie(middleware.CSRFTokenCookieName, "", -1, "/", domain, false, false)

	c.SetSameSite(sameSite)
	c.SetCookie(RememberMeCookieName, "", -1, "/", domain, false, false)

	log.Debug().Msg("Auth: All cookies cleared (auth + CSRF + remember_me)")
}