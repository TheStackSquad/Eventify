// backend/pkg/middleware/authentication.go

package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/eventify/backend/pkg/utils"
	servicejwt "github.com/eventify/backend/pkg/services/jwt"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuthMiddleware validates the access token from cookies OR Authorization headers
func AuthMiddleware(jwtService *servicejwt.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		const service = "auth-middleware"
		const operation = "authenticate"
		
		// 1. Handle Preflight
		if c.Request.Method == "OPTIONS" {
			utils.LogInfo(service, operation, "Preflight request - skipping authentication")
			c.Next()
			return
		}

		utils.LogInfo(service, operation, "Starting authentication process...")
		
		var accessToken string
		tokenSource := "none"

		// Check Headers first
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				accessToken = parts[1]
				tokenSource = "header"
				utils.LogInfo(service, operation, "Token found in Authorization header")
			} else {
				utils.LogInfo(service, operation, "Authorization header present but malformed")
			}
		}

		// Check Cookies if Header was empty
		if accessToken == "" {
			cookieToken, err := c.Cookie("access_token")
			if err == nil {
				accessToken = cookieToken
				tokenSource = "cookie"
				utils.LogInfo(service, operation, "Token found in cookies")
			} else {
				utils.LogInfo(service, operation, "No access_token cookie found")
			}
		}

		// No token found anywhere
		if accessToken == "" {
			utils.LogError(service, operation, "Authentication required - no token found", nil)
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Authentication required. No session found.",
			})
			c.Abort()
			return
		}

		utils.LogInfo(service, operation, fmt.Sprintf("Token obtained from %s, validating...", tokenSource))

		// 2. Validate the JWT token using JWTService
		// Use ValidateAccessToken() specifically since we're validating access tokens
		claims, err := jwtService.ValidateAccessToken(accessToken)
		if err != nil {
			utils.LogError(service, operation, "Token validation failed", err)
			
			// Provide more specific error messages based on the error type
			errorMessage := "Session expired or invalid."
			errorCode := "TOKEN_EXPIRED"
			
			if strings.Contains(err.Error(), "not an access token") {
				errorMessage = "Invalid token type. Access token required."
				errorCode = "INVALID_TOKEN_TYPE"
			} else if strings.Contains(err.Error(), "expired") {
				errorMessage = "Session expired. Please login again."
				errorCode = "TOKEN_EXPIRED"
			}
			
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": errorMessage,
				"code":    errorCode,
			})
			c.Abort()
			return
		}

		// 💡 CRITICAL FIX: Check if the returned claims pointer is nil.
		// This addresses the "invalid memory address or nil pointer dereference" error.
		if claims == nil {
			utils.LogError(service, operation, "ValidateAccessToken returned nil claims with no error", nil)
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Internal session error.",
			})
			c.Abort()
			return
		}

		utils.LogInfo(service, operation, fmt.Sprintf("Token validated for user: %s", claims.UserID))

		// 3. Convert string user ID to uuid.UUID
		// This line (was 81) is now safe because 'claims' is guaranteed not to be nil.
		userUUID, err := uuid.Parse(claims.UserID)
		if err != nil {
			utils.LogError(service, operation, 
				fmt.Sprintf("Failed to parse user ID: %s", claims.UserID), 
				err)
			
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Invalid user identifier format.",
			})
			c.Abort()
			return
		}

		// 4. Inject into Gin Context
		c.Set("user_id", userUUID)
		c.Set("user_id_string", claims.UserID)
		c.Set("token_type", claims.TokenType) // Optional: store token type in context

		utils.LogSuccess(service, operation, 
			fmt.Sprintf("User %s authenticated successfully", claims.UserID))

		c.Next()
	}
}

// Helper to log tokens safely (keeping this as is)
func truncateToken(t string) string {
	if len(t) < 10 {
		return "short-token"
	}
	return fmt.Sprintf("%s...%s", t[:5], t[len(t)-5:])
}