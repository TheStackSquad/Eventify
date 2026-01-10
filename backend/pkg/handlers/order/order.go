//backend/pkg/handlers/order.go
package handlers

import (
	"context"
	"net/http"
	"time"
	"fmt"
	"os"
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

	// 1. Attempt to bind JSON directly (most efficient)
	if err := c.ShouldBindJSON(&req); err != nil {
		// Log the 400 Bad Request error immediately
		// Note: Gin's binding error includes details about the expected field type/structure.
		log.Error().
			Err(err).
			Str("client_ip", c.ClientIP()).
			Msg("400 Bad Request: Failed to bind request body to OrderInitializationRequest struct")

		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid request format: " + err.Error()})
		return
	}

	// 2. Log successful request data for tracing
	log.Info().
		Str("client_ip", c.ClientIP()).
		Interface("request_data", req).
		Msg("Order Initialization request received successfully")

	// 3. Extract Identity (UserID and GuestID)
	var userID *uuid.UUID
	if val, exists := c.Get("user_id"); exists {
		if u, ok := val.(uuid.UUID); ok {
			userID = &u
		}
	}

	guestIDVal, exists := c.Get("guest_id")
	guestID := ""
	if exists {
		guestID = guestIDVal.(string)
	}

	ipAddress := c.ClientIP()

	// 4. Critical Identity Check
	if userID == nil && guestID == "" {
		log.Error().Str("ip", ipAddress).Msg("Critical Identity Failure: No User/Guest ID found.")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Identity could not be established."})
		return
	}

	// 5. Initialize Order Service Call
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	order, err := h.OrderService.InitializePendingOrder(ctx, &req, userID, guestID)

	if err != nil {
		log.Error().Err(err).Msg("Order initialization failed in service layer")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to initialize order"})
		return
	}

	// 6. Build and Return Response
	response := gin.H{
		"status": "success",
		"data": gin.H{
			"reference":   order.Reference,
			"amount_kobo": order.FinalTotal,
			"order_id":    order.ID.String(),
		},
	}

	paystackPublicKey := os.Getenv("PAYSTACK_PUBLIC_KEY")
	if paystackPublicKey != "" {
		response["data"].(gin.H)["paystack_config"] = gin.H{
			"public_key": paystackPublicKey,
			// Using os.Getenv for the domain for more flexibility
			"callback_url": fmt.Sprintf("%s/checkout/verify?ref=%s", os.Getenv("FRONTEND_BASE_URL"), order.Reference),
			"channels":     []string{"card", "bank", "ussd", "qr", "mobile_money"},
		}
	}

	c.JSON(http.StatusOK, response)
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