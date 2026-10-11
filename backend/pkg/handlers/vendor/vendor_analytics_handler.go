// backend/pkg/handlers/vendor/vendor_analytics_handler.go

package vendor

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	servicevendor "github.com/eventify/backend/pkg/services/vendor"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

type VendorAnalyticsHandler struct {
	analyticsService servicevendor.VendorAnalyticsService
	db               *sqlx.DB
}

func NewVendorAnalyticsHandler(analyticsService servicevendor.VendorAnalyticsService, db *sqlx.DB) *VendorAnalyticsHandler {
	return &VendorAnalyticsHandler{
		analyticsService: analyticsService,
		db:               db,
	}
}

// ManualAnalyticsRefresh triggers an immediate analytics refresh (admin only)
func (h *VendorAnalyticsHandler) ManualAnalyticsRefresh(c *gin.Context) {
	// TODO: Add admin auth check
	// if !isAdmin(c) { return unauthorized }

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	log.Info().
		Str("triggered_by", "admin_api").
		Msg("Manual analytics refresh requested")

	// Call the refresh function directly
	err := servicevendor.RefreshAnalyticsNow(ctx, h.db)
	if err != nil {
		log.Error().
			Err(err).
			Msg("Manual analytics refresh failed")

		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to refresh analytics",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Analytics refreshed successfully",
	})
}

// GetAnalyticsHealth checks if analytics system is working
func (h *VendorAnalyticsHandler) GetAnalyticsHealth(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Check materialized view status
	var lastUpdate time.Time
	query := `
		SELECT MAX(last_updated)
		FROM vendor_daily_metrics
	`

	err := h.db.GetContext(ctx, &lastUpdate, query)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "unhealthy",
			"message": "Failed to check analytics health",
			"error":   err.Error(),
		})
		return
	}

	// Check if data is stale (more than 2 hours old)
	timeSinceUpdate := time.Since(lastUpdate)
	isStale := timeSinceUpdate > 2*time.Hour

	status := "healthy"
	if isStale {
		status = "degraded"
	}

	c.JSON(http.StatusOK, gin.H{
		"status":            status,
		"last_updated":      lastUpdate,
		"time_since_update": timeSinceUpdate.String(),
		"is_stale":          isStale,
		"message":           "Analytics system operational",
	})
}