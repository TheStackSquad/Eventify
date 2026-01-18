// backend/pkg/middleware/rate_limit.go

package middleware

import (
	"strings"

	"github.com/eventify/backend/pkg/utils"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// RateLimit creates a rate limiting middleware using the provided IPRateLimiter
func RateLimit(limiter *utils.IPRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get client identifier (IP address)
		identifier := getClientIP(c)
		
		// Skip rate limiting for localhost if configured
		if utils.SkipLocalhostRateLimit && isLocalhost(identifier) {
			// Optional: Debug log (can be removed in production)
			// log.Debug().Str("ip", identifier).Msg("Skipping rate limit for localhost")
			c.Next()
			return
		}

		// Get or create limiter for this client
		clientLimiter := limiter.GetVisitor(identifier)

		// Check if request is allowed
		if !clientLimiter.Allow() {
			log.Warn().
				Str("ip", identifier).
				Str("path", c.Request.URL.Path).
				Msg("Rate limit exceeded")
			
			c.JSON(429, gin.H{
				"error":   "too_many_requests",
				"message": "Rate limit exceeded. Please try again later.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// isLocalhost checks if the given address is localhost
func isLocalhost(addr string) bool {
	// Remove port if present
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		addr = addr[:idx]
	}

	// Remove brackets from IPv6 addresses like [::1]
	addr = strings.Trim(addr, "[]")

	// Check for localhost patterns
	return addr == "127.0.0.1" ||
		addr == "::1" ||
		addr == "localhost" ||
		strings.HasPrefix(addr, "127.") ||
		addr == "" // Empty means local connection
}

// getClientIP extracts the real client IP from the request
func getClientIP(c *gin.Context) string {
	// Try to get real IP from headers (for proxied requests)
	ip := c.GetHeader("X-Real-IP")
	if ip == "" {
		ip = c.GetHeader("X-Forwarded-For")
		if ip != "" {
			// X-Forwarded-For can contain multiple IPs, take the first one
			if idx := strings.Index(ip, ","); idx != -1 {
				ip = strings.TrimSpace(ip[:idx])
			}
		}
	}
	
	// Fallback to RemoteAddr
	if ip == "" {
		ip = c.Request.RemoteAddr
	}

	return ip
}