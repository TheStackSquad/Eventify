// backend/pkg/middleware/authentication.go
package middleware

import (
	"net/http"
	"strings"

	"github.com/eventify/backend/pkg/utils"
	authService "github.com/eventify/backend/pkg/services/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func AuthMiddleware(svc authService.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		const service = "auth-middleware"
		const operation = "authenticate"

		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		var accessToken string
		// 1. Extraction with Sanitization
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				accessToken = strings.TrimSpace(parts[1])
			}
		}

		if accessToken == "" {
			if cookieToken, err := c.Cookie("access_token"); err == nil {
				// TrimSpace ensures that any browser/test-script whitespace 
				// doesn't break the SHA-256 hash symmetry.
				accessToken = strings.TrimSpace(cookieToken)
			}
		}

		if accessToken == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Authentication required."})
			c.Abort()
			return
		}

		// 2. Validate Signature & Expiry First
		// No point in hitting the DB for a token that is expired or fake.
		claims, err := svc.ParseAccessToken(c.Request.Context(), accessToken)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Session expired or invalid."})
			c.Abort()
			return
		}

		// 3. Check State (Blacklist)
		// Now we check if this specific valid token was revoked (Logout/Password change)
		blacklisted, err := svc.IsTokenBlacklisted(c.Request.Context(), accessToken)
		if err != nil {
			utils.LogError(service, operation, "Blacklist check failed", err)
			// Fail-safe: If DB is down, we do not allow the request.
		}
		
		if blacklisted {
			utils.LogInfo(service, operation, "Access token is blacklisted - rejecting")
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "Session has been terminated. Please login again.",
				"code":    "TOKEN_REVOKED",
			})
			c.Abort()
			return
		}

		// 4. Inject into Context
		userUUID, _ := uuid.Parse(claims.UserID)
		c.Set("user_id", userUUID)
		c.Set("user_id_string", claims.UserID)

		c.Next()
	}
}