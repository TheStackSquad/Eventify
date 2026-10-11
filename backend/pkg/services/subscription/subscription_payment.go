//backend/pkg/services/subscription/subscription_payment.go

package subscription

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/eventify/backend/pkg/models"
	reposub "github.com/eventify/backend/pkg/repository/subscription"
	"github.com/eventify/backend/pkg/services/paystack"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (s *subscriptionServiceImpl) InitiateSubscription(ctx context.Context, vendorID uuid.UUID, req models.InitiateSubRequest) (*InitiateResponse, error) {
    // 1. INPUT VALIDATION (Move this up - don't hit DB for invalid inputs)
    if req.Tier == models.TierFree {
        return nil, fmt.Errorf("cannot subscribe to free tier via payment gateway")
    }

    // 2. CHECK EXISTING ACTIVE (Fail-Fast)
    existingActive, err := s.subscriptionRepo.GetActiveByVendorID(ctx, vendorID)
    if err != nil {
        return nil, fmt.Errorf("failed to check existing subscription: %w", err)
    }
    if existingActive != nil {
        return nil, fmt.Errorf("you already have an active %s subscription", existingActive.Tier)
    }

    // 3. FETCH VENDOR & USER (Necessary for the email)
    vendor, err := s.vendorRepo.GetByID(ctx, vendorID)
    if err != nil {
        return nil, fmt.Errorf("vendor profile not found")
    }

    user, err := s.authRepo.GetUserByID(ctx, vendor.OwnerID)
    if err != nil {
        return nil, fmt.Errorf("user authentication failed")
    }

    // 4. PREPARE PRICING
    pricing := models.GetPricing(req.Tier)
    subID := uuid.New()

    // 5. INITIALIZE PAYSTACK FIRST (Optional but recommended)
    frontendURL := os.Getenv("FRONTEND_URL")
    callback := fmt.Sprintf("%s/subscription/callback", frontendURL)
    metadata := map[string]string{
        "subscription_id": subID.String(), 
        "vendor_id":       vendorID.String(),
    }

    // We use the subID as the reference to Paystack
    authURL, err := s.paystack.InitializeTransaction(ctx, user.Email, pricing.MaxKobo, subID.String(), metadata, callback)
    if err != nil {
        log.Error().Err(err).Msg("❌ Paystack: Initialization failed")
        return nil, fmt.Errorf("payment gateway unavailable")
    }

    // 6. SAVE TO DB
    sub := &models.Subscription{
        ID:        subID,
        VendorID:  vendorID,
        Tier:      req.Tier,
        Status:    models.SubStatusPending,
        StartsAt:  time.Now().UTC(),
        AutoRenew: req.AutoRenew,
        Price:     pricing.MaxKobo,
        Currency:  "NGN",
    }

    if _, err := s.subscriptionRepo.Create(ctx, sub); err != nil {
        log.Error().Err(err).Msg("❌ DB: Failed to create pending sub after Paystack success")
        // This is a rare edge case: Paystack link exists but DB failed.
        return nil, fmt.Errorf("failed to initialize subscription record")
    }

    return &InitiateResponse{
        SubscriptionID:   sub.ID,
        AuthorizationURL: authURL,
        Reference:        sub.ID.String(),
        Tier:             string(req.Tier),
        AmountKobo:       sub.Price,
    }, nil
}

