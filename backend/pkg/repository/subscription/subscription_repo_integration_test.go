// pkg/repository/subscription/subscription_repo_integration_test.go
//
// Integration tests for SubscriptionRepository.
// These tests exercise the real DB including:
//   - trigger_validate_activation (payment_reference + expires_at required for active)
//   - trigger_sync_vendor_tier (vendor.subscription_tier synced on status change)
//   - unique_payment_reference constraint
//   - State machine enforcement in UpdateStatus
package subscription_test

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/eventify/backend/pkg/models"
	reposub "github.com/eventify/backend/pkg/repository/subscription"
	"github.com/eventify/backend/pkg/testhelper"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// ============================================================================
// SUITE SETUP
// ============================================================================

type SubscriptionRepoSuite struct {
	suite.Suite
	repo reposub.SubscriptionRepository
	ctx  context.Context
}

func TestSubscriptionRepoSuite(t *testing.T) {
	suite.Run(t, new(SubscriptionRepoSuite))
}

func (s *SubscriptionRepoSuite) SetupSuite() {
	db := testhelper.NewTestDB(s.T())
	s.repo = reposub.NewSubscriptionRepository(db)
	s.ctx = context.Background()
}

func (s *SubscriptionRepoSuite) TearDownTest() {
	db := testhelper.NewTestDB(s.T())
	testhelper.TruncateTables(s.T(), db,
		"profile_views", "reviews", "inquiries", "subscriptions",
		"vendor_stats", "vendor_trust_score", "vendors", "users",
	)
}

// ============================================================================
// CREATE
// ============================================================================

// A pending subscription requires no payment_reference — the trigger only
// fires the validation block when status transitions TO 'active'.
func (s *SubscriptionRepoSuite) TestCreate_PendingSubscriptionRequiresNoPaymentRef() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})

	sub := &models.Subscription{
		VendorID:  vendorID,
		Tier:      models.TierPremium,
		Status:    models.SubStatusPending,
		StartsAt:  time.Now().UTC(),
		Price:     700_000,
		Currency:  "NGN",
		AutoRenew: false,
	}

	id, err := s.repo.Create(s.ctx, sub)
	s.NoError(err, "pending subscription must be creatable without payment_reference")
	s.NotEqual(uuid.Nil, id)
}

// TRIGGER REGRESSION: trigger_validate_activation must block direct INSERT
// of an active subscription without payment_reference.
func (s *SubscriptionRepoSuite) TestCreate_ActiveWithoutPaymentRefIsRejectedByTrigger() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})

	expiry := time.Now().AddDate(0, 1, 0)
	sub := &models.Subscription{
		VendorID:  vendorID,
		Tier:      models.TierPremium,
		Status:    models.SubStatusActive, // trigger will fire
		StartsAt:  time.Now().UTC(),
		ExpiresAt: sql.NullTime{Time: expiry, Valid: true},
		Price:     700_000,
		Currency:  "NGN",
		// PaymentReference intentionally omitted
	}

	_, err := s.repo.Create(s.ctx, sub)
	s.Error(err, "trigger must reject active subscription without payment_reference")
	s.Contains(err.Error(), "payment_reference",
		"error message must reference the missing field")
}

// TRIGGER REGRESSION: trigger_validate_activation must also require expires_at.
func (s *SubscriptionRepoSuite) TestCreate_ActiveWithoutExpiresAtIsRejectedByTrigger() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})

	ref := fmt.Sprintf("TEST-REF-%s", uuid.New())
	sub := &models.Subscription{
		VendorID:         vendorID,
		Tier:             models.TierPremium,
		Status:           models.SubStatusActive,
		StartsAt:         time.Now().UTC(),
		Price:            700_000,
		Currency:         "NGN",
		PaymentReference: sql.NullString{String: ref, Valid: true},
		// ExpiresAt intentionally omitted — trigger must block this
	}

	_, err := s.repo.Create(s.ctx, sub)
	s.Error(err, "trigger must reject active subscription without expires_at")
}

// ============================================================================
// GET BY ID
// ============================================================================

func (s *SubscriptionRepoSuite) TestGetByID_Found() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})
	subID := testhelper.CreateTestSubscription(s.T(), db, testhelper.SubscriptionSeedOpts{
		VendorID: vendorID,
		Tier:     "premium",
		Status:   "pending",
	})

	sub, err := s.repo.GetByID(s.ctx, subID)
	s.NoError(err)
	s.Equal(subID, sub.ID)
	s.Equal(models.TierPremium, sub.Tier)
	s.Equal(models.SubStatusPending, sub.Status)
}

