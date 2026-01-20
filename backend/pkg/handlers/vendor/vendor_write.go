//backend/pkg/handlers/vendor/vendor_write.go
package handlers

import (
	"net/http"
	"strings"
	"database/sql"

	"github.com/eventify/backend/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// VendorBinding captures the incoming JSON from Next.js
type VendorBinding struct {
	Name        string `json:"name" binding:"required"`
	Category    string `json:"category" binding:"required"`
	Description string `json:"description"`
	ImageURL    string `json:"imageURL"`
	State       string `json:"state" binding:"required"`
	City        string `json:"city"`
	PhoneNumber string `json:"phoneNumber" binding:"required"`
	Email       string `json:"email"`
	MinPrice    int32  `json:"minPrice"`

	// Identity (vNIN)
	VNIN               string `json:"vnin" binding:"required"`
	VerifiedVNIN       string `json:"verifiedVnin" binding:"required"`
	IsIdentityVerified bool   `json:"isIdentityVerified"`
	FirstName          string `json:"firstName"`
	MiddleName         string `json:"middleName"`
	LastName           string `json:"lastName"`
	DateOfBirth        string `json:"dateOfBirth"`
	Gender             string `json:"gender"`

	// Business (CAC)
	CACNumber          string `json:"cacNumber"`
	VerifiedCACNumber  string `json:"verifiedCacNumber"`
	IsBusinessVerified bool   `json:"isBusinessVerified"`
}

func (h *VendorHandler) RegisterVendor(c *gin.Context) {
	var input VendorBinding
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Error().Err(err).Msg("Vendor registration binding failed")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data"})
		return
	}

	// 1. SECURITY: Tamper-proof check for vNIN
	if input.VNIN != input.VerifiedVNIN {
		c.JSON(http.StatusForbidden, gin.H{"error": "Identity verification mismatch"})
		return
	}

	// 2. Auth: Get User ID from Middleware
	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	ownerID := userIDVal.(uuid.UUID)

	// 3. Logic: Check if user already has a vendor profile
	existingVendor, _ := h.VendorService.GetVendorByOwnerID(c.Request.Context(), ownerID)
	if existingVendor != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Vendor profile already exists for this user"})
		return
	}

	// 4. Mapping: Binding -> Model
	// 4. Mapping: Binding -> Model
vendor := models.Vendor{
    OwnerID:     ownerID,
    Name:        input.Name,
    Category:    input.Category,
    Status:      models.StatusActive,
    IsIdentityVerified: input.IsIdentityVerified,
    State:       input.State,

    // NEW: Using helpers for ALL nullable fields identified in your audit
    Description: models.ToNullString(input.Description),
    ImageURL:    models.ToNullString(input.ImageURL),
    City:        models.ToNullString(input.City),
    PhoneNumber: models.ToNullString(input.PhoneNumber),
    Email:       models.ToNullString(input.Email),
    VNIN:        models.ToNullString(input.VNIN),
    FirstName:   models.ToNullString(input.FirstName),
    MiddleName:  models.ToNullString(input.MiddleName),
    LastName:    models.ToNullString(input.LastName),
    Gender:      models.ToNullString(input.Gender),
    CACNumber:   models.ToNullString(input.CACNumber),
    
    // Date specific helper
    DateOfBirth: models.ToNullTimeFromString(input.DateOfBirth),
    
    // Integer helper
    MinPrice:    models.ToNullInt32(input.MinPrice),

    // Boolean helper (Custom)
   IsBusinessVerified: sql.NullBool{
    Bool:  input.IsBusinessVerified,
    Valid: true,
},
}

	// 5. Execution
	vendorID, err := h.VendorService.CreateVendor(c.Request.Context(), &vendor)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create vendor")
		if strings.Contains(err.Error(), "unique constraint") {
			c.JSON(http.StatusConflict, gin.H{"error": "vNIN or Business Name already registered"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"vendor_id": vendorID, "message": "Welcome aboard!"})
}

func (h *VendorHandler) UpdateVendor(c *gin.Context) {
	vendorID := c.Param("id")

	// 1. Auth: Ensure the person updating IS the owner
	userIDVal, _ := c.Get("user_id")
	requestorID := userIDVal.(uuid.UUID)

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid update data"})
		return
	}

	// 2. Logic: Pass the requestorID to service to verify ownership before update
	err := h.VendorService.UpdateVendor(c.Request.Context(), vendorID, requestorID, updates)
	if err != nil {
		if err.Error() == "unauthorized" {
			c.JSON(http.StatusForbidden, gin.H{"error": "You do not own this profile"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
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

	err := h.VendorService.UpdateVerificationStatus(c.Request.Context(), vendorID, "is_identity_verified", req.IsVerified, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Update failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
}