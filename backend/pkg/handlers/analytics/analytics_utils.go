// backend/pkg/handlers/analytics/analytics_utils.go
// Analytics handler - utility endpoints

package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func (h *AnalyticsHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"service":   "analytics",
		"timestamp": time.Now(),
		"message":   "Analytics service is operational",
	})
}