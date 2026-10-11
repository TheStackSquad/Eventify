//backend/pkg/services/subscription/subscription_payment_test.go

package subscription

import (
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/eventify/backend/pkg/models"
	reposub "github.com/eventify/backend/pkg/repository/subscription"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// ── Mock: Paystack Client ─────────────────────────────────────────────────────

type mockPaystackClient struct{ mock.Mock }

func (m *mockPaystackClient) InitializeTransaction(ctx context.Context, email string, amountKobo int64, reference string, metadata map[string]string, callbackURL string) (string, error) {
	args := m.Called(ctx, email, amountKobo, reference, metadata, callbackURL)
	return args.String(0), args.Error(1)
}

func (m *mockPaystackClient) VerifyTransaction(ctx context.Context, reference string) (*models.PaystackVerificationResponse, error) {
	args := m.Called(ctx, reference)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PaystackVerificationResponse), args.Error(1)
}

// ── Mock: Subscription Repository ────────────────────────────────────────────

type mockSubRepo struct{ mock.Mock }

func (m *mockSubRepo) Create(ctx context.Context, sub *models.Subscription) (uuid.UUID, error) {
	args := m.Called(ctx, sub)
	return args.Get(0).(uuid.UUID), args.Error(1)
}
func (m *mockSubRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status models.SubscriptionStatus) error {
	return m.Called(ctx, id, status).Error(0)
}
func (m *mockSubRepo) UpdateAfterPayment(ctx context.Context, id uuid.UUID, params reposub.PaymentUpdateParams) error {
	return m.Called(ctx, id, params).Error(0)
}
func (m *mockSubRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Subscription, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Subscription), args.Error(1)
}
func (m *mockSubRepo) GetByReference(ctx context.Context, reference string) (*models.Subscription, error) {
	args := m.Called(ctx, reference)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Subscription), args.Error(1)
}
func (m *mockSubRepo) IncrementWebhookAttempts(ctx context.Context, reference string) error {
	return m.Called(ctx, reference).Error(0)
}
func (m *mockSubRepo) GetExpired(ctx context.Context) ([]models.Subscription, error) {
	args := m.Called(ctx)
	return args.Get(0).([]models.Subscription), args.Error(1)
}
func (m *mockSubRepo) RunInTransaction(ctx context.Context, fn func(tx *sqlx.Tx) error) error {
	return m.Called(ctx, fn).Error(0)
}
func (m *mockSubRepo) GetNeedingPaymentEmail(ctx context.Context) ([]reposub.EmailRecipient, error) {
	args := m.Called(ctx)
	return args.Get(0).([]reposub.EmailRecipient), args.Error(1)
}
func (m *mockSubRepo) GetNeedingReminder7D(ctx context.Context) ([]reposub.EmailRecipient, error) {
	args := m.Called(ctx)
	return args.Get(0).([]reposub.EmailRecipient), args.Error(1)
}
func (m *mockSubRepo) GetNeedingReminder3D(ctx context.Context) ([]reposub.EmailRecipient, error) {
	args := m.Called(ctx)
	return args.Get(0).([]reposub.EmailRecipient), args.Error(1)
}
func (m *mockSubRepo) GetNeedingReminder1D(ctx context.Context) ([]reposub.EmailRecipient, error) {
	args := m.Called(ctx)
	return args.Get(0).([]reposub.EmailRecipient), args.Error(1)
}
func (m *mockSubRepo) GetNeedingExpiredNotice(ctx context.Context) ([]reposub.EmailRecipient, error) {
	args := m.Called(ctx)
	return args.Get(0).([]reposub.EmailRecipient), args.Error(1)
}
func (m *mockSubRepo) GetActiveByVendorID(ctx context.Context, vendorID uuid.UUID) (*models.Subscription, error) {
	args := m.Called(ctx, vendorID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Subscription), args.Error(1)
}
func (m *mockSubRepo) UpdateEmailTracking(ctx context.Context, params reposub.EmailTrackingParams) error {
	return m.Called(ctx, params).Error(0)
}

// ── Test helpers ──────────────────────────────────────────────────────────────