func (s *SubscriptionRepoSuite) TestGetByID_NotFound() {
	_, err := s.repo.GetByID(s.ctx, uuid.New())
	s.Error(err)
	s.Contains(err.Error(), "not found")
}

// ============================================================================
// GET BY REFERENCE
// ============================================================================

func (s *SubscriptionRepoSuite) TestGetByReference_Found() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})
	subID := testhelper.CreateTestSubscription(s.T(), db, testhelper.SubscriptionSeedOpts{
		VendorID: vendorID,
		Status:   "active", // seed helper auto-generates TEST-REF-<id>
	})

	// The seed helper sets reference to TEST-REF-<subID>
	ref := fmt.Sprintf("TEST-REF-%s", subID.String())
	sub, err := s.repo.GetByReference(s.ctx, ref)
	s.NoError(err)
	s.Equal(subID, sub.ID)
	s.True(sub.PaymentReference.Valid)
	s.Equal(ref, sub.PaymentReference.String)
}

func (s *SubscriptionRepoSuite) TestGetByReference_NotFound() {
	_, err := s.repo.GetByReference(s.ctx, "nonexistent-ref")
	s.Error(err)
	s.Contains(err.Error(), "not found")
}

// ============================================================================
// UPDATE STATUS — state machine enforcement
// ============================================================================

func (s *SubscriptionRepoSuite) TestUpdateStatus_ValidTransition_PendingToActive() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})

	// Start pending — no trigger issues
	subID := testhelper.CreateTestSubscription(s.T(), db, testhelper.SubscriptionSeedOpts{
		VendorID: vendorID,
		Status:   "pending",
	})

	// NOTE: UpdateStatus calls UPDATE which also fires trigger_validate_activation.
	// pending → active requires payment_reference and expires_at.
	// The repo's UpdateStatus only updates the status column, so the trigger
	// will block this unless payment_reference was already set.
	// This test therefore verifies that the state machine PLUS trigger interact correctly:
	// a bare UpdateStatus(active) on a pending-with-no-ref sub must fail.
	err := s.repo.UpdateStatus(s.ctx, subID, models.SubStatusActive)
	s.Error(err,
		"UpdateStatus to active must fail when payment_reference is missing — trigger enforces this")
}

func (s *SubscriptionRepoSuite) TestUpdateStatus_ValidTransition_ActiveToCancelled() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})

	// Seed as active (seed helper provides payment_reference + expires_at)
	subID := testhelper.CreateTestSubscription(s.T(), db, testhelper.SubscriptionSeedOpts{
		VendorID: vendorID,
		Status:   "active",
	})

	err := s.repo.UpdateStatus(s.ctx, subID, models.SubStatusCancelled)
	s.NoError(err, "active → cancelled is a valid transition")

	sub, _ := s.repo.GetByID(s.ctx, subID)
	s.Equal(models.SubStatusCancelled, sub.Status)
}

// INVARIANT: cancelled subscriptions cannot be reactivated — ever.
func (s *SubscriptionRepoSuite) TestUpdateStatus_InvalidTransition_CancelledToActive() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})

	subID := testhelper.CreateTestSubscription(s.T(), db, testhelper.SubscriptionSeedOpts{
		VendorID: vendorID,
		Status:   "active",
	})

	// Cancel it first
	require.NoError(s.T(), s.repo.UpdateStatus(s.ctx, subID, models.SubStatusCancelled))

	// Now try to reactivate — state machine must block this
	err := s.repo.UpdateStatus(s.ctx, subID, models.SubStatusActive)
	s.Error(err, "cancelled → active must be rejected by state machine")
	s.Contains(err.Error(), "not allowed")
}

func (s *SubscriptionRepoSuite) TestUpdateStatus_NonExistentSubscription() {
	err := s.repo.UpdateStatus(s.ctx, uuid.New(), models.SubStatusCancelled)
	s.Error(err)
}

// ============================================================================
// UPDATE AFTER PAYMENT — atomic activation + tier sync
// ============================================================================

