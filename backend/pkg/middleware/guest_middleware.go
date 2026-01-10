// backend/pkg/middleware/guest_middleware.go

package middleware

import (
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func GuestMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		isProd := os.Getenv("NODE_ENV") == "production"

		// 1. Check if guest_id already exists (from cookie)
		if existingID, err := c.Cookie("guest_id"); err == nil {
			// If found, set in context and continue
			c.Set("guest_id", existingID)
			c.Next()
			return
		}

		// 2. No existing guest_id found, check for authenticated user
        // (Optional check: we can skip generating a guest ID if a user is already logged in,
        // as the UserID will be preferred for tracking.)
		if _, err := c.Cookie("access_token"); err == nil {
            // A token exists, optional auth will handle user_id.
            // We can still generate a guest_id if you want dual tracking, 
            // but for simplicity, we let the authenticated flow proceed.
			// If we reach here, we generate a new guest ID.
		}

		// 3. Generate new ID
		guestID := uuid.New().String()

		// 4. Set Cookie
		c.SetCookie(
			"guest_id",
			guestID,
			3600*24*365, // 1 year
			"/",
			"",
			isProd, // Secure: true in prod
			true,
		)

        // 5. Set new ID in context (CRITICAL: So the handler can use it immediately)
        c.Set("guest_id", guestID) 
		log.Debug().Str("guest_id", guestID).Msg("🎟️ [Guest Middleware] Assigned new session ID")
		c.Next()
	}
}