// backend/pkg/handlers/auth/auth_base.go

package auth

import (
	"net/http"
	repoauth "eventify/backend/pkg/repository/auth"
	"eventify/backend/pkg/services/jwt"
	"os"
	"time"
	//"string"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

type AuthHandler struct {
	AuthRepo         repoauth.AuthRepository
	RefreshTokenRepo repoauth.RefreshTokenRepository
	JWTService       jwt.JWTService
}

func NewAuthHandler(authRepo repoauth.AuthRepository, tokenRepo repoauth.RefreshTokenRepository, jwtService jwt.JWTService) *AuthHandler {
	return &AuthHandler{
		AuthRepo:         authRepo,
		RefreshTokenRepo: tokenRepo,
		JWTService:       jwtService,
	}
}

const (
	AccessTokenCookieName  = "access_token"
	RefreshTokenCookieName = "refresh_token"
	
	// ✅ WEEK 1 ENHANCEMENT: Extended token durations for better UX
	AccessMaxAge  = 3600 * 24      // 24 hours (1 day)
	RefreshMaxAge = 3600 * 24 * 30 // 30 days
	
	// ✅ WEEK 2 ENHANCEMENT: Absolute session timeout
	AbsoluteSessionTimeout = 3600 * 24 * 30 // 30 days max, regardless of activity
	
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

	// log.Debug().
	// 	Str("sameSite", sameSite.String()).
	// 	Bool("secure", secure).
	// 	Msg("Auth: Cookies set with explicit SameSite")
}

func clearAuthCookies(c *gin.Context) {
	domain := getCookieDomain()
	sameSite := getCookieSameSite()
	
	c.SetSameSite(sameSite)
	c.SetCookie(AccessTokenCookieName, "", -1, "/", domain, false, true)
	
	c.SetSameSite(sameSite)
	c.SetCookie(RefreshTokenCookieName, "", -1, "/", domain, false, true)
	
	log.Debug().Msg("Auth: Cookies cleared")
}