func (s *subscriptionServiceImpl) VerifyAndFinalize(ctx context.Context, reference string, vendorID uuid.UUID) error {
    log.Info().Str("ref", reference).Msg("🔄 Verification started")

    // Step 1: Verify payment with Paystack
    payment, err := s.paystack.VerifyTransaction(ctx, reference)
    if err != nil {
        log.Error().Err(err).Msg("❌ Paystack: Verification call failed")
        return err
    }

    // Guard: Check Paystack response status
    if !payment.Status || payment.Data.Status != "success" {
        log.Warn().Str("ref", reference).Msg("⚠️ Payment not successful")
        return fmt.Errorf("payment was not successful")
    }

    // Step 2: Extract subscription ID from metadata
    metadata, ok := payment.Data.Metadata.(map[string]interface{})
    if !ok {
        return fmt.Errorf("failed to parse payment metadata")
    }

    subIDStr, ok := metadata["subscription_id"].(string)
    if !ok {
        return fmt.Errorf("subscription_id missing in payment metadata")
    }

    subID, err := uuid.Parse(subIDStr)
    if err != nil {
        return fmt.Errorf("invalid subscription uuid in metadata: %w", err)
    }

    // Step 3: Fetch subscription record to validate amount
    sub, err := s.subscriptionRepo.GetByID(ctx, subID)
    if err != nil {
        return fmt.Errorf("failed to fetch subscription: %w", err)
    }

    // Step 4: Idempotency guard - check if already processed
    if sub.Status != models.SubStatusPending {
        log.Info().Str("subID", subID.String()).Msg("✓ Subscription already processed; skipping.")
        return nil 
    }

    // Step 5: CRITICAL - Validate payment amount matches expected price
    if int64(payment.Data.Amount) != sub.Price {
        log.Error().
            Int64("expected_kobo", sub.Price).
            Int64("received_kobo", int64(payment.Data.Amount)).
            Str("subID", subID.String()).
            Msg("🚨 FRAUD ALERT: Payment amount mismatch")
        
        // Mark as cancelled to prevent activation with wrong amount
        _ = s.subscriptionRepo.UpdateStatus(ctx, subID, models.SubStatusCancelled)
        return fmt.Errorf("payment amount (%d) does not match subscription price (%d)", int64(payment.Data.Amount), sub.Price)
    }

    // Step 6: Prepare update parameters for atomic operation
    now := time.Now().UTC()
    expiry := now.AddDate(0, 1, 0) // Monthly subscription cycle
    
    params := reposub.PaymentUpdateParams{
        Status:           models.SubStatusActive,
        PaymentReference: reference,
        PaymentMethod:    payment.Data.Authorization.Channel, 
        LastPaymentDate:  now,
        NextPaymentDate:  expiry,
        ExpiresAt:        expiry,
    }

    // Step 7: Atomic DB update (subscription + vendor tier sync in transaction)
    if err := s.subscriptionRepo.UpdateAfterPayment(ctx, subID, params); err != nil {
        log.Error().Err(err).Str("subID", subID.String()).Msg("❌ DB: Atomic finalization failed")
        return err
    }

    log.Info().
        Str("vendor", vendorID.String()).
        Str("sub", subID.String()).
        Int64("amount", int64(payment.Data.Amount)).
        Msg("🎊 Subscription activated successfully")

    return nil
}

func (s *subscriptionServiceImpl) HandleWebhook(ctx context.Context, body []byte, signature string) error {
	// 1. Signature Verification (Security)
	if !paystack.VerifyWebhookSignature(body, signature, s.webhookSecret) {
		log.Error().Msg("🚨 Webhook: Invalid signature received")
		return fmt.Errorf("invalid signature")
	}

	var payload struct {
		Event string               `json:"event"`
		Data  models.PaystackData  `json:"data"` // Use your existing model
	}
	
	if err := json.Unmarshal(body, &payload); err != nil {
		return fmt.Errorf("unmarshal webhook: %w", err)
	}

	// 2. Filter for success events only
	if payload.Event != "charge.success" {
		log.Debug().Str("event", payload.Event).Msg("Skipping non-success event")
		return nil 
	}

	ref := payload.Data.Reference
	log.Info().Str("ref", ref).Msg("💰 Webhook: Processing charge.success")

	// 3. Log Attempt (Mirroring Order Logic)
	// We do this even before processing so we know how many times Paystack retried
	if err := s.subscriptionRepo.IncrementWebhookAttempts(ctx, ref); err != nil {
		log.Warn().Err(err).Str("ref", ref).Msg("Could not increment webhook attempts")
		// We don't return here; we still want to try and process the payment
	}

	// 4. Extract VendorID from Metadata (Crucial for the service call)
	metadata, ok := payload.Data.Metadata.(map[string]interface{})
	if !ok {
		return fmt.Errorf("webhook: metadata is invalid")
	}

	vendorIDStr, _ := metadata["vendor_id"].(string)
	vendorID, err := uuid.Parse(vendorIDStr)
	if err != nil {
		return fmt.Errorf("webhook: invalid vendor_id in metadata")
	}

	// 5. Finalize using the same Service Logic
	// This ensures consistency between manual verification and webhook verification
	return s.VerifyAndFinalize(ctx, ref, vendorID)
}