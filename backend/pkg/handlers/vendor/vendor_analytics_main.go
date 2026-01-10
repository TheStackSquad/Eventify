// backend/pkg/handlers/vendor_analytics_main.go

package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (h *VendorAnalyticsHandler) GetVendorAnalytics(c *gin.Context) {
	authenticatedUserID, exists := c.Get("user_id")
	if !exists {
		log.Warn().Msg("User ID not found in context (auth middleware issue)")
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"message": "Authentication required. Please log in.",
		})
		return
	}

	authenticatedVendorID, ok := authenticatedUserID.(uuid.UUID)
	if !ok {
		log.Error().Msg("Failed to convert authenticated user ID to uuid.UUID")
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Internal server error: ID format mismatch",
		})
		return
	}

	vendorIDParam := c.Param("id")
	requestedVendorID, err := uuid.Parse(vendorIDParam)
	if err != nil {
		log.Warn().
			Str("vendor_id_param", vendorIDParam).
			Err(err).
			Msg("Invalid vendor ID format")

		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid vendor ID format (must be UUID)",
		})
		return
	}

	if authenticatedVendorID != requestedVendorID {
		log.Warn().
			Str("authenticated_vendor_id", authenticatedVendorID.String()).
			Str("requested_vendor_id", requestedVendorID.String()).
			Msg("Unauthorized analytics access attempt")

		c.JSON(http.StatusForbidden, gin.H{
			"status":  "error",
			"message": "You don't have permission to view this vendor's analytics",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	log.Info().
		Str("vendor_id", requestedVendorID.String()).
		Msg("Fetching vendor analytics")

	analytics, err := h.analyticsService.GetVendorAnalytics(ctx, requestedVendorID)

	if err != nil {
		errorMessage := err.Error()

		if errorMessage == "vendor not found" {
			log.Warn().
				Str("vendor_id", requestedVendorID.String()).
				Msg("Vendor not found")

			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Vendor not found or account has been deleted",
			})
			return
		}

		log.Error().
			Err(err).
			Str("vendor_id", requestedVendorID.String()).
			Msg("Failed to fetch vendor analytics")

		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to fetch analytics. Please try again later.",
			"error":   errorMessage,
		})
		return
	}

	log.Info().
		Str("vendor_id", requestedVendorID.String()).
		Int("total_inquiries", analytics.Inquiries.Total).
		Msg("Vendor analytics fetched successfully")

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Analytics retrieved successfully",
		"data":    analytics,
	})
}