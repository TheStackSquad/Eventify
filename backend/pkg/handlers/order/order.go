//backend/pkg/handlers/order.go
package handlers

import (
	"context"
	"net/http"
	"time"
	//"fmt"
	//"os"
	"strings"
	
	"eventify/backend/pkg/models"
     serviceorder "eventify/backend/pkg/services/order"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// TierDetails contains pricing and availability info for order processing
type TierDetails struct {
	EventID      uuid.UUID `db:"event_id"`
	EventTitle   string    `db:"event_title"`
	TicketTierID uuid.UUID `db:"ticket_tier_id"`
	TierName     string    `db:"tier_name"`
	PriceKobo    int32     `db:"price_kobo"`
	TotalStock   int32     `db:"total_stock"`
	SoldCount    int32     `db:"sold_count"`
	Available    int32     `db:"available"`
}

type OrderHandler struct {
	OrderService serviceorder.OrderService
}

func NewOrderHandler(orderService serviceorder.OrderService) *OrderHandler {
	return &OrderHandler{
		OrderService: orderService,
	}
}


func (h *OrderHandler) InitializeOrder(c *gin.Context) {
	var req models.OrderInitializationRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Error().Err(err).Msg("400 Bad Request: Invalid order payload")
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid request format: " + err.Error()})
		return
	}

	// 1. Extract Identity consistently
	var userID *uuid.UUID
	if val, exists := c.Get("user_id"); exists {
		if u, ok := val.(uuid.UUID); ok {
			userID = &u
		}
	}

	// Try context first (from middleware), fallback to cookie for validation
	guestIDVal, exists := c.Get("guest_id")
	guestID := ""
	if exists {
		guestID = guestIDVal.(string)
	} else {
		guestID, _ = c.Cookie("guest_id")
	}

	if userID == nil && guestID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Identity could not be established."})
		return
	}

	// 2. Initialize Order via Service
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	// NOTE: We expect InitializePendingOrder to now return the Order AND the Paystack Auth URL
	order, authURL, err := h.OrderService.InitializePendingOrder(ctx, &req, userID, guestID)

	if err != nil {
		log.Error().Err(err).Msg("Order initialization failed")
		
		// Handle Sold Out / Stock issues with 409 Conflict
		if strings.Contains(strings.ToLower(err.Error()), "stock") || 
		   strings.Contains(strings.ToLower(err.Error()), "available") {
			c.JSON(http.StatusConflict, gin.H{
				"status": "error", 
				"message": "One or more items are sold out or have insufficient stock.",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to initialize order"})
		return
	}

	// 3. Return the payload for the frontend to redirect
	c.JSON(http.StatusCreated, gin.H{
		"status": "success",
		"data": gin.H{
			"reference":         order.Reference,
			"order_id":          order.ID.String(),
			"amount_kobo":       order.FinalTotal,
			"authorization_url": authURL, // The frontend will use window.location.href = authURL
		},
	})
}

func (h *OrderHandler) GetOrderByReference(c *gin.Context) {
	reference := c.Param("reference")
	if reference == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Reference is required"})
		return
	}
	guestID, _ := c.Cookie("guest_id")
	var userID *uuid.UUID
	if val, exists := c.Get("user_id"); exists {
		if id, ok := val.(uuid.UUID); ok {
			userID = &id
		}
	}
	order, err := h.OrderService.GetOrderByReference(c.Request.Context(), reference, userID, guestID)
	if err != nil {
		if err.Error() == "unauthorized access to order" {
			log.Warn().Str("ref", reference).Str("guest_id", guestID).Msg("Unauthorized order access attempt")
			c.JSON(http.StatusForbidden, gin.H{
				"status":  "error",
				"message": "You do not have permission to view this order",
			})
			return
		}
		log.Error().Err(err).Str("reference", reference).Msg("Failed to retrieve order")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Internal server error"})
		return
	}
	if order == nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Order not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   order,
	})
}