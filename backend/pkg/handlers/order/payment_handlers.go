//backend/pkg/handlers/payment/payment_handlers.go
package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"
	"errors"

	"github.com/eventify/backend/pkg/models"
    serviceorder "github.com/eventify/backend/pkg/services/order"
	servicesubscription "github.com/eventify/backend/pkg/services/subscription"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// VerifyPayment handles client-initiated payment verification
// VerifyPayment handles payment verification for both initial verification and retries
func (h *OrderHandler) VerifyPayment(c *gin.Context) {
	reference := c.Param("reference")
	if reference == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Payment reference is required"})
		return
	}

	guestID, _ := c.Cookie("guest_id")
	order, err := h.OrderService.VerifyAndProcess(c.Request.Context(), reference, guestID)

	if err != nil {
		status, code, msg := http.StatusPaymentRequired, "VERIFY_FAILED", "Payment verification failed"
		switch {
		case errors.Is(err, serviceorder.ErrOrderNotFound):
			status, code, msg = http.StatusNotFound, "ORDER_NOT_FOUND", "Order not found"
		case errors.Is(err, serviceorder.ErrAmountMismatch):
			status, code, msg = http.StatusConflict, "AMOUNT_MISMATCH", "Payment amount does not match the order"
		case errors.Is(err, serviceorder.ErrOrderNotFulfilled):
			status, code, msg = http.StatusConflict, "PAID_NOT_FULFILLED", "Payment received but this order could not be completed. Please contact support with your reference."
		case errors.Is(err, serviceorder.ErrPaymentNotCompleted):
			status, code, msg = http.StatusPaymentRequired, "PAYMENT_PENDING", "Payment has not been completed yet"
		}

		ev := log.Warn()
		if code == "VERIFY_FAILED" {
			ev = log.Error()
		}
		ev.Err(err).Str("ref", reference).Str("code", code).Msg("Verification failed")

		c.JSON(status, gin.H{"status": "error", "code": code, "message": "Payment verification failed", "error": msg})
		return
	}

	log.Info().Str("ref", reference).Str("status", string(order.Status)).Msg("Payment verification successful")
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Payment verified successfully", "data": order})
}

// HandlePaystackWebhook handles notifications from Paystack for both Orders and Subscriptions
func (h *OrderHandler) HandlePaystackWebhook(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)
	
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Failed to read request body"})
		return
	}

	signature := c.GetHeader("x-paystack-signature")
	if signature == "" {
		signature = c.GetHeader("X-Paystack-Signature") // Fallback for header casing
	}

	// 1. Verify signature using order service (or a shared cryptographic helper)
	if !h.OrderService.VerifyWebhookSignature(bodyBytes, signature) {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid signature"})
		return
	}

	// 2. Parse general event structure to check metadata or event type
	var baseEvent struct {
		Event string `json:"event"`
		Data  struct {
			Metadata interface{} `json:"metadata"`
		} `json:"data"`
	}

	if err := json.Unmarshal(bodyBytes, &baseEvent); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Parse error"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	// 3. Dispatch based on metadata or event content
	// If metadata contains subscription_id, route to subscription service!
	// 3. Dispatch based on metadata or event content
	// If metadata contains subscription_id, route to subscription service!
	if isSubscriptionWebhook(baseEvent.Data.Metadata) {
		if h.SubscriptionService == nil {
			log.Error().Msg("SubscriptionService is not injected into OrderHandler")
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Handler configuration error"})
			return
		}

		if err := h.SubscriptionService.HandleWebhook(ctx, bodyBytes, signature); err != nil {
			if servicesubscription.IsRetryable(err) {
				log.Error().Err(err).Msg("Subscription webhook failed; Paystack will retry")
				c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "temporary failure"})
				return
			}
			log.Warn().Err(err).Msg("Subscription webhook not actionable; acknowledged")
			c.JSON(http.StatusOK, gin.H{"status": "error", "message": "acknowledged"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "success", "type": "subscription"})
		return
	}

	// 4. Otherwise, fallback to standard Order processing
	var webhook models.PaystackWebhook
	if err := json.Unmarshal(bodyBytes, &webhook); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Parse error"})
		return
	}

	if err := h.OrderService.ProcessWebhook(ctx, &webhook, signature); err != nil {
		if serviceorder.IsRetryable(err) {
			log.Error().Err(err).Msg("Order webhook failed; Paystack will retry")
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "temporary failure"})
			return
		}
		log.Warn().Err(err).Msg("Order webhook not actionable; acknowledged")
		c.JSON(http.StatusOK, gin.H{"status": "error", "message": "acknowledged"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "type": "order"})
}
// Helper to check if metadata belongs to a subscription
func isSubscriptionWebhook(metadata interface{}) bool {
	m, ok := metadata.(map[string]interface{})
	if !ok {
		return false
	}
	if t, _ := m["payment_type"].(string); t == "subscription" {
		return true
	}
	_, legacy := m["subscription_id"] // payments initiated before the ledger
	return legacy
}
