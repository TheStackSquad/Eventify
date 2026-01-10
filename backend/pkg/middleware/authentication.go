// backend/pkg/middleware/authentication.go

package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"eventify/backend/pkg/utils"
    // Assuming utils.Claims struct is what ValidateJWT returns
    // You may need to import the package that defines utils.Claims (e.g., models)
    // If utils.ValidateJWT returns a pointer, the check below is critical.

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// AuthMiddleware validates the access token from cookies OR Authorization headers
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Handle Preflight
		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		var accessToken string

		// ... (Token retrieval logic remains the same) ...
        // Check Headers first
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				accessToken = parts[1]
				log.Debug().Msg("Auth: Header token present") // Simplified indicator
			}
		}

		// Check Cookies if Header was empty
		if accessToken == "" {
			cookieToken, err := c.Cookie("access_token")
			if err == nil {
				accessToken = cookieToken
				log.Debug().Msg("Auth: Cookie token present") // Simplified indicator
			}
		}

		// No token found anywhere
		if accessToken == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Authentication required. No session found.",
			})
			c.Abort()
			return
		}

		// 2. Validate the JWT token
		// NOTE: Assuming utils.ValidateJWT returns (*Claims, error)
		claims, err := utils.ValidateJWT(accessToken)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Session expired or invalid.",
				"code":    "TOKEN_EXPIRED",
			})
			c.Abort()
			return
		}

        // 💡 CRITICAL FIX: Check if the returned claims pointer is nil.
        // This addresses the "invalid memory address or nil pointer dereference" error.
        if claims == nil {
            log.Error().Msg("Context Error: ValidateJWT returned nil claims with no error.")
            c.JSON(http.StatusUnauthorized, gin.H{
                "message": "Internal session error.",
            })
            c.Abort()
            return
        }

		// 3. Convert string user ID to uuid.UUID
		// This line (was 81) is now safe because 'claims' is guaranteed not to be nil.
		userUUID, err := uuid.Parse(claims.UserID)
		if err != nil {
			/* Commented out verbose logging */

			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Invalid user identifier format.",
			})
			c.Abort()
			return
		}

		// 4. Inject into Gin Context
		c.Set("user_id", userUUID)
		c.Set("user_id_string", claims.UserID)

		// Simple success indicator
		log.Info().Msgf("Auth: User %s authenticated", claims.UserID[:8])

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