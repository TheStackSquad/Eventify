//backend/pkg/middleware/admin_auth.go

package middleware

import (
	"errors"
	"net/http"

	repoauth "eventify/backend/pkg/repository/auth"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func AdminMiddleware(authRepo repoauth.AuthRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDValue, exists := c.Get("user_id_string")
		if !exists {
			log.Error().Msg("AdminMiddleware called without AuthMiddleware running first.")
			c.JSON(http.StatusForbidden, gin.H{"message": "Access denied: Authentication failure."})
			c.Abort()
			return
		}

		userIDString, ok := userIDValue.(string)
		if !ok || userIDString == "" {
			log.Error().Msg("User ID in context is invalid or missing.")
			c.JSON(http.StatusForbidden, gin.H{"message": "Access denied: Invalid user identifier."})
			c.Abort()
			return
		}

		userUUID, err := uuid.Parse(userIDString)
		if err != nil {
			log.Error().Err(err).Str("user_id_string", userIDString).Msg("Invalid UUID format in context.")
			c.JSON(http.StatusBadRequest, gin.H{"message": "Access denied: Invalid ID format."})
			c.Abort()
			return
		}

		isAdmin, err := authRepo.IsUserAdmin(c.Request.Context(), userUUID)
		userIDLog := userUUID.String()

		if err != nil {
			log.Error().Err(err).Str("user_id", userIDLog).Msg("Database error during admin check")

			if errors.Is(err, errors.New("user not found")) {
				c.JSON(http.StatusForbidden, gin.H{"message": "Access denied: User not found."})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Internal error checking user role."})
			}
			c.Abort()
			return
		}

		if !isAdmin {
			log.Warn().Str("user_id", userIDLog).Msg("User attempted to access admin route without authorization")
			c.JSON(http.StatusForbidden, gin.H{"message": "Authorization failed: Insufficient permissions."})
			c.Abort()
			return
		}

		log.Debug().Str("user_id", userIDLog).Msg("Admin user granted access.")
		c.Next()
	}
}