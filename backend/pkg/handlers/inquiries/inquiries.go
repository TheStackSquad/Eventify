// backend/pkg/handlers/inquiries.go

package handlers

import (
	"net/http"

	"eventify/backend/pkg/models"
	serviceinquiries "eventify/backend/pkg/services/inquiries"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type InquiryHandler struct {
	Service serviceinquiries.InquiryService
}

func NewInquiryHandler(service serviceinquiries.InquiryService) *InquiryHandler {
	return &InquiryHandler{Service: service}
}

func (h *InquiryHandler) CreateInquiry(c *gin.Context) {
    vendorID := c.Param("vendor_id")
    vendorUUID, err := uuid.Parse(vendorID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid vendor ID"})
        return
    }

    var req struct {
        Name    string `json:"name" binding:"required"`
        Email   string `json:"email" binding:"required,email"`
        Message string `json:"message" binding:"required"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"message": "Validation failed", "error": err.Error()})
        return
    }

    // 1. Identify the guest
    guestID, _ := c.Cookie("guest_id")

    // 2. Identify the user (if logged in) - Declare it properly here
    var userID *uuid.UUID 
    if userIDRaw, exists := c.Get("user_id"); exists {
        if uid, ok := userIDRaw.(uuid.UUID); ok {
            userID = &uid // Point to the UUID
        }
    }

    // 3. Create the basic model
    inquiry := &models.Inquiry{
        ID:        uuid.New(),
        VendorID:  vendorUUID,
        Name:      req.Name,
        Email:     req.Email,
        Message:   req.Message,
        GuestID:   guestID,
        IPAddress: models.ToNullString(c.ClientIP()),
    }

    // 4. Pass inquiry and the optional userID pointer to the service
    if err := h.Service.CreateInquiry(c.Request.Context(), inquiry, userID); err != nil {
        log.Error().Err(err).Str("guest_id", guestID).Msg("Failed to save inquiry")
        c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to submit inquiry"})
        return
    }

    c.JSON(http.StatusCreated, gin.H{"message": "Inquiry submitted successfully"})
}

func (h *InquiryHandler) GetVendorInquiries(c *gin.Context) {
	vendorID := c.Param("vendor_id")
	if vendorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Vendor ID is required"})
		return
	}

	inquiries, err := h.Service.GetInquiriesByVendor(c.Request.Context(), vendorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch inquiries"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"vendor_id": vendorID,
		"count":     len(inquiries),
		"inquiries": inquiries,
	})
}

func (h *InquiryHandler) DeleteInquiry(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Inquiry ID is required"})
		return
	}

	if err := h.Service.DeleteInquiry(c.Request.Context(), id); err != nil {
		log.Error().Err(err).Str("inquiryID", id).Msg("Failed to delete inquiry")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to delete inquiry"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Inquiry deleted successfully"})
}