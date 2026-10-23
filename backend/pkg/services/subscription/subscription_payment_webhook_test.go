//backend/pkg/services/subscription/subscription_payment_webhook_test.go

package subscription

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// ── HandleWebhook tests ───────────────────────────────────────────────────────

func TestHandleWebhook_InvalidSignature_Rejected(t *testing.T) {
	ps := &mockPaystackClient{}
	sr := &mockSubRepo{}
	svc := buildService(ps, sr)

	body := []byte(`{"event":"charge.success","data":{"reference":"ref-001"}}`)

	err := svc.HandleWebhook(context.Background(), body, "bad-signature")

	assert.ErrorContains(t, err, "invalid signature")
	ps.AssertNotCalled(t, "VerifyTransaction")
}

func TestHandleWebhook_NonSuccessEvent_SilentlySkipped(t *testing.T) {
	ps := &mockPaystackClient{}
	sr := &mockSubRepo{}
	svc := buildService(ps, sr)

	body := []byte(`{"event":"charge.failed","data":{"reference":"ref-001","status":"failed"}}`)
	sig := signWebhook("test-webhook-secret", body)

	err := svc.HandleWebhook(context.Background(), body, sig)

	assert.NoError(t, err)
	ps.AssertNotCalled(t, "VerifyTransaction")
}

func TestHandleWebhook_ValidSignature_CallsVerifyAndFinalize(t *testing.T) {
	ps := &mockPaystackClient{}
	sr := &mockSubRepo{}
	svc := buildService(ps, sr)

	subID := uuid.New()
	vendorID := uuid.New()
	const priceKobo = 1_000_000

	body := []byte(fmt.Sprintf(
		`{"event":"charge.success","data":{"reference":%q,"status":"success","amount":%d,"metadata":{"subscription_id":%q,"vendor_id":%q},"authorization":{"channel":"card"}}}`,
		subID.String(), priceKobo, subID.String(), vendorID.String(),
	))
	sig := signWebhook("test-webhook-secret", body)

	sr.On("IncrementWebhookAttempts", mock.Anything, subID.String()).Return(nil)
	ps.On("VerifyTransaction", mock.Anything, subID.String()).
		Return(validPaystackResponse(subID, vendorID, priceKobo), nil)
	sr.On("GetByID", mock.Anything, subID).
		Return(pendingSub(subID, vendorID, priceKobo), nil)
	sr.On("UpdateAfterPayment", mock.Anything, subID, mock.AnythingOfType("subscription.PaymentUpdateParams")).
		Return(nil)

	err := svc.HandleWebhook(context.Background(), body, sig)

	assert.NoError(t, err)
	ps.AssertExpectations(t)
	sr.AssertExpectations(t)
}