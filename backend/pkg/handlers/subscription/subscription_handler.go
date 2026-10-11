// backend/pkg/handlers/subscription/subscription_handler.go
package handlers

import (
	"io"
	"net/http"
	"strings"

	"github.com/eventify/backend/pkg/middleware"
	"github.com/eventify/backend/pkg/models"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	servicesubscription "github.com/eventify/backend/pkg/services/subscription"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

type SubscriptionHandler struct {
	Service    servicesubscription.SubscriptionService
	VendorRepo repovendor.VendorRepository
}

func NewSubscriptionHandler(
	service servicesubscription.SubscriptionService,
	vendorRepo repovendor.VendorRepository,
) *SubscriptionHandler {
	return &SubscriptionHandler{
		Service:    service,
		VendorRepo: vendorRepo,
	}
}

// InitiateSubscription — POST /api/subscription/initiate
func (h *SubscriptionHandler) InitiateSubscription(c *gin.Context) {
	vendorID, err := middleware.ExtractVendorID(c, h.VendorRepo)
	if err != nil {
		log.Error().Err(err).Str("endpoint", "InitiateSubscription").Msg("Failed to extract vendor ID")
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Unauthorized"})
		return
	}

	var req models.InitiateSubRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Str("vendorID", vendorID.String()).Msg("Invalid request body")
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid request body"})
		return
	}

	log.Info().
		Str("vendorID", vendorID.String()).
		Str("tier", string(req.Tier)).
		Bool("autoRenew", req.AutoRenew).
		Msg("Subscription initiation requested")

	resp, err := h.Service.InitiateSubscription(c.Request.Context(), vendorID, req)
	if err != nil {
		handleServiceError(c, err, vendorID.String())
		return
	}

	log.Info().
		Str("vendorID", vendorID.String()).
		Str("tier", string(req.Tier)).
		Str("subscriptionID", resp.SubscriptionID.String()).
		Msg("Subscription initiated successfully")

	c.JSON(http.StatusCreated, gin.H{"status": "success", "data": resp})
}

// VerifySubscription — GET /api/subscription/verify/:reference
func (h *SubscriptionHandler) VerifySubscription(c *gin.Context) {
	reference := c.Param("reference")
	if reference == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Transaction reference is required"})
		return
	}

	vendorID, err := middleware.ExtractVendorID(c, h.VendorRepo)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	log.Info().
		Str("vendorID", vendorID.String()).
		Str("reference", reference).
		Msg("Verifying subscription payment")

	if err := h.Service.VerifyAndFinalize(c.Request.Context(), reference, vendorID); err != nil {
		log.Error().Err(err).Str("reference", reference).Msg("Verification failed")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}

	log.Info().
		Str("vendorID", vendorID.String()).
		Str("reference", reference).
		Msg("Subscription verified and activated")

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Subscription activated"})
}

// HandleWebhook — POST /subscription/webhook
func (h *SubscriptionHandler) HandleWebhook(c *gin.Context) {
	log.Info().
		Str("method", c.Request.Method).
		Str("path", c.Request.URL.Path).
		Str("source_ip", c.ClientIP()).
		Msg("Webhook received")

	signature := c.GetHeader("X-Paystack-Signature")
	if signature == "" {
		log.Warn().Msg("Webhook rejected: missing signature")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing signature"})
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Error().Err(err).Msg("Failed to read webhook body")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read body"})
		return
	}

	if err := h.Service.HandleWebhook(c.Request.Context(), body, signature); err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "invalid webhook signature" || err.Error() == "invalid signature" {
    status = http.StatusUnauthorized
			log.Warn().Msg("Webhook rejected: invalid signature")
		} else {
			log.Error().Err(err).Msg("Webhook processing failed")
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	log.Info().Msg("Webhook processed successfully")
	c.Status(http.StatusOK)
}

// GetMySubscription — GET /api/subscription/me
func (h *SubscriptionHandler) GetMySubscription(c *gin.Context) {
	vendorID, err := middleware.ExtractVendorID(c, h.VendorRepo)
	if err != nil {
		log.Error().Err(err).Str("endpoint", "GetMySubscription").Msg("Failed to extract vendor ID")
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": err.Error()})
		return
	}

	log.Info().Str("vendorID", vendorID.String()).Msg("Fetching subscription")

	vendorWithSub, err := h.VendorRepo.GetVendorSubscription(c.Request.Context(), vendorID)
	if err != nil {
		log.Error().Err(err).Str("vendorID", vendorID.String()).Msg("Failed to fetch subscription")
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to fetch subscription"})
		return
	}

	subscriptionFound := vendorWithSub.Subscription != nil
	log.Debug().
		Str("vendorID", vendorID.String()).
		Bool("subscription_found", subscriptionFound).
		Msg("Subscription lookup completed")

	response := gin.H{
		"tier":     models.TierFree,
		"features": models.GetFeatures(models.TierFree),
	}

	if subscriptionFound {
		response = gin.H{
			"subscription": vendorWithSub.Subscription,
			"tier":         vendorWithSub.Subscription.Tier,
			"features":     vendorWithSub.Features,
			"isFeatured":   vendorWithSub.IsFeatured,
			"badgeColor":   vendorWithSub.BadgeColor,
		}

		log.Info().
			Str("vendorID", vendorID.String()).
			Str("tier", string(vendorWithSub.Subscription.Tier)).
			Bool("is_featured", vendorWithSub.IsFeatured).
			Msg("Active subscription found")
	} else {
		log.Info().Str("vendorID", vendorID.String()).Msg("No subscription - using free tier")
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": response})
}

// handleServiceError processes service layer errors

func handleServiceError(c *gin.Context, err error, vID string) {
	msg := err.Error()
	log.Error().Err(err).Str("vendorID", vID).Msg("Service Error")

	switch {
	case strings.Contains(msg, "already have an active"), strings.Contains(msg, "already has an active"):
		c.JSON(http.StatusConflict, gin.H{
			"status":  "error",
			"message": msg,
			"action":  "cancel_existing_or_wait",
		})
	case strings.Contains(msg, "already has"):
		c.JSON(http.StatusConflict, gin.H{"error": msg})
	case strings.Contains(msg, "cannot subscribe to"),
		strings.HasPrefix(msg, "invalid subscription tier"),
		strings.Contains(msg, "no email on file"):
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
	}
}