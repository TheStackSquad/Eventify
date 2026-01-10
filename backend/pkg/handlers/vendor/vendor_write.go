// backend/pkg/handlers/vendor/vendor_write.go
// Vendor handler - write operations

package handlers

import (
	"net/http"
	"strings"

	"eventify/backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (h *VendorHandler) RegisterVendor(c *gin.Context) {
    var input VendorBinding
    if err := c.ShouldBindJSON(&input); err != nil {
        log.Error().Err(err).Msg("Vendor registration request binding failed")
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input. Please check required fields."})
        return
    }

    // ✅ STEP 1: Get authenticated user_id from context FIRST
    userIDVal, exists := c.Get("user_id")
    if !exists {
        log.Error().Msg("user_id not found in context - auth middleware may not be configured")
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
        return
    }

    // ✅ STEP 2: Cast to uuid.UUID
    ownerID, ok := userIDVal.(uuid.UUID)
    if !ok {
        log.Error().Msg("user_id in context is not a UUID type")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user session"})
        return
    }

    // ✅ STEP 3: NOW check if user already has a vendor profile
    existingVendor, err := h.VendorService.GetVendorByOwnerID(c.Request.Context(), ownerID)
    if err != nil {
        log.Error().Err(err).Msg("Failed to check existing vendor")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
        return
    }

    if existingVendor != nil {
        c.JSON(http.StatusConflict, gin.H{
            "error": "You already have a vendor profile",
            "vendor_id": existingVendor.ID,
        })
        return
    }

    // ✅ STEP 4: Create vendor object
    vendor := models.Vendor{
        OwnerID:       ownerID,
        Name:          input.Name,
        Category:      input.Category,
        ImageURL:      input.ImageURL,
        Status:      models.StatusActive,
        State:         input.State,
        City:          input.City,
        PhoneNumber:   input.PhoneNumber,
    }

    if input.MinPrice > 0 {
        vendor.MinPrice = models.ToNullInt32(input.MinPrice)
    }

    // ✅ STEP 5: Create vendor in database
    vendorID, err := h.VendorService.CreateVendor(c.Request.Context(), &vendor)
    if err != nil {
        log.Error().Err(err).Msg("Failed to create vendor")
        
        // Better error message if it's a duplicate vendor
        if strings.Contains(err.Error(), "duplicate key") || 
           strings.Contains(err.Error(), "unique constraint") {
            c.JSON(http.StatusConflict, gin.H{
                "error": "You already have a vendor profile",
            })
            return
        }
        
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register vendor profile."})
        return
    }

    log.Info().Str("vendorID", vendorID).Str("ownerID", ownerID.String()).Msg("Vendor registered successfully")

    c.JSON(http.StatusCreated, gin.H{
        "message":   "Vendor profile created. Pending verification.",
        "vendor_id": vendorID,
    })
}

func (h *VendorHandler) UpdateVendor(c *gin.Context) {
	vendorID := c.Param("id")

	if _, err := uuid.Parse(vendorID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid vendor ID format."})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	err := h.VendorService.UpdateVendor(c.Request.Context(), vendorID, updates)
	if err != nil {
		log.Error().Err(err).Str("vendorID", vendorID).Msg("Failed to update vendor")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update vendor: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Vendor updated successfully",
	})
}

func (h *VendorHandler) ToggleIdentityVerification(c *gin.Context) {
	vendorID := c.Param("id")

	var req struct {
		IsVerified bool   `json:"is_verified"`
		Reason     string `json:"reason,omitempty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if _, err := uuid.Parse(vendorID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid vendor ID format."})
		return
	}

	err := h.VendorService.UpdateVerificationStatus(c.Request.Context(), vendorID, "is_identity_verified", req.IsVerified, req.Reason)

	if err != nil {
		log.Error().Err(err).Str("vendorID", vendorID).Msg("Failed to update identity verification status")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update identity verification status."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Vendor identity status updated."})
}