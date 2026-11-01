//backend/pkg/services/subscription/subscription_payment_verify_test.go

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
//	repoauth "github.com/eventify/backend/pkg/repository/auth"
	reposub "github.com/eventify/backend/pkg/repository/subscription"
//	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
//	"github.com/stretchr/testify/require"
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
func (m *mockSubRepo) CreatePayment(ctx context.Context, p *models.SubscriptionPayment) error {
	return m.Called(ctx, p).Error(0)
}
func (m *mockSubRepo) GetPaymentByReference(ctx context.Context, ref string) (*models.SubscriptionPayment, error) {
	registered := false
	for _, c := range m.ExpectedCalls {
		if c.Method == "GetPaymentByReference" {
			registered = true
			break
		}
	}
	if !registered {
		return nil, reposub.ErrPaymentNotFound // legacy tests: no ledger row
	}
	args := m.Called(ctx, ref)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.SubscriptionPayment), args.Error(1)
}

func (m *mockSubRepo) MarkPaymentFailed(ctx context.Context, ref, reason string) error {
	return m.Called(ctx, ref, reason).Error(0)
}
func (m *mockSubRepo) QueueEmailOnce(ctx context.Context, to, subject, template, payloadJSON, dedupeKey string) error {
	args := m.Called(ctx, to, subject, template, payloadJSON, dedupeKey)
	return args.Error(0)
}

func (m *mockSubRepo) ListInitiatedBetween(ctx context.Context, after, before time.Time, limit int) ([]string, error) {
	args := m.Called(ctx, after, before, limit)
	return args.Get(0).([]string), args.Error(1)
}
func (m *mockSubRepo) AbandonStalePayments(ctx context.Context, before time.Time) (int64, error) {
	args := m.Called(ctx, before)
	return args.Get(0).(int64), args.Error(1)
}

// ── Test helpers ──────────────────────────────────────────────────────────────


func (m *mockSubRepo) SettlePayment(ctx context.Context, input reposub.SettleInput) (reposub.SettleOutcome, error) {
    args := m.Called(ctx, input)
    
    var outcome reposub.SettleOutcome
    if val := args.Get(0); val != nil {
        if o, ok := val.(reposub.SettleOutcome); ok {
            outcome = o
        }
    }

    var err error
    if len(args) > 1 {
        err = args.Error(1)
    }

    return outcome, err
}

func buildService(ps *mockPaystackClient, sr *mockSubRepo) *subscriptionServiceImpl {
	return &subscriptionServiceImpl{
		paystack:         ps,
		subscriptionRepo: sr,
		webhookSecret:    "test-webhook-secret",
	}
}

