//backend/pkg/handlers/order.go
package handlers

import (
	"context"
	"net/http"
	"time"
	//"fmt"
	//"os"
	"errors"
	"strings"
	
	"github.com/eventify/backend/pkg/models"
	repoevent "github.com/eventify/backend/pkg/repository/event"
    serviceorder "github.com/eventify/backend/pkg/services/order"
	servicesubscription "github.com/eventify/backend/pkg/services/subscription"
	repowebhook "github.com/eventify/backend/pkg/repository/webhook"

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
	OrderService        serviceorder.OrderService
	SubscriptionService servicesubscription.SubscriptionService
	Inbox               repowebhook.Inbox // raw webhook store; set with WithInbox
}

// WithInbox sets the webhook store. main.go always sets it; tests may leave it nil.
func (h *OrderHandler) WithInbox(in repowebhook.Inbox) *OrderHandler {
	h.Inbox = in
	return h
}

// Update the constructor to accept and assign it
func NewOrderHandler(
	orderService serviceorder.OrderService,
	subscriptionService servicesubscription.SubscriptionService,
) *OrderHandler {
	return &OrderHandler{
		OrderService:        orderService,
		SubscriptionService: subscriptionService,
	}
}


func (h *OrderHandler) InitializeOrder(c *gin.Context) {
	var req models.OrderInitializationRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Error().Err(err).Msg("400 Bad Request: Invalid order payload")
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid request format: " + err.Error()})
		return
	}

	// Optional Idempotency-Key header: a retry with the same key returns the original order instead of reserving stock again (F207).
	if key := strings.TrimSpace(c.GetHeader("Idempotency-Key")); key != "" {
		if !models.ValidIdempotencyKey(key) {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "code": "INVALID_IDEMPOTENCY_KEY", "message": "Idempotency-Key must be 8 to 128 characters: letters, digits, - _ . or :"})
			return
		}
		req.IdempotencyKey = key
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
	ctx, cancel := context.WithTimeout(c.Request.Context(), 12*time.Second)
	defer cancel()

	// NOTE: We expect InitializePendingOrder to now return the Order AND the Paystack Auth URL
	order, authURL, err := h.OrderService.InitializePendingOrder(ctx, &req, userID, guestID)

	if err != nil {
		status, code, msg := http.StatusInternalServerError, "ORDER_FAILED", "Failed to initialize order"
		switch {
		case errors.Is(err, serviceorder.ErrInvalidOrder):
			status, code, msg = http.StatusBadRequest, "INVALID_ORDER", err.Error()
		case errors.Is(err, serviceorder.ErrIdempotencyInProgress):
			c.Header("Retry-After", "1")
			status, code, msg = http.StatusConflict, "REQUEST_IN_PROGRESS", "This request is still being processed. Please retry in a moment."
		case errors.Is(err, serviceorder.ErrIdempotencyKeyReused):
			status, code, msg = http.StatusUnprocessableEntity, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used for a different request."
		case errors.Is(err, serviceorder.ErrFreeOrderUnsupported):
			status, code, msg = http.StatusBadRequest, "FREE_TICKETS_UNSUPPORTED", "Free tickets are not available for online checkout yet."
		case errors.Is(err, repoevent.ErrNotEnoughStock):
			status, code, msg = http.StatusConflict, "SOLD_OUT", "One or more items are sold out or have insufficient stock."
		case errors.Is(err, repoevent.ErrTierUnavailable):
			status, code, msg = http.StatusNotFound, "TICKET_UNAVAILABLE", "This ticket type is no longer available."
		case errors.Is(err, serviceorder.ErrCheckoutBusy):
			c.Header("Retry-After", "2")
			status, code, msg = http.StatusServiceUnavailable, "CHECKOUT_BUSY", "We are very busy right now. Please try again in a moment."
		case errors.Is(err, serviceorder.ErrPaymentGatewayUnavailable):
			c.Header("Retry-After", "5")
			status, code, msg = http.StatusServiceUnavailable, "PAYMENT_UNAVAILABLE", "Payment service is temporarily unavailable. You have not been charged."
		}
		ev := log.Warn()
		if status == http.StatusInternalServerError {
			ev = log.Error()
		}
		ev.Err(err).Str("code", code).Msg("Order initialization failed")
		c.JSON(status, gin.H{"status": "error", "code": code, "message": msg})
		return
	}

	// 3. Return the payload for the frontend to redirect
	replyStatus := http.StatusCreated
	if order.Replayed {
		c.Header("Idempotent-Replay", "true")
		replyStatus = http.StatusOK
	}
	c.JSON(replyStatus, gin.H{
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


