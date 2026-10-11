// backend/pkg/handlers/vendor_analytics_main.go

package vendor

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (h *VendorAnalyticsHandler) GetVendorAnalytics(c *gin.Context) {
	// 1. Get the User ID from the Auth Middleware (from JWT)
	authenticatedUserIDRaw, exists := c.Get("user_id")
	if !exists {
		log.Warn().Msg("User ID not found in context (auth middleware issue)")
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"message": "Authentication required. Please log in.",
		})
		return
	}

	// Correctly cast to User ID (this is f897... in your case)
	userID, ok := authenticatedUserIDRaw.(uuid.UUID)
	if !ok {
		log.Error().Msg("Failed to convert authenticated user ID to uuid.UUID")
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Internal server error: ID format mismatch",
		})
		return
	}

	// 2. Get the Vendor ID from the URL Parameter (this is 30da... in your case)
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

	// NOTE: We removed the direct comparison (userID != vendorID) 
	// because they are different entities.

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	log.Info().
		Str("user_id", userID.String()).
		Str("vendor_id", requestedVendorID.String()).
		Msg("Fetching vendor analytics with ownership check")

	// 3. Pass both IDs to the service. 
	// The service will check if this User ID owns this Vendor ID.
	analytics, err := h.analyticsService.GetVendorAnalytics(ctx, requestedVendorID, userID)

	if err != nil {
		errorMessage := err.Error()

		// Handle the case where the user doesn't own the vendor OR it doesn't exist
		if errorMessage == "vendor not found" || errorMessage == "unauthorized" {
			log.Warn().
				Str("user_id", userID.String()).
				Str("vendor_id", requestedVendorID.String()).
				Msg("Access denied or vendor missing")

			c.JSON(http.StatusNotFound, gin.H{
				"status":  "error",
				"message": "Vendor analytics not found or you do not have permission to view them",
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
		Msg("Vendor analytics fetched successfully")

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Analytics retrieved successfully",
		"data":    analytics,
	})
}