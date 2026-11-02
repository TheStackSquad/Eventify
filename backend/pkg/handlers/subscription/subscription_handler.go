// backend/pkg/handlers/subscription/subscription_handler.go
package handlers

import (
	//"io"
	"net/http"
	"strings"
	"regexp"
	"errors"
	"github.com/eventify/backend/pkg/services/subscription"

	"github.com/eventify/backend/pkg/middleware"
	"github.com/eventify/backend/pkg/models"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	servicesubscription "github.com/eventify/backend/pkg/services/subscription"
	reposub "github.com/eventify/backend/pkg/repository/subscription"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

var validReferenceRegex = regexp.MustCompile(`^[a-zA-Z0-9_\-\.]{1,128}$`)

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
		Str("reference", resp.Reference).
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

	// 🛡️ Defend against hostile or malformed reference strings
    if !validReferenceRegex.MatchString(reference) {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction reference format"})
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
            log.Warn().Err(err).Str("reference", reference).Msg("Verification failed gracefully")

            msg := err.Error()
            
            // 1. Handle cross-vendor or missing reference (T8.1)
            if strings.Contains(msg, "not found") || strings.Contains(msg, "no rows") || strings.Contains(msg, "unauthorized") {
                c.JSON(http.StatusNotFound, gin.H{"status": "error", "code": "PAYMENT_NOT_FOUND", "message": "Transaction reference not found"})
                return
            }
            
            // 2. Handle unpaid / unsuccessful transactions (T9.4)
            if strings.Contains(msg, "not successful") || strings.Contains(msg, "pending") || strings.Contains(msg, "failed") {
                c.JSON(http.StatusUnprocessableEntity, gin.H{"status": "error", "code": "PAYMENT_NOT_SUCCESSFUL", "message": "The transaction has not been successfully completed."})
                return
            }

            // Fallback for general client validation errors
            c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid transaction reference"})
            return
        }
	log.Info().
		Str("vendorID", vendorID.String()).
		Str("reference", reference).
		Msg("Subscription verified and activated")

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Subscription activated"})
}

// respondVerifyError maps typed errors to codes the frontend can act on. An error we do not recognise
// never tells a customer their payment failed: it says we could not confirm yet, and 503 lets the page retry.
func respondVerifyError(c *gin.Context, err error, reference string) {
	log.Warn().Err(err).Str("reference", reference).Msg("Verification did not complete")
	status, code, msg := http.StatusServiceUnavailable, "VERIFICATION_UNAVAILABLE",
		"We could not confirm your payment right now. If you were charged, your plan activates automatically."
	switch {
	case errors.Is(err, servicesubscription.ErrPaymentNotOwned), errors.Is(err, reposub.ErrPaymentNotFound):
		status, code, msg = http.StatusNotFound, "PAYMENT_NOT_FOUND", "Transaction reference not found"
	case errors.Is(err, servicesubscription.ErrPaymentNotSuccessful):
		status, code, msg = http.StatusUnprocessableEntity, "PAYMENT_NOT_SUCCESSFUL", "The transaction has not been successfully completed."
	case errors.Is(err, servicesubscription.ErrPaymentNeedsReview):
		status, code, msg = http.StatusConflict, "PAYMENT_UNDER_REVIEW", "Your payment was received and is being reviewed by our team. You do not need to pay again."
	}
	c.JSON(status, gin.H{"status": "error", "code": code, "message": msg})
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

// handleServiceError processes service layer errors and maps them to clean HTTP responses
func handleServiceError(c *gin.Context, err error, vID string) {
	log.Error().Err(err).Str("vendorID", vID).Msg("Service Error encountered")

	// 1. Check for idiomatic sentinel errors first (cleanest Go pattern)
	switch {
	case errors.Is(err, subscription.ErrFreeTier) || errors.Is(err, subscription.ErrInvalidTier):
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return

	case errors.Is(err, subscription.ErrActiveDifferentTier):
		c.JSON(http.StatusConflict, gin.H{
			"status":  "error",
			"code":    "ACTIVE_PLAN_EXISTS", // 👈 Added here so it matches immediately
			"message": err.Error(),
			"action":  "cancel_existing_or_wait",
		})
		return

	case errors.Is(err, subscription.ErrGatewayUnavailable):
		// 🛡️ Map Paystack / gateway outages to 502 Bad Gateway instead of 500 crash
		c.JSON(http.StatusBadGateway, gin.H{"status": "error", "message": "Payment gateway currently unavailable"})
		return
	}

	// 2. Fallback to string matching for wrapped or dynamic errors
	msg := err.Error()
	switch {
	case strings.Contains(msg, "already have an active") || strings.Contains(msg, "already has an active"):
		c.JSON(http.StatusConflict, gin.H{
			"status":  "error",
			"code":    "ACTIVE_PLAN_EXISTS", // 👈 Also include here for string-matched variants
			"message": msg,
			"action":  "cancel_existing_or_wait",
		})

	case strings.Contains(msg, "cannot subscribe to") ||
		strings.HasPrefix(msg, "invalid subscription tier") ||
		strings.Contains(msg, "no email on file"):
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": msg})

	default:
		// Catch-all for unhandled internal failures -> returns 500 safely
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Internal server error"})
	}
}
// GetPlans: GET /api/v1/subscription/plans (public)
func (h *SubscriptionHandler) GetPlans(c *gin.Context) {
	c.Header("Cache-Control", "public, max-age=300")
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": models.GetPlans()})
}