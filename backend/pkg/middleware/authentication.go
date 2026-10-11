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
			parts := strings.Fields(authHeader)
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

		// FIX 1: Guard against nil claims with nil error — a buggy JWT service
		// implementation must never result in a successful auth or a nil dereference
		// panic downstream at uuid.Parse(claims.UserID).
		if claims == nil {
			utils.LogError(service, operation, "ParseAccessToken returned nil claims without error — possible JWT service bug", nil)
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Session expired or invalid."})
			c.Abort()
			return
		}

		// FIX 2: Guard against unparseable UserID — a malformed UserID in an otherwise
		// valid token must be rejected explicitly rather than silently injecting uuid.Nil
		// into the context, which would cause downstream DB misses instead of a clean 401.
		userUUID, err := uuid.Parse(claims.UserID)
		if err != nil {
			utils.LogError(service, operation, "ParseAccessToken returned token with unparseable UserID", err)
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Session expired or invalid."})
			c.Abort()
			return
		}

		// 3. Check State (Blacklist)
		// Now we check if this specific valid token was revoked (logout/password change).
		blacklisted, err := svc.IsTokenBlacklisted(c.Request.Context(), accessToken)

		// FIX 3: Fail-closed on blacklist DB error — if we cannot verify whether this
		// token has been revoked, we must deny the request. Failing open here would allow
		// a logged-out or password-changed session to remain active during an outage.
		if err != nil {
			utils.LogError(service, operation, "Blacklist check failed", err)
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Session expired or invalid."})
			c.Abort()
			return
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
		c.Set("user_id", userUUID)
		c.Set("user_id_string", claims.UserID)

		c.Next()
	}
}