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

// HandlePaystackWebhook handles notifications from Paystack
func (h *OrderHandler) HandlePaystackWebhook(c *gin.Context) {
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid body"})
		return
	}

	signature := c.GetHeader("x-paystack-signature")

	if !h.OrderService.VerifyWebhookSignature(bodyBytes, signature) {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid signature"})
		return
	}

	var webhook models.PaystackWebhook
	if err := json.Unmarshal(bodyBytes, &webhook); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Parse error"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	if err := h.OrderService.ProcessWebhook(ctx, &webhook, signature); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "error", "message": "Processing failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}