//backend/pkg/services/subscription/subscription_payment.go

package subscription

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	//"os"
	"time"

	"github.com/eventify/backend/pkg/models"
	reposub "github.com/eventify/backend/pkg/repository/subscription"
	"github.com/eventify/backend/pkg/services/paystack"
	"github.com/eventify/backend/pkg/utils"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (s *subscriptionServiceImpl) InitiateSubscription(ctx context.Context, vendorID uuid.UUID, req models.InitiateSubRequest) (*InitiateResponse, error) {
	// 1. Tier and price: pure logic, no I/O.
	if req.Tier == models.TierFree {
		return nil, ErrFreeTier
	}
	priceKobo, ok := models.PriceKobo(req.Tier)
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrInvalidTier, req.Tier)
	}

	// 2. R2: an active vendor may only renew the tier they already hold.
	active, err := s.subscriptionRepo.GetActiveByVendorID(ctx, vendorID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing subscription: %w", err)
	}
	if active != nil && active.Tier != req.Tier {
		return nil, fmt.Errorf("%w (current plan: %s)", ErrActiveDifferentTier, active.Tier)
	}

	// 3. Vendor and owner (Paystack needs an email).
	vendor, err := s.vendorRepo.GetByID(ctx, vendorID)
	if err != nil {
		return nil, fmt.Errorf("vendor profile not found: %w", err)
	}
	user, err := s.authRepo.GetUserByID(ctx, vendor.OwnerID)
	if err != nil {
		return nil, fmt.Errorf("user authentication failed: %w", err)
	}

	// 4. Ledger first: no payment link may exist without a record of it.
	reference := uuid.NewString()
	payment := &models.SubscriptionPayment{
		Reference:  reference, 
		VendorID:   vendorID, 
		Tier:       req.Tier,
		AmountKobo: priceKobo, 
		Currency:   "NGN",
	}
	if err := s.subscriptionRepo.CreatePayment(ctx, payment); err != nil {
		log.Error().Err(err).Str("vendorID", vendorID.String()).Msg("Ledger insert failed; not contacting Paystack")
		return nil, fmt.Errorf("failed to record payment intent: %w", err)
	}

	// 5. Paystack.
	feURL, err := utils.FrontendBaseURL()
	if err != nil {
		return nil, fmt.Errorf("subscription payment callback URL: %w", err)
	}
	callback := fmt.Sprintf("%s/subscription/callback", feURL)

	metadata := map[string]string{
		"payment_type": "subscription",
		"vendor_id":    vendorID.String(),
		"tier":         string(req.Tier),
	}
	authURL, err := s.paystack.InitializeTransaction(ctx, user.Email, priceKobo, reference, metadata, callback)
	if err != nil {
		log.Error().Err(err).Str("reference", reference).Msg("Paystack initialization failed")
		if mErr := s.subscriptionRepo.MarkPaymentFailed(ctx, reference, "gateway initialize failed"); mErr != nil {
			log.Warn().Err(mErr).Str("reference", reference).Msg("Could not mark ledger row failed")
		}
		return nil, ErrGatewayUnavailable
	}

	return &InitiateResponse{
		Reference:        reference, 
		AuthorizationURL: authURL,
		Tier:             string(req.Tier), 
		AmountKobo:       priceKobo,
	}, nil
}

// VerifyAndFinalize is the vendor-initiated confirmation (the redirect page).
func (s *subscriptionServiceImpl) VerifyAndFinalize(ctx context.Context, reference string, vendorID uuid.UUID) error {
	payment, err := s.subscriptionRepo.GetPaymentByReference(ctx, reference)
	switch {
	case errors.Is(err, reposub.ErrPaymentNotFound):
		return ErrPaymentNotOwned // an unknown reference looks the same as someone else's
	case err != nil:
		return fmt.Errorf("load payment: %w", err)
	case payment.VendorID != vendorID:
		return ErrPaymentNotOwned
	}
	return s.settle(ctx, reference)
}

// settle asks Paystack what really happened, then applies it exactly once through the
// ledger. Paid amount and currency come from Paystack, never from our own records, so
// the repository's comparison against the expected price is a real check.
func (s *subscriptionServiceImpl) settle(ctx context.Context, reference string) error {
	ps, err := s.paystack.VerifyTransaction(ctx, reference)
	if err != nil {
		return fmt.Errorf("paystack verify: %w", err)
	}
	// ps.Status only says the API call worked. The payment itself is ps.Data.Status.
	if !ps.Status || ps.Data == nil || ps.Data.Status != "success" {
		return ErrPaymentNotSuccessful
	}

	now := time.Now().UTC()
	outcome, err := s.subscriptionRepo.SettlePayment(ctx, reposub.SettleInput{
		Reference:      reference,
		PaidAmountKobo: int64(ps.Data.Amount),
		PaidCurrency:   ps.Data.Currency,
		Channel:        ps.Data.Channel,
		PaidAt:         parsePaidAt(ps.Data.PaidAt, now),
		Now:            now,
	})
	if err != nil {
		return fmt.Errorf("settle payment: %w", err)
	}

	switch outcome {
	case reposub.SettleNeedsReview:
		log.Error().Str("reference", reference).Msg("🚨 PAYMENT HELD FOR MANUAL REVIEW")
		return ErrPaymentNeedsReview
	case reposub.SettleAlreadyApplied:
		log.Info().Str("reference", reference).Msg("Payment already applied; nothing to do")
	default:
		log.Info().Str("reference", reference).Msg("🎊 Subscription payment applied")
	}
	return nil
}

func parsePaidAt(s string, fallback time.Time) time.Time {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t.UTC()
	}
	return fallback
}

func (s *subscriptionServiceImpl) HandleWebhook(ctx context.Context, body []byte, signature string) error {
	if !paystack.VerifyWebhookSignature(body, signature, s.webhookSecret) {
		log.Error().Msg("🚨 Webhook: Invalid signature received")
		return ErrInvalidSignature
	}

	var payload struct {
		Event string              `json:"event"`
		Data  models.PaystackData `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return fmt.Errorf("%w: %v", ErrBadWebhookPayload, err)
	}
	if payload.Event != "charge.success" {
		log.Debug().Str("event", payload.Event).Msg("Skipping non-success event")
		return nil
	}

	ref := payload.Data.Reference
	log.Info().Str("ref", ref).Msg("💰 Webhook: Processing charge.success")

	if err := s.subscriptionRepo.IncrementWebhookAttempts(ctx, ref); err != nil {
		log.Warn().Err(err).Str("ref", ref).Msg("Could not increment webhook attempts")
	}

	// The vendor comes from the ledger, never from webhook metadata.
	if _, err := s.subscriptionRepo.GetPaymentByReference(ctx, ref); err != nil {
		if errors.Is(err, reposub.ErrPaymentNotFound) {
			return fmt.Errorf("%w: reference %s", ErrPaymentNotOwned, ref)
		}
		return fmt.Errorf("load payment: %w", err)
	}
	return s.settle(ctx, ref)
}