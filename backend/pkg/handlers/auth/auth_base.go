package auth

import (
	"net/http"
	"os"
	"time"

	repoauth "github.com/eventify/backend/pkg/repository/auth"
	servicejwt "github.com/eventify/backend/pkg/services/jwt"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// AuthHandler handles authentication requests
type AuthHandler struct {
	AuthRepo         repoauth.AuthRepository
	RefreshTokenRepo repoauth.RefreshTokenRepository
	JWTService       *servicejwt.JWTService // ✅ Changed to pointer
}

// NewAuthHandler creates a new AuthHandler instance
func NewAuthHandler(
	authRepo repoauth.AuthRepository,
	tokenRepo repoauth.RefreshTokenRepository,
	jwtService *servicejwt.JWTService, // ✅ Changed to pointer
) *AuthHandler {
	return &AuthHandler{
		AuthRepo:         authRepo,
		RefreshTokenRepo: tokenRepo,
		JWTService:       jwtService,
	}
}

// Cookie configuration constants
const (
	AccessTokenCookieName  = "access_token"
	RefreshTokenCookieName = "refresh_token"
	
	// Extended token durations for better UX
	AccessMaxAge  = 3600 * 24      // 24 hours (1 day)
	RefreshMaxAge = 3600 * 24 * 30 // 30 days
	
	// Absolute session timeout (30 days max, regardless of activity)
	AbsoluteSessionTimeout = 3600 * 24 * 30
	
	ResetTokenExpiry = 15 * time.Minute
)

// getCookieDomain returns the domain for cookies based on environment
func getCookieDomain() string {
	domain := os.Getenv("COOKIE_DOMAIN")
	if domain == "" || domain == "localhost" {
		return ""
	}
	return domain
}

// getCookieSameSite returns the SameSite policy for cookies
func getCookieSameSite() http.SameSite {
	sameSite := os.Getenv("COOKIE_SAMESITE")
	switch sameSite {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	case "lax":
		return http.SameSiteLaxMode
	default:
		return http.SameSiteLaxMode // Safe default
	}
}

// setAuthCookies sets access and refresh token cookies
func setAuthCookies(c *gin.Context, accessToken, refreshToken string) {
	domain := getCookieDomain()
	secure := os.Getenv("COOKIE_SECURE") == "true"
	sameSite := getCookieSameSite()
	
	// SameSite=None requires Secure=true
	if sameSite == http.SameSiteNoneMode {
		secure = true
	}
	
	// Set Access Token Cookie
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
	
	// Set Refresh Token Cookie
	c.SetSameSite(sameSite)
	c.SetCookie(
		RefreshTokenCookieName,
		refreshToken,
		RefreshMaxAge,
		"/",
		domain,
		secure,
		true, // httpOnly
	)
}

// clearAuthCookies removes authentication cookies
func clearAuthCookies(c *gin.Context) {
	domain := getCookieDomain()
	sameSite := getCookieSameSite()
	
	c.SetSameSite(sameSite)
	c.SetCookie(AccessTokenCookieName, "", -1, "/", domain, false, true)
	
	c.SetSameSite(sameSite)
	c.SetCookie(RefreshTokenCookieName, "", -1, "/", domain, false, true)
	
	log.Debug().Msg("Auth: Cookies cleared")
}