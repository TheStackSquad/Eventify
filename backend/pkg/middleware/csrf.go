// backend/pkg/middleware/csrf.go

package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

const (
	CSRFTokenCookieName = "csrf_token"
	CSRFTokenHeaderName = "X-CSRF-Token"
	CSRFTokenLength     = 32 // 256 bits
)

// CSRFConfig holds configuration for CSRF protection
type CSRFConfig struct {
	// TokenLength is the length of the CSRF token in bytes (default: 32)
	TokenLength int
	
	// CookieName is the name of the CSRF cookie (default: "csrf_token")
	CookieName string
	
	// HeaderName is the name of the CSRF header (default: "X-CSRF-Token")
	HeaderName string
	
	// Skip allows bypassing CSRF for specific paths
	Skip func(c *gin.Context) bool
}

// DefaultCSRFConfig returns the default CSRF configuration
func DefaultCSRFConfig() CSRFConfig {
	return CSRFConfig{
		TokenLength: CSRFTokenLength,
		CookieName:  CSRFTokenCookieName,
		HeaderName:  CSRFTokenHeaderName,
		Skip:        nil,
	}
}

// generateCSRFToken creates a cryptographically secure random token
func generateCSRFToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

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
		return http.SameSiteLaxMode
	}
}

// CSRFProtection implements Double Submit Cookie pattern
// It generates a CSRF token and sets it as a cookie AND requires clients to send it back in a header
func CSRFProtection(config ...CSRFConfig) gin.HandlerFunc {
	cfg := DefaultCSRFConfig()
	if len(config) > 0 {
		cfg = config[0]
	}

	return func(c *gin.Context) {
		// Skip OPTIONS requests (CORS preflight)
		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		// Allow custom skip logic
		if cfg.Skip != nil && cfg.Skip(c) {
			c.Next()
			return
		}

		// Safe methods (GET, HEAD, OPTIONS) don't need CSRF validation
		// They should NOT modify state
		if c.Request.Method == "GET" || c.Request.Method == "HEAD" {
			// Generate and set token for future use
			existingToken, err := c.Cookie(cfg.CookieName)
			if err != nil || existingToken == "" {
				token, genErr := generateCSRFToken(cfg.TokenLength)
				if genErr != nil {
					log.Error().Err(genErr).Msg("CSRF: Failed to generate token")
					c.JSON(http.StatusInternalServerError, gin.H{"message": "Security token generation failed."})
					c.Abort()
					return
				}

				setCSRFCookie(c, cfg.CookieName, token)
			}
			c.Next()
			return
		}

		// ✅ STATE-CHANGING METHODS (POST, PUT, PATCH, DELETE) require CSRF validation
		
		// 1. Get token from cookie (Double Submit Cookie pattern)
		cookieToken, err := c.Cookie(cfg.CookieName)
		if err != nil || cookieToken == "" {
			log.Warn().
				Str("ip", c.ClientIP()).
				Str("path", c.Request.URL.Path).
				Msg("CSRF: Missing cookie token")
			
			c.JSON(http.StatusForbidden, gin.H{
				"message": "CSRF token missing. Please refresh the page.",
				"code":    "CSRF_TOKEN_MISSING",
			})
			c.Abort()
			return
		}

		// 2. Get token from header
		headerToken := c.GetHeader(cfg.HeaderName)
		if headerToken == "" {
			log.Warn().
				Str("ip", c.ClientIP()).
				Str("path", c.Request.URL.Path).
				Msg("CSRF: Missing header token")
			
			c.JSON(http.StatusForbidden, gin.H{
				"message": "CSRF token not provided.",
				"code":    "CSRF_TOKEN_REQUIRED",
			})
			c.Abort()
			return
		}

		// 3. Validate tokens match (constant-time comparison)
		if !secureCompare(cookieToken, headerToken) {
			log.Warn().
				Str("ip", c.ClientIP()).
				Str("path", c.Request.URL.Path).
				Str("user_agent", c.Request.UserAgent()).
				Msg("🚨 CSRF: Token mismatch detected")
			
			c.JSON(http.StatusForbidden, gin.H{
				"message": "Invalid CSRF token. Security violation detected.",
				"code":    "CSRF_TOKEN_INVALID",
			})
			c.Abort()
			return
		}

		// ✅ CSRF validation passed
		c.Next()
	}
}

// setCSRFCookie sets the CSRF token as an HTTP-only cookie
func setCSRFCookie(c *gin.Context, name, token string) {
	domain := getCookieDomain()
	secure := os.Getenv("COOKIE_SECURE") == "true"
	sameSite := getCookieSameSite()

	// SameSite=None requires Secure=true
	if sameSite == http.SameSiteNoneMode {
		secure = true
	}

	// ⚠️ IMPORTANT: CSRF cookie should NOT be HttpOnly
	// The client needs to read it to send it back in the header
	c.SetSameSite(sameSite)
	c.SetCookie(
		name,
		token,
		3600*24*7, // 7 days (long-lived for better UX)
		"/",
		domain,
		secure,
		false, // ⚠️ NOT HttpOnly - client needs to read this
	)

	log.Debug().
		Str("token_preview", token[:8]+"...").
		Msg("CSRF: Token set in cookie")
}

// secureCompare performs constant-time string comparison to prevent timing attacks
func secureCompare(a, b string) bool {
	// Must be same length
	if len(a) != len(b) {
		return false
	}

	// Constant-time comparison (prevents timing side-channel attacks)
	var result byte
	for i := 0; i < len(a); i++ {
		result |= a[i] ^ b[i]
	}
	return result == 0
}

// ✅ Helper function for handlers to generate new CSRF tokens
func GenerateAndSetCSRFToken(c *gin.Context) (string, error) {
	token, err := generateCSRFToken(CSRFTokenLength)
	if err != nil {
		return "", err
	}

	setCSRFCookie(c, CSRFTokenCookieName, token)
	return token, nil
}

// ✅ Helper to skip CSRF for specific endpoints (e.g., public webhooks)
func SkipCSRFForPaths(paths ...string) func(c *gin.Context) bool {
	pathMap := make(map[string]bool)
	for _, path := range paths {
		pathMap[path] = true
	}

	return func(c *gin.Context) bool {
		return pathMap[c.Request.URL.Path]
	}
}

// ✅ Helper to skip CSRF for path prefixes (e.g., /webhooks/*)
func SkipCSRFForPrefixes(prefixes ...string) func(c *gin.Context) bool {
	return func(c *gin.Context) bool {
		path := c.Request.URL.Path
		for _, prefix := range prefixes {
			if strings.HasPrefix(path, prefix) {
				return true
			}
		}
		return false
	}
}