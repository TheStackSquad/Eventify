// backend/pkg/middleware/optional_auth.go
package middleware

import (
	"fmt"
	"strings"
	"time"

	"github.com/eventify/backend/pkg/utils"
	servicejwt "github.com/eventify/backend/pkg/services/jwt"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuthResult tracks authentication attempts for observability
type AuthResult struct {
	Success  bool
	Reason   string
	UserID   string
	Duration time.Duration
	Path     string
}

// OptionalAuth checks for JWT but allows anonymous access if not found or invalid.
// This middleware is designed to NEVER panic - it gracefully degrades to guest mode.
func OptionalAuth(jwtService *servicejwt.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		const service = "optional-auth"
		const operation = "authenticate"
		
		startTime := time.Now()
		result := AuthResult{
			Success: false,
			Path:    c.Request.URL.Path,
		}

		// Always log the auth attempt for metrics
		defer func() {
			result.Duration = time.Since(startTime)
			logAuthAttempt(service, operation, result)
		}()

		// Skip OPTIONS requests
		if c.Request.Method == "OPTIONS" {
			result.Reason = "options_request"
			utils.LogInfo(service, operation, "🔄 Preflight request - skipping optional auth")
			c.Next()
			return
		}

		utils.LogInfo(service, operation, "👁️ Starting optional authentication process...")

		// Step 1: Extract token from cookie
		accessToken, err := c.Cookie("access_token")
		if err != nil || accessToken == "" {
			result.Reason = "no_token"
			utils.LogInfo(service, operation, "ℹ️ No access token provided — continuing as guest")
			c.Next()
			return
		}

		utils.LogInfo(service, operation, "🔍 Access token found in cookies, validating...")

		// Step 2: Validate token using JWT service
		claims, err := jwtService.ValidateAccessToken(accessToken)
		if err != nil {
			result.Reason = categorizeJWTError(err)
			
			errorDetail := fmt.Sprintf("Invalid or expired token (%s) — continuing as guest", result.Reason)
			utils.LogInfo(service, operation, errorDetail)
			
			// Log at warning level for actual validation failures (not just missing tokens)
			if result.Reason != "no_token" && result.Reason != "options_request" {
				utils.LogWarn(service, operation, "Token validation failed", err)
			}
			
			c.Next()
			return
		}

		// Step 3: CRITICAL - Validate claims is not nil (the bug fix!)
		if claims == nil {
			result.Reason = "nil_claims"
			utils.LogError(service, operation, 
				"CRITICAL: ValidateAccessToken returned nil claims without error - this is a bug in jwt.go", 
				nil)
			c.Next()
			return
		}

		// Step 4: Validate UserID field exists
		if claims.UserID == "" {
			result.Reason = "empty_user_id"
			utils.LogWarn(service, operation, 
				fmt.Sprintf("Token has empty user_id field (token_type: %s) — continuing as guest", claims.TokenType), 
				nil)
			c.Next()
			return
		}

		utils.LogInfo(service, operation, 
			fmt.Sprintf("✅ Token validated for user: %s", claims.UserID))

		// Step 5: Validate UserID is a valid UUID
		userUUID, err := uuid.Parse(claims.UserID)
		if err != nil {
			result.Reason = "invalid_user_id_format"
			utils.LogWarn(service, operation, 
				fmt.Sprintf("Malformed user_id in token: %s — continuing as guest", claims.UserID), 
				err)
			c.Next()
			return
		}

		// Step 6: Success - Store user context
		c.Set("user_id", userUUID)           // As UUID type
		c.Set("user_id_string", claims.UserID) // As string for convenience
		c.Set("authenticated", true)         // Flag for handlers
		c.Set("token_type", claims.TokenType) // Store token type

		result.Success = true
		result.Reason = "authenticated"
		result.UserID = claims.UserID

		utils.LogSuccess(service, operation, 
			fmt.Sprintf("User %s authenticated via optional auth", claims.UserID))

		c.Next()
	}
}

// categorizeJWTError provides structured error classification for metrics
func categorizeJWTError(err error) string {
	if err == nil {
		return "unknown"
	}

	errMsg := err.Error()
	switch {
	case strings.Contains(errMsg, "expired"):
		return "token_expired"
	case strings.Contains(errMsg, "not valid yet"):
		return "token_not_yet_valid"
	case strings.Contains(errMsg, "signature"):
		return "invalid_signature"
	case strings.Contains(errMsg, "malformed"):
		return "malformed_token"
	case strings.Contains(errMsg, "RSA"):
		return "rsa_key_error"
	case strings.Contains(errMsg, "token type"):
		return "invalid_token_type"
	case strings.Contains(errMsg, "not an access token"):
		return "wrong_token_type"
	default:
		return "validation_error"
	}
}

// logAuthAttempt provides structured logging for metrics collection
func logAuthAttempt(service, operation string, result AuthResult) {
	// Determine log level based on the result
	if result.Success {
		utils.LogSuccess(service, operation, 
			fmt.Sprintf("Auth successful - user: %s, reason: %s, duration: %v", 
				result.UserID, result.Reason, result.Duration))
	} else if result.Reason != "no_token" && result.Reason != "options_request" {
		// Actual authentication failures (not just missing tokens)
		utils.LogWarn(service, operation, 
			fmt.Sprintf("Auth failed - reason: %s, path: %s, duration: %v", 
				result.Reason, result.Path, result.Duration), nil)
	} else {
		// Normal cases (no token provided, preflight)
		utils.LogInfo(service, operation, 
			fmt.Sprintf("Guest access - reason: %s, path: %s, duration: %v", 
				result.Reason, result.Path, result.Duration))
	}
}

// GetUserID safely retrieves the authenticated user ID from context
func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, false
	}

	uid, ok := userID.(uuid.UUID)
	return uid, ok
}

// GetUserIDString safely retrieves the user ID as a string
func GetUserIDString(c *gin.Context) (string, bool) {
	userID, exists := c.Get("user_id_string")
	if !exists {
		return "", false
	}

	uid, ok := userID.(string)
	return uid, ok
}

// IsAuthenticated checks if the current request is from an authenticated user
func IsAuthenticated(c *gin.Context) bool {
	authenticated, exists := c.Get("authenticated")
	if !exists {
		return false
	}

	auth, ok := authenticated.(bool)
	return ok && auth
}