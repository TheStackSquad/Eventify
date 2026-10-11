// backend/pkg/handlers/vendor/vendor_leaderboard_handler.go
package vendor

import (
	"net/http"
	"strconv"
	"time"

	//"github.com/eventify/backend/pkg/models"
	servicevendor "github.com/eventify/backend/pkg/services/vendor"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

type VendorLeaderboardHandler struct {
	leaderboardService servicevendor.VendorLeaderboardService
}

func NewVendorLeaderboardHandler(service servicevendor.VendorLeaderboardService) *VendorLeaderboardHandler {
	return &VendorLeaderboardHandler{
		leaderboardService: service,
	}
}

func (h *VendorLeaderboardHandler) GetVendorOfTheMonth(c *gin.Context) {
	vendor, err := h.leaderboardService.GetVendorOfTheMonth(c.Request.Context())
	if err != nil {
		log.Error().Err(err).Msg("❌ Leaderboard: Failed to get vendor of the month")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to retrieve vendor"})
		return
	}

	// 🆕 COMPREHENSIVE DEBUG LOGGING
	if vendor != nil {
		log.Info().
			Str("vendor_id", vendor.VendorID.String()).
			Str("name", vendor.Name).
			Str("image_url", vendor.ImageURL).
			Str("tier", vendor.SubscriptionTier).
			Int("score", vendor.PVSScore).
			Int("views", vendor.MonthlyViews).
			Bool("has_image", vendor.ImageURL != "").
			Msg("✅ Vendor of Month: Sending to client")
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": vendor})
}

func (h *VendorLeaderboardHandler) GetTopByCategories(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "5"))

	data, err := h.leaderboardService.GetAllCategoryLeaderboards(c.Request.Context(), limit)
	if err != nil {
		log.Error().Err(err).Msg("❌ Leaderboard: Bulk category fetch failed")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}

	// 🆕 DEBUG LOGGING
	totalVendors := 0
	for _, vendors := range data {
		totalVendors += len(vendors)
	}
	log.Info().
		Int("categories", len(data)).
		Int("total_vendors", totalVendors).
		Msg("✅ Categories: Sending to client")

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": data})
}

func (h *VendorLeaderboardHandler) GetTopByLocations(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "5"))

	data, err := h.leaderboardService.GetMajorLocationLeaderboards(c.Request.Context(), limit)
	if err != nil {
		log.Error().Err(err).Msg("❌ Leaderboard: Bulk location fetch failed")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}

	// 🆕 DEBUG LOGGING
	totalVendors := 0
	for _, vendors := range data {
		totalVendors += len(vendors)
	}
	log.Info().
		Int("locations", len(data)).
		Int("total_vendors", totalVendors).
		Msg("✅ Locations: Sending to client")

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": data})
}

func (h *VendorLeaderboardHandler) GetTopVendorsByCategory(c *gin.Context) {
	category := c.Param("category")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	vendors, err := h.leaderboardService.GetTopVendorsByCategory(c.Request.Context(), category, limit)
	if err != nil {
		log.Error().Err(err).Str("cat", category).Msg("❌ Leaderboard: Category fetch failed")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": vendors})
}

func (h *VendorLeaderboardHandler) GetTopVendorsByLocation(c *gin.Context) {
	state := c.Param("state")
	city := c.Query("city")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	vendors, err := h.leaderboardService.GetTopVendorsByLocation(c.Request.Context(), state, city, limit)
	if err != nil {
		log.Error().Err(err).Str("state", state).Msg("❌ Leaderboard: Location fetch failed")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": vendors})
}

func (h *VendorLeaderboardHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "vendor-leaderboard"})
}

func (h *VendorLeaderboardHandler) TestEndpoint(c *gin.Context) {
	log.Debug().Msg("🧪 Leaderboard test endpoint called")

	// Now that GetLeaderboardCount is in the interface, we can use it!
	count, err := h.leaderboardService.GetLeaderboardCount(c.Request.Context())
	if err != nil {
		log.Error().Err(err).Msg("❌ Leaderboard Health Check Failed")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "error", 
			"message": "Database or View is not responding",
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":          "ok",
		"total_ranked":    count,
		"message":         "Leaderboard service and database view are operational",
		"timestamp":       time.Now().Format(time.RFC3339),
	})
}