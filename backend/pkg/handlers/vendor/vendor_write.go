// backend/pkg/handlers/vendor/vendor_write.go

package vendor

import (
	"errors"
	"net/http"
	"strings"

	"github.com/eventify/backend/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// VendorBinding captures the incoming JSON from Next.js (see vendorApi.toBackendVendorPayload).
// Limits mirror the vendors table. There are deliberately NO verification flags, vNIN, CAC
// number, email or status here: those come from signed proofs or the server, never the client.
type VendorBinding struct {
	Name        string `json:"name" binding:"required,max=255"`
	Category    string `json:"category" binding:"required,max=100"`
	Description string `json:"description" binding:"max=500"`
	ImageURL    string `json:"image_url" binding:"max=255"`
	City        string `json:"city" binding:"max=100"`
	State       string `json:"state" binding:"required,max=100"`
	PhoneNumber string `json:"phone_number" binding:"max=20"`
	FirstName   string `json:"first_name" binding:"max=100"`
	MiddleName  string `json:"middle_name" binding:"max=100"`
	LastName    string `json:"last_name" binding:"max=100"`
	MinPrice    int64  `json:"min_price" binding:"gte=0,lte=21474836"` // Naira
	VNINProof   string `json:"vnin_proof" binding:"max=2048"`
	CACProof    string `json:"cac_proof" binding:"max=2048"`
}

// convertNairaToKobo: the binding bounds naira to <= 21,474,836, so kobo fits in int32.
func convertNairaToKobo(naira int64) int32 {
	return int32(naira * 100)
}

func respondVerificationError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrProofSecretMissing):
		log.Error().Msg("VERIFICATION_PROOF_SECRET is missing or shorter than 32 characters")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Verification is temporarily unavailable"})
	case errors.Is(err, ErrIdentityRequired):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please verify your vNIN to continue"})
	case errors.Is(err, ErrBusinessNeedsIdentity):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verify your vNIN before verifying your business"})
	default:
		c.JSON(http.StatusForbidden, gin.H{"error": "Verification expired or invalid. Please verify again."})
	}
}

// RegisterVendor handles new vendor registration
func (h *VendorHandler) RegisterVendor(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	ownerID, ok := userIDVal.(uuid.UUID)
	if !exists || !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var input VendorBinding
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Warn().Err(err).Msg("Invalid vendor registration payload")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data", "detail": err.Error()})
		return
	}

	existingVendor, _ := h.VendorService.GetVendorByOwnerID(c.Request.Context(), ownerID)
	if existingVendor != nil {
		log.Warn().Str("owner_id", ownerID.String()).Msg("Duplicate vendor registration attempt")
		c.JSON(http.StatusConflict, gin.H{"error": "You already have a vendor profile. Please use the edit function to update it."})
		return
	}

	vendor := models.Vendor{
		OwnerID:     ownerID,
		Name:        input.Name,
		Category:    input.Category,
		Status:      models.VendorStatusActive,
		State:       input.State,
		Description: input.Description,
		ImageURL:    input.ImageURL,
		City:        input.City,
		PhoneNumber: input.PhoneNumber,
		MinPrice:    models.ToNullInt32(convertNairaToKobo(input.MinPrice)),
	}

	if err := applyVerification(&vendor, nil, &input, ownerID); err != nil {
		log.Warn().Err(err).Str("owner_id", ownerID.String()).Msg("Vendor verification rejected")
		respondVerificationError(c, err)
		return
	}

	vendorID, err := h.VendorService.CreateVendor(c.Request.Context(), &vendor)
	if err != nil {
		log.Error().Err(err).Str("owner_id", ownerID.String()).Msg("Vendor creation failed")
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusConflict, gin.H{"error": "A vendor with this information already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration failed"})
		return
	}

	log.Info().Str("vendor_id", vendorID).Msg("Vendor registered successfully")
	c.JSON(http.StatusCreated, gin.H{
		"vendor_id": vendorID,
		"message":   "Vendor profile created successfully!",
	})
}

// UpdateVendor handles vendor profile updates
func (h *VendorHandler) UpdateVendor(c *gin.Context) {
	vendorIDStr := c.Param("id")

	userIDVal, exists := c.Get("user_id")
	requestorID, ok := userIDVal.(uuid.UUID)
	if !exists || !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var input VendorBinding
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Warn().Err(err).Str("vendor_id", vendorIDStr).Msg("Invalid update payload")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid update data"})
		return
	}

	existing, err := h.VendorService.GetVendorByID(c.Request.Context(), vendorIDStr)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Vendor not found"})
		return
	}
	if existing.OwnerID != requestorID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not own this profile"})
		return
	}

	updated := models.Vendor{
		Name:        input.Name,
		Category:    input.Category,
		State:       input.State,
		Description: input.Description,
		ImageURL:    input.ImageURL,
		City:        input.City,
		PhoneNumber: input.PhoneNumber,
		MinPrice:    models.ToNullInt32(convertNairaToKobo(input.MinPrice)),
		Status:      existing.Status, // moderation status is never owner-controlled
		Email:       existing.Email,  // not collected by the form: preserve whatever exists
	}

	if err := applyVerification(&updated, existing, &input, requestorID); err != nil {
		log.Warn().Err(err).Str("vendor_id", vendorIDStr).Msg("Vendor verification rejected")
		respondVerificationError(c, err)
		return
	}

	if err = h.VendorService.UpdateVendor(c.Request.Context(), vendorIDStr, requestorID, &updated); err != nil {
		if err.Error() == "unauthorized" {
			c.JSON(http.StatusForbidden, gin.H{"error": "You do not own this profile"})
			return
		}
		log.Error().Err(err).Str("vendor_id", vendorIDStr).Msg("Vendor update failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	refreshed, err := h.VendorService.GetVendorByID(c.Request.Context(), vendorIDStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
		return
	}

	log.Info().Str("vendor_id", vendorIDStr).Msg("Vendor updated successfully")
	c.JSON(http.StatusOK, gin.H{
		"message": "Vendor profile updated successfully!",
		"vendor":  refreshed.ToOwnerResponse(),
	})
}

// ToggleIdentityVerification updates vendor identity verification status.
// NOTE: this flips a flag without any proof. Its route must be admin-only.
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