// INVARIANT: UpdateAfterPayment must atomically activate the subscription AND
// sync vendor.subscription_tier in the same transaction.
func (s *SubscriptionRepoSuite) TestUpdateAfterPayment_SyncsVendorTierAtomically() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{
		SubscriptionTier: "free",
	})

	subID := testhelper.CreateTestSubscription(s.T(), db, testhelper.SubscriptionSeedOpts{
		VendorID: vendorID,
		Tier:     "premium",
		Status:   "pending",
	})

	now := time.Now().UTC()
	expiry := now.AddDate(0, 1, 0)
	ref := fmt.Sprintf("PAY-REF-%s", subID.String())

	params := reposub.PaymentUpdateParams{
		Status:           models.SubStatusActive,
		PaymentReference: ref,
		PaymentMethod:    "card",
		LastPaymentDate:  now,
		NextPaymentDate:  expiry,
		ExpiresAt:        expiry,
	}

	err := s.repo.UpdateAfterPayment(s.ctx, subID, params)
	s.NoError(err)

	// Subscription must be active with correct reference
	sub, err := s.repo.GetByID(s.ctx, subID)
	s.NoError(err)
	s.Equal(models.SubStatusActive, sub.Status)
	s.Equal(ref, sub.PaymentReference.String)

	// Vendor tier must be synced to premium by the trigger_sync_vendor_tier
	var vendorTier string
	err = db.Get(&vendorTier, `SELECT subscription_tier FROM vendors WHERE id = $1`, vendorID)
	s.NoError(err)
	s.Equal("premium", vendorTier,
		"trigger_sync_vendor_tier must update vendor.subscription_tier to premium after activation")
}

// IDEMPOTENCY: If the subscription is already active (e.g. webhook beat the redirect),
// UpdateAfterPayment must return nil — no error, no state change.
func (s *SubscriptionRepoSuite) TestUpdateAfterPayment_IsIdempotentWhenAlreadyActive() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})

	// Seed already-active subscription
	subID := testhelper.CreateTestSubscription(s.T(), db, testhelper.SubscriptionSeedOpts{
		VendorID: vendorID,
		Status:   "active",
	})

	now := time.Now().UTC()
	params := reposub.PaymentUpdateParams{
		Status:           models.SubStatusActive,
		PaymentReference: fmt.Sprintf("DUPE-REF-%s", uuid.New()),
		PaymentMethod:    "card",
		LastPaymentDate:  now,
		NextPaymentDate:  now.AddDate(0, 1, 0),
		ExpiresAt:        now.AddDate(0, 1, 0),
	}

	err := s.repo.UpdateAfterPayment(s.ctx, subID, params)
	s.NoError(err,
		"UpdateAfterPayment on already-active subscription must be a no-op (idempotent)")
}

// ============================================================================
// GET ACTIVE BY VENDOR ID
// ============================================================================

func (s *SubscriptionRepoSuite) TestGetActiveByVendorID_ReturnsActiveSubscription() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})
	subID := testhelper.CreateTestSubscription(s.T(), db, testhelper.SubscriptionSeedOpts{
		VendorID: vendorID,
		Tier:     "featured",
		Status:   "active",
	})

	sub, err := s.repo.GetActiveByVendorID(s.ctx, vendorID)
	s.NoError(err)
	s.NotNil(sub)
	s.Equal(subID, sub.ID)
	s.Equal(models.TierFeatured, sub.Tier)
}

func (s *SubscriptionRepoSuite) TestGetActiveByVendorID_ReturnsNilWhenNoneActive() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})

	// Seed a cancelled subscription — must not be returned
	testhelper.CreateTestSubscription(s.T(), db, testhelper.SubscriptionSeedOpts{
		VendorID: vendorID,
		Status:   "cancelled",
	})

	sub, err := s.repo.GetActiveByVendorID(s.ctx, vendorID)
	s.NoError(err)
	s.Nil(sub, "cancelled subscription must not be returned as active")
}

func (s *SubscriptionRepoSuite) TestGetActiveByVendorID_NilForUnknownVendor() {
	sub, err := s.repo.GetActiveByVendorID(s.ctx, uuid.New())
	s.NoError(err)
	s.Nil(sub)
}

// ============================================================================
// GET EXPIRED
// ============================================================================

func (s *SubscriptionRepoSuite) TestGetExpired_ReturnsOnlyExpiredPastExpiresAt() {
	db := testhelper.NewTestDB(s.T())

	alreadyExpired := time.Now().Add(-24 * time.Hour) // yesterday
	futureExpiry := time.Now().AddDate(0, 1, 0)        // next month

	// Active but expired (expires_at in past) — should be returned
	expiredVendor := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})
	testhelper.CreateTestSubscription(s.T(), db, testhelper.SubscriptionSeedOpts{
		VendorID:  expiredVendor,
		Status:    "active",
		ExpiresAt: &alreadyExpired,
	})

	// Active with future expiry — must NOT be returned
	activeVendor := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})
	testhelper.CreateTestSubscription(s.T(), db, testhelper.SubscriptionSeedOpts{
		VendorID:  activeVendor,
		Status:    "active",
		ExpiresAt: &futureExpiry,
	})

	expired, err := s.repo.GetExpired(s.ctx)
	s.NoError(err)

	// Only the past-expiry sub should appear
	s.GreaterOrEqual(len(expired), 1, "at least one expired subscription must be returned")
	for _, e := range expired {
		s.True(e.ExpiresAt.Valid)
		s.True(e.ExpiresAt.Time.Before(time.Now()),
			"GetExpired must only return subscriptions with expires_at < NOW()")
	}
}

