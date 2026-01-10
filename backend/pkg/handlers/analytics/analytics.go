// backend/pkg/handlers/analytics/analytics.go
// Analytics handler - main struct and primary endpoint

package handlers

import (
	"context"
	"net/http"
	"time"

	serviceanalytics "eventify/backend/pkg/services/analytics"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type AnalyticsHandler struct {
	analyticsService serviceanalytics.AnalyticsService
}

func NewAnalyticsHandler(analyticsService serviceanalytics.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{analyticsService: analyticsService}
}

func (h *AnalyticsHandler) FetchEventAnalytics(c *gin.Context) {
	organizerIDVal, exists := c.Get("userID")
	if !exists {
		log.Warn().Msg("User ID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"message": "Authentication required",
		})
		return
	}

	eventIDParam := c.Param("eventId")
	eventID, err := uuid.Parse(eventIDParam)
	if err != nil {
		log.Warn().Str("event_id_param", eventIDParam).Err(err).Msg("Invalid event ID format")
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid event ID format",
		})
		return
	}

	includeTimeline := c.DefaultQuery("includeTimeline", "false") == "true"

	var organizerID uuid.UUID
	switch v := organizerIDVal.(type) {
	case string:
		organizerID, err = uuid.Parse(v)
		if err != nil {
			log.Error().Err(err).Str("organizer_id", v).Msg("Failed to parse organizer ID")
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Internal server error",
			})
			return
		}
	case uuid.UUID:
		organizerID = v
	default:
		log.Error().Interface("organizer_id_type", v).Msg("Unexpected organizer ID type")
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Internal server error",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	log.Info().
		Str("event_id", eventID.String()).
		Str("organizer_id", organizerID.String()).
		Bool("include_timeline", includeTimeline).
		Msg("Fetching event analytics")

	analytics, err := h.analyticsService.GetEventAnalytics(ctx, eventID, organizerID, includeTimeline)
	if err != nil {
		errorMessage := err.Error()

		if errorMessage == "unauthorized: event does not belong to this organizer" {
			log.Warn().
				Str("event_id", eventID.String()).
				Str("organizer_id", organizerID.String()).
				Msg("Unauthorized analytics access attempt")

			c.JSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "You don't have permission to view this event's analytics",
			})
			return
		}

		if errorMessage == "event not found or deleted" {
			log.Warn().Str("event_id", eventID.String()).Msg("Event not found")
			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Event not found or has been deleted",
			})
			return
		}

		log.Error().Err(err).Str("event_id", eventID.String()).Msg("Failed to fetch analytics")
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to fetch analytics. Please try again later.",
		})
		return
	}

	log.Info().
		Str("event_id", eventID.String()).
		Str("organizer_id", organizerID.String()).
		Int("tickets_sold", analytics.Tickets.TotalSold).
		Int("total_orders", analytics.Orders.Total).
		Msg("Analytics fetched successfully")

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Analytics retrieved successfully",
		"data":    analytics,
	})
}