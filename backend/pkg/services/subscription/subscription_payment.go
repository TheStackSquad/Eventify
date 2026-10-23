//backend/pkg/services/subscription/subscription_payment.go

package subscription

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"errors"
	"time"

	"github.com/eventify/backend/pkg/models"
	reposub "github.com/eventify/backend/pkg/repository/subscription"
	"github.com/eventify/backend/pkg/services/paystack"
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
		return nil, fmt.Errorf("vendor profile not found")
	}
	user, err := s.authRepo.GetUserByID(ctx, vendor.OwnerID)
	if err != nil {
		return nil, fmt.Errorf("user authentication failed")
	}

	// 4. Ledger first: no payment link may exist without a record of it.
	reference := uuid.NewString()
	payment := &models.SubscriptionPayment{
		Reference: reference, VendorID: vendorID, Tier: req.Tier,
		AmountKobo: priceKobo, Currency: "NGN",
	}
	if err := s.subscriptionRepo.CreatePayment(ctx, payment); err != nil {
		log.Error().Err(err).Str("vendorID", vendorID.String()).Msg("Ledger insert failed; not contacting Paystack")
		return nil, fmt.Errorf("failed to record payment intent: %w", err)
	}

	// 5. Paystack.
	callback := fmt.Sprintf("%s/subscription/callback", os.Getenv("FRONTEND_URL"))
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
		Reference: reference, AuthorizationURL: authURL,
		Tier: string(req.Tier), AmountKobo: priceKobo,
	}, nil
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

	// Ledger-backed payment: the vendor comes from the ledger, never from metadata.
	if _, err := s.subscriptionRepo.GetPaymentByReference(ctx, ref); err == nil {
		return s.settle(ctx, ref)
	} else if !errors.Is(err, reposub.ErrPaymentNotFound) {
		return fmt.Errorf("load payment: %w", err)
	}

	// Legacy path: payments initiated before the ledger.
	metadata, ok := payload.Data.Metadata.(map[string]interface{})
	if !ok {
		return fmt.Errorf("%w: metadata is invalid", ErrBadWebhookPayload)
	}
	vendorIDStr, _ := metadata["vendor_id"].(string)
	vendorID, err := uuid.Parse(vendorIDStr)
	if err != nil {
		return fmt.Errorf("%w: invalid vendor_id in metadata", ErrBadWebhookPayload)
	}
	return s.VerifyAndFinalize(ctx, ref, vendorID)
}
// VerifyAndFinalize confirms a payment with Paystack and activates the subscription
func (s *subscriptionServiceImpl) VerifyAndFinalize(ctx context.Context, reference string, vendorID uuid.UUID) error {
	// 1. Verify transaction with Paystack gateway
	transaction, err := s.paystack.VerifyTransaction(ctx, reference)
	if err != nil {
		return fmt.Errorf("paystack verification failed: %w", err)
	}

	if !transaction.Status {
		_ = s.subscriptionRepo.MarkPaymentFailed(ctx, reference, "gateway status failed")
		return fmt.Errorf("transaction not successful")
	}

	// 2. Settle the payment via the ledger
	return s.settle(ctx, reference)
}

// settle handles the ledger-backed activation and renewal logic
// settle handles the ledger-backed activation and renewal logic
func (s *subscriptionServiceImpl) settle(ctx context.Context, reference string) error {
	payment, err := s.subscriptionRepo.GetPaymentByReference(ctx, reference)
	if err != nil {
		return fmt.Errorf("get payment by reference: %w", err)
	}

	// If already applied, it's idempotent success
	if payment.Status == models.PaymentApplied {
		return nil
	}

	// Verify transaction again with Paystack gateway to ensure it's valid
	_, err = s.paystack.VerifyTransaction(ctx, reference)
	if err != nil {
		return fmt.Errorf("paystack verification failed during settle: %w", err)
	}

	// Prepare settlement input using the ledger payment details
	input := reposub.SettleInput{
		Reference:      reference,
		PaidAmountKobo: payment.AmountKobo,
		PaidCurrency:   payment.Currency,
		Channel:        "card", // Default fallback channel
		PaidAt:         time.Now().UTC(),
		Now:            time.Now().UTC(),
	}

	_, err = s.subscriptionRepo.SettlePayment(ctx, input)
	if err != nil {
		return fmt.Errorf("settle payment: %w", err)
	}

	return nil
}