// ============================================================================
// INCREMENT WEBHOOK ATTEMPTS
// ============================================================================

func (s *SubscriptionRepoSuite) TestIncrementWebhookAttempts_IncrementsCorrectly() {
	db := testhelper.NewTestDB(s.T())
	vendorID := testhelper.CreateTestVendor(s.T(), db, testhelper.VendorSeedOpts{})
	subID := testhelper.CreateTestSubscription(s.T(), db, testhelper.SubscriptionSeedOpts{
		VendorID: vendorID,
		Status:   "active",
	})

	ref := fmt.Sprintf("TEST-REF-%s", subID.String())

	err := s.repo.IncrementWebhookAttempts(s.ctx, ref)
	s.NoError(err)

	sub, _ := s.repo.GetByID(s.ctx, subID)
	s.Equal(1, sub.WebhookAttempts, "webhook_attempts must increment from 0 to 1")

	// Second increment
	s.NoError(s.repo.IncrementWebhookAttempts(s.ctx, ref))
	sub, _ = s.repo.GetByID(s.ctx, subID)
	s.Equal(2, sub.WebhookAttempts)
}

func (s *SubscriptionRepoSuite) TestIncrementWebhookAttempts_UnknownRefReturnsError() {
	err := s.repo.IncrementWebhookAttempts(s.ctx, "nonexistent-ref")
	s.Error(err)
	s.Contains(err.Error(), "not found")
}

// ============================================================================
// VENDOR TIER SYNC — trigger_sync_vendor_tier behaviour
// ============================================================================

// INVARIANT: When the last active subscription is cancelled,
// trigger_sync_vendor_tier must revert vendor.subscription_tier to 'free'.
func TestVendorTierRevertToFreeOnCancellation(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := reposub.NewSubscriptionRepository(db)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db,
			"subscriptions", "vendors", "users",
		)
	})

	vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
		SubscriptionTier: "free",
	})

	subID := testhelper.CreateTestSubscription(t, db, testhelper.SubscriptionSeedOpts{
		VendorID: vendorID,
		Tier:     "featured",
		Status:   "active",
	})

	// Confirm vendor tier was synced to featured by trigger on seed insert
	var tier string
	err := db.Get(&tier, `SELECT subscription_tier FROM vendors WHERE id = $1`, vendorID)
	require.NoError(t, err)
	assert.Equal(t, "featured", tier,
		"trigger_sync_vendor_tier must set vendor tier to featured after active sub inserted")

	// Cancel the subscription
	require.NoError(t, repo.UpdateStatus(ctx, subID, models.SubStatusCancelled))

	// Vendor must revert to free
	err = db.Get(&tier, `SELECT subscription_tier FROM vendors WHERE id = $1`, vendorID)
	require.NoError(t, err)
	assert.Equal(t, "free", tier,
		"trigger_sync_vendor_tier must revert vendor tier to free when last active sub is cancelled")
}

// UNIQUE REFERENCE: Two subscriptions cannot share a payment_reference.
func TestUniquePaymentReferenceConstraint(t *testing.T) {
	db := testhelper.NewTestDB(t)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db, "subscriptions", "vendors", "users")
	})

	ref := fmt.Sprintf("SHARED-REF-%s", uuid.New())
	expiry := time.Now().AddDate(0, 1, 0)

	v1 := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{})
	v2 := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{})

	sub1 := &models.Subscription{
		VendorID:         v1,
		Tier:             models.TierPremium,
		Status:           models.SubStatusActive,
		StartsAt:         time.Now().UTC(),
		ExpiresAt:        sql.NullTime{Time: expiry, Valid: true},
		Price:            700_000,
		Currency:         "NGN",
		PaymentReference: sql.NullString{String: ref, Valid: true},
	}

	repo := reposub.NewSubscriptionRepository(db)
	_, err := repo.Create(ctx, sub1)
	require.NoError(t, err)

	// Second subscription with same reference must be rejected
	sub2 := &models.Subscription{
		VendorID:         v2,
		Tier:             models.TierPremium,
		Status:           models.SubStatusActive,
		StartsAt:         time.Now().UTC(),
		ExpiresAt:        sql.NullTime{Time: expiry, Valid: true},
		Price:            700_000,
		Currency:         "NGN",
		PaymentReference: sql.NullString{String: ref, Valid: true}, // duplicate
	}

	_, err = repo.Create(ctx, sub2)
	assert.Error(t, err, "unique_payment_reference constraint must reject duplicate references")
}