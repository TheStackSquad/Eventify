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
	repowebhook "github.com/eventify/backend/pkg/repository/webhook"

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
// webhookBase is all that is read from every Paystack webhook: enough to route it and to index the stored copy.
type webhookBase struct {
	Event string `json:"event"`
	Data  struct {
		Reference string      `json:"reference"`
		Metadata  interface{} `json:"metadata"`
	} `json:"data"`
}

type webhookDone func(status, detail string)

// HandlePaystackWebhook is the single Paystack webhook endpoint for orders and subscriptions.
//
//	bad or missing signature           -> 401, nothing stored
//	signed, but we cannot store it      -> 500, Paystack retries
//	signed, unreadable or failed        -> 500 and a CRITICAL log, body kept, Paystack retries
//	signed, reference unknown to us     -> 200, kept as an orphan
//	signed and handled (or ignorable)   -> 200
func (h *OrderHandler) HandlePaystackWebhook(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Failed to read request body"})
		return
	}
	signature := c.GetHeader("X-Paystack-Signature") // header lookup ignores case
	if !h.OrderService.VerifyWebhookSignature(body, signature) {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid signature"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	var base webhookBase
	parseErr := json.Unmarshal(body, &base)

	var entry repowebhook.Entry
	if h.Inbox != nil {
		if entry, err = h.Inbox.Store(ctx, "paystack", base.Event, base.Data.Reference, body); err != nil {
			log.Error().Err(err).Msg("CRITICAL: could not store a signed webhook; Paystack will retry")
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "temporary failure"})
			return
		}
	}
	done := func(status, detail string) {
		if h.Inbox == nil {
			return
		}
		if err := h.Inbox.Mark(ctx, entry.ID, status, detail); err != nil {
			log.Error().Err(err).Int64("inbox_id", entry.ID).Msg("could not record the webhook outcome")
		}
	}

	if parseErr != nil {
		done(repowebhook.StatusFailed, "unreadable body: "+parseErr.Error())
		log.Error().Err(parseErr).Msg("CRITICAL: a signed webhook could not be read; Paystack will retry")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "temporary failure"})
		return
	}
	if isSubscriptionWebhook(base.Data.Metadata) {
		h.handleSubscriptionWebhook(ctx, c, base, body, signature, done)
		return
	}
	h.handleOrderWebhook(ctx, c, base, body, signature, done)
}

func (h *OrderHandler) handleSubscriptionWebhook(ctx context.Context, c *gin.Context, base webhookBase, body []byte, signature string, done webhookDone) {
	if h.SubscriptionService == nil {
		done(repowebhook.StatusFailed, "subscription service not configured")
		log.Error().Msg("CRITICAL: SubscriptionService is not injected into OrderHandler")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Handler configuration error"})
		return
	}
	err := h.SubscriptionService.HandleWebhook(ctx, body, signature)
	switch {
	case err == nil && base.Event != "charge.success":
		done(repowebhook.StatusIgnored, "event "+base.Event)
		c.JSON(http.StatusOK, gin.H{"status": "success", "type": "subscription"})
	case err == nil:
		done(repowebhook.StatusProcessed, "")
		c.JSON(http.StatusOK, gin.H{"status": "success", "type": "subscription"})
	case errors.Is(err, servicesubscription.ErrPaymentNotOwned):
		done(repowebhook.StatusOrphan, err.Error())
		log.Warn().Str("reference", base.Data.Reference).Msg("Webhook for a reference this system does not know; kept as an orphan")
		c.JSON(http.StatusOK, gin.H{"status": "error", "message": "acknowledged"})
	case servicesubscription.IsRetryable(err):
		done(repowebhook.StatusFailed, err.Error())
		log.Error().Err(err).Str("reference", base.Data.Reference).Msg("CRITICAL: subscription webhook failed; Paystack will retry")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "temporary failure"})
	default:
		done(repowebhook.StatusIgnored, err.Error())
		log.Warn().Err(err).Str("reference", base.Data.Reference).Msg("Subscription webhook not actionable; acknowledged")
		c.JSON(http.StatusOK, gin.H{"status": "error", "message": "acknowledged"})
	}
}

func (h *OrderHandler) handleOrderWebhook(ctx context.Context, c *gin.Context, base webhookBase, body []byte, signature string, done webhookDone) {
	var webhook models.PaystackWebhook
	if err := json.Unmarshal(body, &webhook); err != nil {
		done(repowebhook.StatusFailed, "unreadable order webhook: "+err.Error())
		log.Error().Err(err).Str("reference", base.Data.Reference).Msg("CRITICAL: a signed order webhook could not be read; Paystack will retry")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "temporary failure"})
		return
	}
	err := h.OrderService.ProcessWebhook(ctx, &webhook, signature)
	switch {
	case err == nil:
		done(repowebhook.StatusProcessed, "")
		c.JSON(http.StatusOK, gin.H{"status": "success", "type": "order"})
	case serviceorder.IsRetryable(err):
		done(repowebhook.StatusFailed, err.Error())
		log.Error().Err(err).Str("reference", base.Data.Reference).Msg("CRITICAL: order webhook failed; Paystack will retry")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "temporary failure"})
	default:
		// Next step (D4): an order reference this system does not know is tried against the subscription
		// ledger, and becomes an orphan if neither knows it. That needs the order service's "not found" error.
		done(repowebhook.StatusIgnored, err.Error())
		log.Warn().Err(err).Str("reference", base.Data.Reference).Msg("Order webhook not actionable; acknowledged")
		c.JSON(http.StatusOK, gin.H{"status": "error", "message": "acknowledged"})
	}
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
