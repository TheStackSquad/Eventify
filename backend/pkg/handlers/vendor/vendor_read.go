// backend/pkg/handlers/vendor/vendor_read.go
// Vendor handler - read operations

package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (h *VendorHandler) ListVendors(c *gin.Context) {
    queryParams := c.Request.URL.Query()
    filters := make(map[string]interface{})

    for key, values := range queryParams {
        if len(values) > 0 && values[0] != "" { // Added empty string check
            filters[key] = values[0]
        }
    }

    vendors, err := h.VendorService.GetVendors(c.Request.Context(), filters)
    if err != nil {
        log.Error().Err(err).Msg("Failed to retrieve vendors list")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve vendors list."})
        return
    }

    // ✅ Ensure vendors is never nil so JSON is [] not null
    if vendors == nil {
        vendors = []models.Vendor{} // Initialize as empty slice
    }

    // ✅ Wrap in an object to match frontend expectations
    c.JSON(http.StatusOK, gin.H{
        "vendors":    vendors,
        "pagination": gin.H{"totalCount": len(vendors)}, 
    })
}

func (h *VendorHandler) GetVendorProfile(c *gin.Context) {
	vendorID := c.Param("id")

	if _, err := uuid.Parse(vendorID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid vendor ID format."})
		return
	}

	vendor, err := h.VendorService.GetVendorByID(c.Request.Context(), vendorID)
	if err != nil {
		log.Error().Err(err).Str("vendorID", vendorID).Msg("Vendor not found")
		if err.Error() == "vendor not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Vendor profile not found."})
			return
		}
		if err.Error() == "invalid vendor ID format" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid vendor ID format."})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve vendor profile."})
		return
	}

	c.JSON(http.StatusOK, vendor)
}