// buildService constructs a bare subscriptionServiceImpl for payment tests.
// vendorRepo and authRepo are nil — VerifyAndFinalize does not use them.
func buildService(ps *mockPaystackClient, sr *mockSubRepo) *subscriptionServiceImpl {
	return &subscriptionServiceImpl{
		paystack:         ps,
		subscriptionRepo: sr,
		webhookSecret:    "test-webhook-secret",
	}
}

// signWebhook computes HMAC-SHA512 over body using the given secret.
// Mirrors paystack.VerifyWebhookSignature so tests can produce valid signatures.
func signWebhook(secret string, body []byte) string {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

// validPaystackResponse returns a successful Paystack verification for a given sub+vendor.
func validPaystackResponse(subID, vendorID uuid.UUID, amountKobo int) *models.PaystackVerificationResponse {
	return &models.PaystackVerificationResponse{
		Status:  true,
		Message: "Verification successful",
		Data: &models.PaystackData{
			Status:    "success",
			Reference: subID.String(),
			Amount:    amountKobo,
			Metadata: map[string]interface{}{
				"subscription_id": subID.String(),
				"vendor_id":       vendorID.String(),
			},
			Authorization: &models.PaystackAuthorization{Channel: "card"},
		},
	}
}

// pendingSub returns a pending subscription with the given price.
func pendingSub(subID, vendorID uuid.UUID, priceKobo int64) *models.Subscription {
	return &models.Subscription{
		ID:       subID,
		VendorID: vendorID,
		Tier:     models.TierPremium,
		Status:   models.SubStatusPending,
		Price:    priceKobo,
	}
}

// ── VerifyAndFinalize tests ───────────────────────────────────────────────────

func TestVerifyAndFinalize_Success_ActivatesSubscription(t *testing.T) {
	ps := &mockPaystackClient{}
	sr := &mockSubRepo{}
	svc := buildService(ps, sr)

	subID := uuid.New()
	vendorID := uuid.New()
	const priceKobo = 1_000_000

	ps.On("VerifyTransaction", mock.Anything, subID.String()).
		Return(validPaystackResponse(subID, vendorID, priceKobo), nil)
	sr.On("GetByID", mock.Anything, subID).
		Return(pendingSub(subID, vendorID, priceKobo), nil)
	sr.On("UpdateAfterPayment", mock.Anything, subID, mock.AnythingOfType("subscription.PaymentUpdateParams")).
		Return(nil)

	err := svc.VerifyAndFinalize(context.Background(), subID.String(), vendorID)

	assert.NoError(t, err)
	ps.AssertExpectations(t)
	sr.AssertExpectations(t)
}

func TestVerifyAndFinalize_PaystackNetworkError_Propagates(t *testing.T) {
	ps := &mockPaystackClient{}
	sr := &mockSubRepo{}
	svc := buildService(ps, sr)

	subID := uuid.New()
	vendorID := uuid.New()

	ps.On("VerifyTransaction", mock.Anything, subID.String()).
		Return(nil, errors.New("network timeout"))

	err := svc.VerifyAndFinalize(context.Background(), subID.String(), vendorID)

	assert.ErrorContains(t, err, "network timeout")
	sr.AssertNotCalled(t, "GetByID")
	sr.AssertNotCalled(t, "UpdateAfterPayment")
}

func TestVerifyAndFinalize_PaystackStatusFailed_ReturnsError(t *testing.T) {
	ps := &mockPaystackClient{}
	sr := &mockSubRepo{}
	svc := buildService(ps, sr)

	subID := uuid.New()
	vendorID := uuid.New()

	failedResp := &models.PaystackVerificationResponse{
		Status:  true,
		Message: "Verification successful",
		Data: &models.PaystackData{
			Status:    "failed",
			Reference: subID.String(),
			Metadata: map[string]interface{}{
				"subscription_id": subID.String(),
				"vendor_id":       vendorID.String(),
			},
		},
	}

	ps.On("VerifyTransaction", mock.Anything, subID.String()).
		Return(failedResp, nil)

	err := svc.VerifyAndFinalize(context.Background(), subID.String(), vendorID)

	assert.ErrorContains(t, err, "not successful")
	sr.AssertNotCalled(t, "GetByID")
}

func TestVerifyAndFinalize_AlreadyActive_IdempotentNoError(t *testing.T) {
	ps := &mockPaystackClient{}
	sr := &mockSubRepo{}
	svc := buildService(ps, sr)

	subID := uuid.New()
	vendorID := uuid.New()
	const priceKobo = 1_000_000

	ps.On("VerifyTransaction", mock.Anything, subID.String()).
		Return(validPaystackResponse(subID, vendorID, priceKobo), nil)

	activeSub := pendingSub(subID, vendorID, priceKobo)
	activeSub.Status = models.SubStatusActive
	sr.On("GetByID", mock.Anything, subID).Return(activeSub, nil)

	err := svc.VerifyAndFinalize(context.Background(), subID.String(), vendorID)

	assert.NoError(t, err)
	sr.AssertNotCalled(t, "UpdateAfterPayment")
}

func TestVerifyAndFinalize_AmountMismatch_CancelsFraudAndErrors(t *testing.T) {
	ps := &mockPaystackClient{}
	sr := &mockSubRepo{}
	svc := buildService(ps, sr)

	subID := uuid.New()
	vendorID := uuid.New()
	const expectedKobo = 1_000_000
	const tamperedKobo = 100 // attacker sends less

	ps.On("VerifyTransaction", mock.Anything, subID.String()).
		Return(validPaystackResponse(subID, vendorID, tamperedKobo), nil)
	sr.On("GetByID", mock.Anything, subID).
		Return(pendingSub(subID, vendorID, expectedKobo), nil)
	sr.On("UpdateStatus", mock.Anything, subID, models.SubStatusCancelled).
		Return(nil)

	err := svc.VerifyAndFinalize(context.Background(), subID.String(), vendorID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "amount")
	sr.AssertCalled(t, "UpdateStatus", mock.Anything, subID, models.SubStatusCancelled)
	sr.AssertNotCalled(t, "UpdateAfterPayment")
}

func TestVerifyAndFinalize_DBUpdateFails_ReturnsError(t *testing.T) {
	ps := &mockPaystackClient{}
	sr := &mockSubRepo{}
	svc := buildService(ps, sr)

	subID := uuid.New()
	vendorID := uuid.New()
	const priceKobo = 1_000_000

	ps.On("VerifyTransaction", mock.Anything, subID.String()).
		Return(validPaystackResponse(subID, vendorID, priceKobo), nil)
	sr.On("GetByID", mock.Anything, subID).
		Return(pendingSub(subID, vendorID, priceKobo), nil)
	sr.On("UpdateAfterPayment", mock.Anything, subID, mock.AnythingOfType("subscription.PaymentUpdateParams")).
		Return(errors.New("db connection lost"))

	err := svc.VerifyAndFinalize(context.Background(), subID.String(), vendorID)

	assert.ErrorContains(t, err, "db connection lost")
}

func TestVerifyAndFinalize_SetsExpiryOneMonthFromNow(t *testing.T) {
	ps := &mockPaystackClient{}
	sr := &mockSubRepo{}
	svc := buildService(ps, sr)

	subID := uuid.New()
	vendorID := uuid.New()
	const priceKobo = 1_000_000

	ps.On("VerifyTransaction", mock.Anything, subID.String()).
		Return(validPaystackResponse(subID, vendorID, priceKobo), nil)
	sr.On("GetByID", mock.Anything, subID).
		Return(pendingSub(subID, vendorID, priceKobo), nil)

	var captured reposub.PaymentUpdateParams
	sr.On("UpdateAfterPayment", mock.Anything, subID, mock.AnythingOfType("subscription.PaymentUpdateParams")).
		Run(func(args mock.Arguments) {
			captured = args.Get(2).(reposub.PaymentUpdateParams)
		}).
		Return(nil)

	before := time.Now()
	err := svc.VerifyAndFinalize(context.Background(), subID.String(), vendorID)
	after := time.Now()

	assert.NoError(t, err)
	assert.Equal(t, models.SubStatusActive, captured.Status)
	assert.Equal(t, "card", captured.PaymentMethod)

	expectedExpiry := before.AddDate(0, 1, 0)
	tolerance := after.Sub(before) + time.Second
	assert.WithinDuration(t, expectedExpiry, captured.ExpiresAt, tolerance)
}

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