func signWebhook(secret string, body []byte) string {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

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



// func TestVerifyAndFinalize_PaystackNetworkError_Propagates(t *testing.T) {
// 	ps := &mockPaystackClient{}
// 	sr := &mockSubRepo{}
// 	svc := buildService(ps, sr)

// 	subID := uuid.New()
// 	vendorID := uuid.New()

// 	ps.On("VerifyTransaction", mock.Anything, subID.String()).
// 		Return(nil, errors.New("network timeout"))

// 	err := svc.VerifyAndFinalize(context.Background(), subID.String(), vendorID)

// 	assert.ErrorContains(t, err, "network timeout")
// 	sr.AssertNotCalled(t, "GetByID")
// 	sr.AssertNotCalled(t, "UpdateAfterPayment")
// }


func TestVerifyAndFinalize_PaystackNetworkError_Propagates(t *testing.T) {
    ref := uuid.NewString()
    vendorID := uuid.New()
    ps, sr, svc := settleFixture(ledgerRow(ref, vendorID))

    ps.On("VerifyTransaction", mock.Anything, ref).
        Return(nil, errors.New("network timeout"))

    err := svc.VerifyAndFinalize(context.Background(), ref, vendorID)

    assert.ErrorContains(t, err, "network timeout")
    sr.AssertNumberOfCalls(t, "SettlePayment", 0)
}

func settleFixture(p *models.SubscriptionPayment) (*mockPaystackClient, *mockSubRepo, *subscriptionServiceImpl) {
	ps, sr := &mockPaystackClient{}, &mockSubRepo{}
	sr.On("GetPaymentByReference", mock.Anything, p.Reference).Return(p, nil)
	return ps, sr, buildService(ps, sr)
}

func paidResp(vendorID uuid.UUID) *models.PaystackVerificationResponse {
	r := validPaystackResponse(uuid.New(), vendorID, 1_000_000)
	r.Status, r.Data.Status, r.Data.Currency = true, "success", "NGN"
	return r
}

func underpaidResp(vendorID uuid.UUID) *models.PaystackVerificationResponse {
	r := validPaystackResponse(uuid.New(), vendorID, 100)
	r.Status, r.Data.Status, r.Data.Currency = true, "success", "NGN"
	return r
}

func ledgerRow(ref string, vendorID uuid.UUID) *models.SubscriptionPayment {
	return &models.SubscriptionPayment{Reference: ref, VendorID: vendorID, AmountKobo: 1_000_000, Currency: "NGN"}
}


func TestVerify_OtherVendorsPayment_Rejected(t *testing.T) {
	ref := uuid.NewString()
	ps, sr, svc := settleFixture(ledgerRow(ref, uuid.New()))

	err := svc.VerifyAndFinalize(context.Background(), ref, uuid.New())

	assert.ErrorIs(t, err, ErrPaymentNotOwned)
	ps.AssertNumberOfCalls(t, "VerifyTransaction", 0)
	sr.AssertNumberOfCalls(t, "SettlePayment", 0)
}

func TestVerify_UnpaidStatuses_CanNeverActivate(t *testing.T) {
	for _, status := range []string{"abandoned", "pending", "ongoing", "failed", "reversed", ""} {
		ref, vendorID := uuid.NewString(), uuid.New()
		ps, sr, svc := settleFixture(ledgerRow(ref, vendorID))
		resp := paidResp(vendorID)
		resp.Data.Status = status
		ps.On("VerifyTransaction", mock.Anything, ref).Return(resp, nil)

		err := svc.VerifyAndFinalize(context.Background(), ref, vendorID)

		assert.ErrorIs(t, err, ErrPaymentNotSuccessful, "paystack status %q", status)
		sr.AssertNumberOfCalls(t, "SettlePayment", 0)
	}
}

func TestVerify_PaidAmountAndCurrencyComeFromPaystack_NotFromLedger(t *testing.T) {
	ref, vendorID := uuid.NewString(), uuid.New()
	ps, sr, svc := settleFixture(ledgerRow(ref, vendorID)) // ledger expects 1,000,000 NGN
	resp := underpaidResp(vendorID)
	resp.Data.Currency = "USD"
	ps.On("VerifyTransaction", mock.Anything, ref).Return(resp, nil)
	var got reposub.SettleInput
	sr.On("SettlePayment", mock.Anything, mock.Anything).
		Run(func(a mock.Arguments) { got = a.Get(1).(reposub.SettleInput) }).
		Return(reposub.SettleNeedsReview, nil)

	err := svc.VerifyAndFinalize(context.Background(), ref, vendorID)

	assert.ErrorIs(t, err, ErrPaymentNeedsReview)
	assert.Equal(t, int64(100), got.PaidAmountKobo)
	assert.Equal(t, "USD", got.PaidCurrency)
}

func TestVerify_Outcomes(t *testing.T) {
	cases := []struct {
		outcome reposub.SettleOutcome
		wantErr error
	}{
		{reposub.SettleApplied, nil},
		{reposub.SettleAlreadyApplied, nil},
		{reposub.SettleNeedsReview, ErrPaymentNeedsReview},
	}
	for _, tc := range cases {
		ref, vendorID := uuid.NewString(), uuid.New()
		ps, sr, svc := settleFixture(ledgerRow(ref, vendorID))
		ps.On("VerifyTransaction", mock.Anything, ref).Return(paidResp(vendorID), nil)
		sr.On("SettlePayment", mock.Anything, mock.Anything).Return(tc.outcome, nil)

		err := svc.VerifyAndFinalize(context.Background(), ref, vendorID)

		if tc.wantErr == nil {
			assert.NoError(t, err, string(tc.outcome))
		} else {
			assert.ErrorIs(t, err, tc.wantErr, string(tc.outcome))
		}
	}
}

func TestVerify_DatabaseFailure_PropagatesAndIsRetryable(t *testing.T) {
	ref, vendorID := uuid.NewString(), uuid.New()
	ps, sr, svc := settleFixture(ledgerRow(ref, vendorID))
	ps.On("VerifyTransaction", mock.Anything, ref).Return(paidResp(vendorID), nil)
	sr.On("SettlePayment", mock.Anything, mock.Anything).
		Return(reposub.SettleOutcome(""), errors.New("db connection lost"))

	err := svc.VerifyAndFinalize(context.Background(), ref, vendorID)

	assert.ErrorContains(t, err, "db connection lost")
	assert.True(t, IsRetryable(err))
}

func TestHandleWebhook_LedgerPayment_SettledByReference_MetadataVendorIgnored(t *testing.T) {
	ref, ledgerVendor := uuid.NewString(), uuid.New()
	ps, sr, svc := settleFixture(ledgerRow(ref, ledgerVendor))
	body := []byte(fmt.Sprintf(
		`{"event":"charge.success","data":{"reference":%q,"metadata":{"payment_type":"subscription","vendor_id":%q}}}`,
		ref, uuid.NewString())) // metadata names a DIFFERENT vendor
	sr.On("IncrementWebhookAttempts", mock.Anything, ref).Return(nil)
	ps.On("VerifyTransaction", mock.Anything, ref).Return(paidResp(ledgerVendor), nil)
	sr.On("SettlePayment", mock.Anything, mock.Anything).Return(reposub.SettleApplied, nil)

	err := svc.HandleWebhook(context.Background(), body, signWebhook("test-webhook-secret", body))

	assert.NoError(t, err)
	sr.AssertNumberOfCalls(t, "SettlePayment", 1)
}

func TestHandleWebhook_UnknownReference_AcknowledgedNotRetried(t *testing.T) {
	ps, sr := &mockPaystackClient{}, &mockSubRepo{}
	svc := buildService(ps, sr) // mock default: no ledger row
	body := []byte(`{"event":"charge.success","data":{"reference":"ghost"}}`)
	sr.On("IncrementWebhookAttempts", mock.Anything, "ghost").Return(errors.New("not found"))

	err := svc.HandleWebhook(context.Background(), body, signWebhook("test-webhook-secret", body))

	assert.Error(t, err)
	assert.False(t, IsRetryable(err))
	ps.AssertNumberOfCalls(t, "VerifyTransaction", 0)
}

