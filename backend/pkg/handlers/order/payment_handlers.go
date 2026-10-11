//backend/pkg/handlers/payment/payment_handlers.go
package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"
	"strings"

	"github.com/eventify/backend/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// VerifyPayment handles client-initiated payment verification
// VerifyPayment handles payment verification for both initial verification and retries
func (h *OrderHandler) VerifyPayment(c *gin.Context) {
    reference := c.Param("reference")
    if reference == "" {
        c.JSON(http.StatusBadRequest, gin.H{
            "status":  "error",
            "message": "Payment reference is required",
        })
        return
    }

    guestID, _ := c.Cookie("guest_id")
    order, err := h.OrderService.VerifyAndProcess(c.Request.Context(), reference, guestID)

    if err != nil {
        log.Error().Err(err).Str("ref", reference).Msg("Verification failed")
        
        statusCode := http.StatusPaymentRequired
        if strings.Contains(err.Error(), "not found") {
            statusCode = http.StatusNotFound
        } else if strings.Contains(err.Error(), "AmountMismatch") {
            statusCode = http.StatusConflict
        }

        c.JSON(statusCode, gin.H{
            "status":  "error",
            "message": "Payment verification failed",
            "error":   err.Error(),
        })
        return
    }

    // ✅ Success - whether newly processed or already processed
    log.Info().
        Str("ref", reference).
        Str("status", string(order.Status)).
        Msg("Payment verification successful")

    c.JSON(http.StatusOK, gin.H{
        "status":  "success",
        "message": "Payment verified successfully",
        "data":    order,
    })
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

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	if err := h.OrderService.ProcessWebhook(ctx, &webhook, signature); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "error", "message": "Processing failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}