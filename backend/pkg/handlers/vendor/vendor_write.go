// backend/pkg/handlers/vendor/vendor_write.go

package vendor

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/eventify/backend/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// VendorBinding captures the incoming JSON from Next.js
type VendorBinding struct {
	Name                string `json:"name" binding:"required"`
	Category            string `json:"category" binding:"required"`
	Description         string `json:"description"`
	ImageURL            string `json:"image_url"`
	City                string `json:"city"`
	State               string `json:"state"`
	PhoneNumber         string `json:"phone_number"`
	Email               string `json:"email"`
	VNIN                string `json:"vnin" binding:"required"`
	VerifiedVNIN        string `json:"verified_vnin"`
	FirstName           string `json:"first_name"`
	LastName            string `json:"last_name"`
	MiddleName          string `json:"middle_name"`
	CACNumber           string `json:"cac_number"`
	MinPrice            int32  `json:"min_price"` // In Naira
	Status              string `json:"status"`
	IsIdentityVerified  bool   `json:"is_identity_verified"`
	IsBusinessVerified  bool   `json:"is_business_verified"`
}

// convertNairaToKobo converts Naira to Kobo (multiply by 100)
func convertNairaToKobo(naira int32) int32 {
	return naira * 100
}

// RegisterVendor handles new vendor registration
func (h *VendorHandler) RegisterVendor(c *gin.Context) {
	var input VendorBinding
	if err := c.ShouldBindJSON(&input); err != nil {
    log.Warn().Err(err).Msg("Invalid vendor registration payload")
    c.JSON(http.StatusBadRequest, gin.H{
        "error":  "Invalid input data",
        "detail": err.Error(),
    })
    return
}

	// Security: Tamper-proof check for vNIN
	if input.VNIN != input.VerifiedVNIN {
		log.Warn().Msg("vNIN verification mismatch attempt")
		c.JSON(http.StatusForbidden, gin.H{"error": "Identity verification mismatch"})
		return
	}

	// Auth: Get User ID from Middleware
	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	ownerID := userIDVal.(uuid.UUID)

	// Check if user already has a vendor profile
	existingVendor, _ := h.VendorService.GetVendorByOwnerID(c.Request.Context(), ownerID)
	if existingVendor != nil {
		log.Warn().Str("owner_id", ownerID.String()).Msg("Duplicate vendor registration attempt")
		c.JSON(http.StatusConflict, gin.H{"error": "You already have a vendor profile. Please use the edit function to update it."})
		return
	}

	// Price Conversion: Convert Naira to Kobo
	minPriceKobo := convertNairaToKobo(input.MinPrice)

	// Mapping: Binding -> Model
	vendor := models.Vendor{
		OwnerID:            ownerID,
		Name:               input.Name,
		Category:           input.Category,
		Status:             models.VendorStatusActive,
		IsIdentityVerified: input.IsIdentityVerified,
		State:              input.State,
		Description:        input.Description,
		ImageURL:           input.ImageURL,
		City:               input.City,
		PhoneNumber:        input.PhoneNumber,
		Email:              input.Email,
		VNIN:               input.VNIN,
		FirstName:          input.FirstName,
		LastName:           input.LastName,
		MiddleName:         models.ToNullString(input.MiddleName),
		CACNumber:          models.ToNullString(input.CACNumber),
		MinPrice:           models.ToNullInt32(minPriceKobo),
		IsBusinessVerified: sql.NullBool{Bool: input.IsBusinessVerified, Valid: true},
	}

	// Execution
	vendorID, err := h.VendorService.CreateVendor(c.Request.Context(), &vendor)
	if err != nil {
		log.Error().Err(err).Str("owner_id", ownerID.String()).Msg("Vendor creation failed")
		if strings.Contains(err.Error(), "unique constraint") {
			c.JSON(http.StatusConflict, gin.H{"error": "vNIN or Business Name already registered"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration failed"})
		return
	}
	

	log.Info().Str("vendor_id", vendorID).Str("vendor_name", input.Name).Msg("Vendor registered successfully")
	c.JSON(http.StatusCreated, gin.H{
		"vendor_id": vendorID,
		"message":   "Vendor profile created successfully!",
	})
}

// UpdateVendor handles vendor profile updates
func (h *VendorHandler) UpdateVendor(c *gin.Context) {
	vendorIDStr := c.Param("id")
	userIDVal, _ := c.Get("user_id")
	requestorID := userIDVal.(uuid.UUID)

	var input VendorBinding
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Warn().Err(err).Str("vendor_id", vendorIDStr).Msg("Invalid update payload")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid update data"})
		return
	}

	// Validate and default status
	status := models.VendorStatus(input.Status)
	if status == "" {
		status = models.VendorStatusActive
	}

	validStatuses := map[models.VendorStatus]bool{
		models.VendorStatusActive:    true,
		models.VendorStatusSuspended: true,
		models.VendorStatusDeleted:   true,
	}
	if !validStatuses[status] {
		log.Warn().Str("status", string(status)).Msg("Invalid vendor status")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid vendor status"})
		return
	}

	// Price Conversion: Convert Naira to Kobo
	minPriceKobo := convertNairaToKobo(input.MinPrice)

	updatedVendor := models.Vendor{
		Name:               input.Name,
		Category:           input.Category,
		State:              input.State,
		Description:        input.Description,
		ImageURL:           input.ImageURL,
		City:               input.City,
		PhoneNumber:        input.PhoneNumber,
		Email:              input.Email,
		VNIN:               input.VNIN,
		FirstName:          input.FirstName,
		LastName:           input.LastName,
		Status:             status,
		IsIdentityVerified: input.IsIdentityVerified,
		MiddleName:         models.ToNullString(input.MiddleName),
		CACNumber:          models.ToNullString(input.CACNumber),
		MinPrice:           models.ToNullInt32(minPriceKobo),
		IsBusinessVerified: sql.NullBool{Bool: input.IsBusinessVerified, Valid: true},
	}

	err := h.VendorService.UpdateVendor(c.Request.Context(), vendorIDStr, requestorID, &updatedVendor)
	if err != nil {
		if err.Error() == "unauthorized" {
			c.JSON(http.StatusForbidden, gin.H{"error": "You do not own this profile"})
			return
		}
		log.Error().Err(err).Str("vendor_id", vendorIDStr).Msg("Vendor update failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	// Return updated vendor data
	refreshed, err := h.VendorService.GetVendorByID(c.Request.Context(), vendorIDStr)
	if err != nil {
		log.Warn().Err(err).Str("vendor_id", vendorIDStr).Msg("Failed to fetch updated vendor")
		c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
		return
	}

	log.Info().Str("vendor_id", vendorIDStr).Msg("Vendor updated successfully")
	// Replace the c.JSON in the refreshed block
c.JSON(http.StatusOK, gin.H{
    "message": "Vendor profile updated successfully!",
    "vendor":  refreshed.ToOwnerResponse(),
})
}

// ToggleIdentityVerification updates vendor identity verification status
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

	err := h.VendorService.UpdateVerificationStatus(c.Request.Context(), vendorID, "is_identity_verified", req.IsVerified, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Update failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
}