// backend/pkg/handlers/analytics.go
// HTTP handlers for analytics endpoints

package handlers

import (
	"context"
	"net/http"
	"time"

	"eventify/backend/pkg/services"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ============================================================================
// HANDLER STRUCT
// ============================================================================

// AnalyticsHandler handles HTTP requests for analytics endpoints
type AnalyticsHandler struct {
	analyticsService services.AnalyticsService
}

// NewAnalyticsHandler creates a new analytics handler instance
func NewAnalyticsHandler(analyticsService services.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{
		analyticsService: analyticsService,
	}
}

// ============================================================================
// MAIN ANALYTICS ENDPOINT
// ============================================================================

// FetchEventAnalytics retrieves comprehensive analytics for a specific event
// Route: GET /api/events/:eventId/analytics
// Auth: Required (AuthMiddleware)
// Query Params: ?includeTimeline=true (optional)
func (h *AnalyticsHandler) FetchEventAnalytics(c *gin.Context) {
	// Step 1: Extract organizer ID from auth middleware context
	organizerID, exists := c.Get("user_id")
	if !exists {
		log.Warn().Msg("User ID not found in context (auth middleware issue)")
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"message": "Authentication required",
		})
		return
	}

	// Step 2: Parse event ID from URL parameter
	eventIDParam := c.Param("eventId")
	eventID, err := primitive.ObjectIDFromHex(eventIDParam)
	if err != nil {
		log.Warn().
			Str("event_id_param", eventIDParam).
			Err(err).
			Msg("Invalid event ID format")
		
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid event ID format",
		})
		return
	}

	// Step 3: Check if timeline should be included (optional query param)
	includeTimeline := c.DefaultQuery("includeTimeline", "false") == "true"

	// Step 4: Convert organizer ID to ObjectID
	organizerObjID, ok := organizerID.(primitive.ObjectID)
	if !ok {
		log.Error().Msg("Failed to convert organizer ID to ObjectID")
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Internal server error",
		})
		return
	}

	// Step 5: Create context with timeout
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	// Step 6: Log the analytics request
	log.Info().
		Str("event_id", eventID.Hex()).
		Str("organizer_id", organizerObjID.Hex()).
		Bool("include_timeline", includeTimeline).
		Msg("Fetching event analytics")

	// Step 7: Call analytics service
	analytics, err := h.analyticsService.GetEventAnalytics(
		ctx,
		eventID,
		organizerObjID,
		includeTimeline,
	)

	if err != nil {
		// Handle different error types
		errorMessage := err.Error()

		// Unauthorized access
		if errorMessage == "unauthorized: event does not belong to this organizer" {
			log.Warn().
				Str("event_id", eventID.Hex()).
				Str("organizer_id", organizerObjID.Hex()).
				Msg("Unauthorized analytics access attempt")
			
			c.JSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "You don't have permission to view this event's analytics",
			})
			return
		}

		// Event not found
		if errorMessage == "event not found or deleted" {
			log.Warn().
				Str("event_id", eventID.Hex()).
				Msg("Event not found")
			
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Event not found or has been deleted",
			})
			return
		}

		// Generic error
		log.Error().
			Err(err).
			Str("event_id", eventID.Hex()).
			Msg("Failed to fetch analytics")
		
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to fetch analytics. Please try again later.",
			"error":   errorMessage, // Include in development, remove in production
		})
		return
	}

	// Step 8: Success response
	log.Info().
		Str("event_id", eventID.Hex()).
		Str("organizer_id", organizerObjID.Hex()).
		Int("tickets_sold", analytics.Tickets.TotalSold).
		Int("total_orders", analytics.Orders.Total).
		Msg("Analytics fetched successfully")

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Analytics retrieved successfully",
		"data":    analytics,
	})
}

// ============================================================================
// FUTURE ENDPOINTS (Placeholders)
// ============================================================================

// FetchEventTimeline returns sales data over time for charting
// Route: GET /api/events/:eventId/analytics/timeline
// Query Params: ?groupBy=day|week|month&startDate=2025-01-01&endDate=2025-01-31
func (h *AnalyticsHandler) FetchEventTimeline(c *gin.Context) {
	eventIDParam := c.Param("eventId")
	groupBy := c.DefaultQuery("groupBy", "day")

	log.Info().
		Str("event_id", eventIDParam).
		Str("group_by", groupBy).
		Msg("Timeline endpoint called (not yet implemented)")

	c.JSON(http.StatusNotImplemented, gin.H{
		"status":  "info",
		"message": "Timeline analytics coming soon",
		"params": gin.H{
			"eventId": eventIDParam,
			"groupBy": groupBy,
		},
	})
}

// FetchOrganizerDashboard returns aggregated analytics for all organizer's events
// Route: GET /api/analytics/organizer/dashboard
// Query Params: ?startDate=2025-01-01&endDate=2025-01-31
func (h *AnalyticsHandler) FetchOrganizerDashboard(c *gin.Context) {
	organizerID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"message": "Authentication required",
		})
		return
	}

	organizerObjID := organizerID.(primitive.ObjectID)

	log.Info().
		Str("organizer_id", organizerObjID.Hex()).
		Msg("Organizer dashboard endpoint called (not yet implemented)")

	c.JSON(http.StatusNotImplemented, gin.H{
		"status":  "info",
		"message": "Organizer-wide analytics coming soon",
		"organizerId": organizerObjID.Hex(),
	})
}

// ExportEventAnalytics exports analytics data to CSV/Excel
// Route: GET /api/events/:eventId/analytics/export
// Query Params: ?format=csv|excel
func (h *AnalyticsHandler) ExportEventAnalytics(c *gin.Context) {
	eventIDParam := c.Param("eventId")
	format := c.DefaultQuery("format", "csv")

	log.Info().
		Str("event_id", eventIDParam).
		Str("format", format).
		Msg("Export endpoint called (not yet implemented)")

	c.JSON(http.StatusNotImplemented, gin.H{
		"status":  "info",
		"message": "Export functionality coming soon",
		"params": gin.H{
			"eventId": eventIDParam,
			"format":  format,
		},
	})
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

// HealthCheck verifies analytics service is operational
// Route: GET /api/analytics/health
// Auth: Not required (public endpoint)
func (h *AnalyticsHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"service":   "analytics",
		"timestamp": time.Now(),
		"message":   "Analytics service is operational",
	})
}