//backend/pkg/services/subscription/subscription_payment_initiate_test.go

package subscription

import (
	"context"
	"errors"
	"testing"

	"github.com/eventify/backend/pkg/models"
	repoauth "github.com/eventify/backend/pkg/repository/auth"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// ── Fakes for InitiateSubscription ────────────────────────────────────────────

type fakeVendorRepo struct {
	repovendor.VendorRepository
	vendor models.Vendor
}

func (f fakeVendorRepo) GetByID(context.Context, uuid.UUID) (models.Vendor, error) {
	return f.vendor, nil
}

type fakeAuthRepo struct {
	repoauth.AuthRepository
	user *models.User
}

func (f fakeAuthRepo) GetUserByID(context.Context, uuid.UUID) (*models.User, error) {
	return f.user, nil
}

func initiateFixture() (*mockPaystackClient, *mockSubRepo, *subscriptionServiceImpl, uuid.UUID) {
	ps, sr := &mockPaystackClient{}, &mockSubRepo{}
	svc := &subscriptionServiceImpl{
		paystack:         ps,
		subscriptionRepo: sr,
		vendorRepo:       fakeVendorRepo{vendor: models.Vendor{OwnerID: uuid.New()}},
		authRepo:         fakeAuthRepo{user: &models.User{Email: "v@example.com"}},
		webhookSecret:    "test-webhook-secret",
	}
	return ps, sr, svc, uuid.New()
}

// ── InitiateSubscription tests ────────────────────────────────────────────────

func TestInitiate_FreeAndUnknownTiers_RejectedBeforeAnyIO(t *testing.T) {
	cases := []struct {
		tier models.SubscriptionTier
		want error
	}{
		{models.TierFree, ErrFreeTier},
		{"platinum", ErrInvalidTier},
		{"", ErrInvalidTier},
	}
	for _, tc := range cases {
		ps, sr, svc, vendorID := initiateFixture()

		_, err := svc.InitiateSubscription(context.Background(), vendorID, models.InitiateSubRequest{Tier: tc.tier})

		assert.ErrorIs(t, err, tc.want, "tier %q", tc.tier)
		sr.AssertNumberOfCalls(t, "GetActiveByVendorID", 0)
		sr.AssertNumberOfCalls(t, "CreatePayment", 0)
		ps.AssertNumberOfCalls(t, "InitializeTransaction", 0)
	}
}

func TestInitiate_ChargesServerPrice_AndLedgerReferenceIsPaystackReference(t *testing.T) {
	ps, sr, svc, vendorID := initiateFixture()
	var ledger *models.SubscriptionPayment

	sr.On("GetActiveByVendorID", mock.Anything, vendorID).Return(nil, nil)
	sr.On("CreatePayment", mock.Anything, mock.AnythingOfType("*models.SubscriptionPayment")).
		Run(func(args mock.Arguments) { ledger = args.Get(1).(*models.SubscriptionPayment) }).
		Return(nil)
	ps.On("InitializeTransaction", mock.Anything, "v@example.com", int64(2_500_000),
		mock.MatchedBy(func(ref string) bool { return ledger != nil && ref == ledger.Reference }),
		mock.MatchedBy(func(m map[string]string) bool {
			return m["payment_type"] == "subscription" && m["vendor_id"] == vendorID.String()
		}),
		mock.AnythingOfType("string")).
		Return("https://paystack.test/pay", nil)

	resp, err := svc.InitiateSubscription(context.Background(), vendorID, models.InitiateSubRequest{Tier: models.TierFeatured})

	require.NoError(t, err)
	require.NotNil(t, ledger)
	assert.Equal(t, "https://paystack.test/pay", resp.AuthorizationURL)
	assert.Equal(t, int64(2_500_000), resp.AmountKobo)
	assert.Equal(t, ledger.Reference, resp.Reference)
	assert.Equal(t, int64(2_500_000), ledger.AmountKobo)
	assert.Equal(t, models.TierFeatured, ledger.Tier)
	ps.AssertExpectations(t)
}

func TestInitiate_ActiveVendor_MaySameTierRenew_ButNotSwitchTier(t *testing.T) {
	active := &models.Subscription{Tier: models.TierPremium, Status: models.SubStatusActive}

	// different tier: blocked, nothing written, Paystack untouched
	ps, sr, svc, vendorID := initiateFixture()
	sr.On("GetActiveByVendorID", mock.Anything, vendorID).Return(active, nil)
	_, err := svc.InitiateSubscription(context.Background(), vendorID, models.InitiateSubRequest{Tier: models.TierFeatured})
	assert.ErrorIs(t, err, ErrActiveDifferentTier)
	sr.AssertNumberOfCalls(t, "CreatePayment", 0)
	ps.AssertNumberOfCalls(t, "InitializeTransaction", 0)

	// same tier: allowed
	ps, sr, svc, vendorID = initiateFixture()
	sr.On("GetActiveByVendorID", mock.Anything, vendorID).Return(active, nil)
	sr.On("CreatePayment", mock.Anything, mock.Anything).Return(nil)
	ps.On("InitializeTransaction", mock.Anything, mock.Anything, int64(1_000_000), mock.Anything, mock.Anything, mock.Anything).
		Return("https://paystack.test/pay", nil)
	_, err = svc.InitiateSubscription(context.Background(), vendorID, models.InitiateSubRequest{Tier: models.TierPremium})
	assert.NoError(t, err)
}

func TestInitiate_LedgerInsertFails_PaystackNeverCalled(t *testing.T) {
	ps, sr, svc, vendorID := initiateFixture()
	sr.On("GetActiveByVendorID", mock.Anything, vendorID).Return(nil, nil)
	sr.On("CreatePayment", mock.Anything, mock.Anything).Return(errors.New("db down"))

	_, err := svc.InitiateSubscription(context.Background(), vendorID, models.InitiateSubRequest{Tier: models.TierBasic})

	assert.Error(t, err)
	ps.AssertNumberOfCalls(t, "InitializeTransaction", 0)
}

func TestInitiate_PaystackFails_LedgerMarkedFailed(t *testing.T) {
	ps, sr, svc, vendorID := initiateFixture()
	sr.On("GetActiveByVendorID", mock.Anything, vendorID).Return(nil, nil)
	sr.On("CreatePayment", mock.Anything, mock.Anything).Return(nil)
	ps.On("InitializeTransaction", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return("", errors.New("gateway timeout"))
	sr.On("MarkPaymentFailed", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil)

	_, err := svc.InitiateSubscription(context.Background(), vendorID, models.InitiateSubRequest{Tier: models.TierBasic})

	assert.ErrorIs(t, err, ErrGatewayUnavailable)
	sr.AssertNumberOfCalls(t, "MarkPaymentFailed", 1)
}
