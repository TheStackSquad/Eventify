// pkg/services/vendor/vendor_analytics_integration_test.go
//
// Integration tests for the analytics layer.
// Exercises the full stack: service → optimized repo → real DB.
package vendor_test

import (
	"context"
	"testing"
	"time"

	"github.com/eventify/backend/pkg/models"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	servicevendor "github.com/eventify/backend/pkg/services/vendor"
	"github.com/eventify/backend/pkg/testhelper"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// ============================================================================
// SUITE SETUP
// ============================================================================

type VendorAnalyticsSuite struct {
	suite.Suite
	db             *sqlx.DB
	analyticsRepo  repovendor.VendorAnalyticsOptimizedRepository
	analyticsService servicevendor.VendorAnalyticsService
	ctx            context.Context
}

func TestVendorAnalyticsSuite(t *testing.T) {
	suite.Run(t, new(VendorAnalyticsSuite))
}

func (s *VendorAnalyticsSuite) SetupSuite() {
	s.db = testhelper.NewTestDB(s.T())
	s.analyticsRepo = repovendor.NewVendorAnalyticsOptimizedRepository(s.db)
	s.analyticsService = servicevendor.NewVendorAnalyticsService(s.analyticsRepo)
	s.ctx = context.Background()
}

func (s *VendorAnalyticsSuite) TearDownTest() {
	testhelper.TruncateTables(s.T(), s.db,
		"profile_views", "reviews", "inquiries", "subscriptions",
		"vendor_stats", "vendor_trust_score", "vendors", "users",
	)
}

// ============================================================================
// OWNERSHIP CHECK (SECURITY)
// ============================================================================

// This test is the critical security regression for the ownership check
// that was added directly to the service layer.
func (s *VendorAnalyticsSuite) TestGetVendorAnalytics_OwnershipEnforced() {
	rightOwner := testhelper.CreateTestUser(s.T(), s.db)
	wrongOwner := testhelper.CreateTestUser(s.T(), s.db)

	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		OwnerID: rightOwner,
		Status:  "active",
	})

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	// Correct owner gets analytics
	analytics, err := s.analyticsService.GetVendorAnalytics(s.ctx, vendorID, rightOwner)
	s.NoError(err)
	s.NotNil(analytics)

	// Wrong user is denied — and crucially, does NOT get a 403 (would confirm vendor exists)
	// Instead the service returns "vendor not found" to avoid leaking valid IDs
	_, err = s.analyticsService.GetVendorAnalytics(s.ctx, vendorID, wrongOwner)
	s.Error(err)
	s.Equal("vendor not found", err.Error(),
		"unauthorized access must return 'vendor not found' (not 'unauthorized') to prevent ID enumeration")
}

func (s *VendorAnalyticsSuite) TestGetVendorAnalytics_NonExistentVendor() {
	userID := testhelper.CreateTestUser(s.T(), s.db)

	_, err := s.analyticsService.GetVendorAnalytics(s.ctx, uuid.New(), userID)
	s.Error(err)
	s.Equal("vendor not found", err.Error())
}

// ============================================================================
// NEW VENDOR — ALL ZEROS / NULL HANDLING
// ============================================================================

// A brand-new vendor with no activity should return clean zeros throughout,
// not NULLs that would crash JSON serialisation or frontend rendering.
func (s *VendorAnalyticsSuite) TestGetCompleteVendorAnalytics_NewVendorAllZeros() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		OwnerID:            ownerID,
		Name:               "Brand New Vendor",
		IsIdentityVerified: true,
	})

	// Refresh materialised views so the new vendor appears in analytics joins
	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	data, err := s.analyticsRepo.GetCompleteVendorAnalytics(s.ctx, vendorID)
	s.Require().NoError(err)

	// All time-period metrics should be 0, never -1 or garbage
	s.Equal(0, data.Inquiries7d, "new vendor: inquiries_7d must be 0")
	s.Equal(0, data.Inquiries30d, "new vendor: inquiries_30d must be 0")
	s.Equal(0, data.Reviews7d, "new vendor: reviews_7d must be 0")
	s.Equal(0, data.Reviews30d, "new vendor: reviews_30d must be 0")
	s.Equal(0.0, data.AvgRating7d, "new vendor: avg_rating_7d must be 0.0")
	s.Equal(0.0, data.AvgRating30d, "new vendor: avg_rating_30d must be 0.0")
	s.Equal(0.0, data.AvgRatingAll, "new vendor: avg_rating_all must be 0.0")

	// Rating distribution must be 0, not nil
	s.Equal(0, data.FiveStar)
	s.Equal(0, data.FourStar)
	s.Equal(0, data.ThreeStar)
	s.Equal(0, data.TwoStar)
	s.Equal(0, data.OneStar)

	// Views fallback (no vendor_stats row) must be 0
	s.Equal(0, data.ViewsTotal)
	s.Equal(0, data.Views30d)

	// Recent lists must be empty arrays, NOT nil (JSON null would break frontend)
	s.NotNil(data.RecentInquiries, "RecentInquiries must be an empty slice, not nil")
	s.NotNil(data.RecentReviews, "RecentReviews must be an empty slice, not nil")
	s.Len(data.RecentInquiries, 0)
	s.Len(data.RecentReviews, 0)

	// Tier defaults to "free" when no subscription exists
	s.Equal("free", data.Tier, "no subscription → tier must default to 'free'")
}

// ============================================================================
// VENDOR WITH ACTIVITY
// ============================================================================

func (s *VendorAnalyticsSuite) TestGetCompleteVendorAnalytics_WithActivityReflected() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		OwnerID:            ownerID,
		IsIdentityVerified: true,
	})

	// Add reviews in different time windows
	recent := time.Now().AddDate(0, 0, -3) // 3 days ago — within 7d and 30d
	old := time.Now().AddDate(0, 0, -40)   // 40 days ago — outside both windows

	testhelper.CreateTestReview(s.T(), s.db, testhelper.ReviewSeedOpts{
		VendorID:  vendorID,
		Rating:    5,
		CreatedAt: &recent,
	})
	testhelper.CreateTestReview(s.T(), s.db, testhelper.ReviewSeedOpts{
		VendorID:  vendorID,
		Rating:    4,
		CreatedAt: &recent,
	})
	testhelper.CreateTestReview(s.T(), s.db, testhelper.ReviewSeedOpts{
		VendorID:  vendorID,
		Rating:    3,
		CreatedAt: &old, // should count in total but NOT in 7d/30d
	})

	// Add inquiries
	testhelper.CreateTestInquiry(s.T(), s.db, testhelper.InquirySeedOpts{
		VendorID: vendorID, CreatedAt: &recent,
	})
	testhelper.CreateTestInquiry(s.T(), s.db, testhelper.InquirySeedOpts{
		VendorID: vendorID, CreatedAt: &old,
	})

	// Refresh materialised view to pick up the seeded data
	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	data, err := s.analyticsRepo.GetCompleteVendorAnalytics(s.ctx, vendorID)
	s.Require().NoError(err)

	// 7-day window: 1 inquiry, 2 reviews
	s.Equal(1, data.Inquiries7d, "only inquiry within 7d should count")
	s.Equal(2, data.Reviews7d, "only reviews within 7d should count")

	// 30-day window: 1 inquiry (old one is 40d), 2 reviews
	s.Equal(1, data.Inquiries30d)
	s.Equal(2, data.Reviews30d)

	// Total counts: 2 inquiries, 3 reviews (all time)
	s.Equal(2, data.TotalInquiries)
	s.Equal(3, data.TotalReviews)

	// Average all-time rating: (5+4+3)/3 = 4.0
	s.InDelta(4.0, data.AvgRatingAll, 0.01)

	// Rating distribution
	s.Equal(1, data.FiveStar)
	s.Equal(1, data.FourStar)
	s.Equal(1, data.ThreeStar)
	s.Equal(0, data.TwoStar)
	s.Equal(0, data.OneStar)
}

// ============================================================================
// RECENT INQUIRIES / REVIEWS (limit = 5)
// ============================================================================

func (s *VendorAnalyticsSuite) TestGetCompleteVendorAnalytics_RecentDataCappedAt5() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{OwnerID: ownerID})

	// Seed 7 inquiries and 7 reviews
	for i := 0; i < 7; i++ {
		testhelper.CreateTestInquiry(s.T(), s.db, testhelper.InquirySeedOpts{VendorID: vendorID})
		testhelper.CreateTestReview(s.T(), s.db, testhelper.ReviewSeedOpts{VendorID: vendorID, Rating: 4})
	}

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	data, err := s.analyticsRepo.GetCompleteVendorAnalytics(s.ctx, vendorID)
	s.Require().NoError(err)

	s.LessOrEqual(len(data.RecentInquiries), 5,
		"recent_inquiries must be capped at 5 (query uses LIMIT 5)")
	s.LessOrEqual(len(data.RecentReviews), 5,
		"recent_reviews must be capped at 5")
}

// ============================================================================
// SUBSCRIPTION TIER RESOLUTION
// ============================================================================

func (s *VendorAnalyticsSuite) TestGetCompleteVendorAnalytics_ActiveSubscriptionResolvedCorrectly() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{OwnerID: ownerID})

	// Add an active premium subscription
	testhelper.CreateTestSubscription(s.T(), s.db, testhelper.SubscriptionSeedOpts{
		VendorID: vendorID,
		Tier:     "premium",
		Status:   "active",
	})

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	data, err := s.analyticsRepo.GetCompleteVendorAnalytics(s.ctx, vendorID)
	s.Require().NoError(err)
	s.Equal("premium", data.Tier)
	s.Equal("active", data.SubscriptionStatus)
}

func (s *VendorAnalyticsSuite) TestGetCompleteVendorAnalytics_ExpiredSubscriptionDefaultsToFree() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{OwnerID: ownerID})

	expiredAt := time.Now().Add(-24 * time.Hour) // expired yesterday
	testhelper.CreateTestSubscription(s.T(), s.db, testhelper.SubscriptionSeedOpts{
		VendorID:  vendorID,
		Tier:      "premium",
		Status:    "active",
		ExpiresAt: &expiredAt,
	})

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	data, err := s.analyticsRepo.GetCompleteVendorAnalytics(s.ctx, vendorID)
	s.Require().NoError(err)
	// The optimized query filters: expires_at IS NULL OR expires_at > NOW()
	// An expired subscription must NOT count as active
	s.Equal("free", data.Tier,
		"expired subscription must fall back to 'free' tier (query filters on expires_at > NOW())")
}

// ============================================================================
// RESPONSE TRANSFORMATION
// ============================================================================

func (s *VendorAnalyticsSuite) TestGetVendorAnalytics_ResponseStructureIsComplete() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		OwnerID:            ownerID,
		Name:               "Full Response Vendor",
		Category:           "Catering",
		IsIdentityVerified: true,
	})

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	resp, err := s.analyticsService.GetVendorAnalytics(s.ctx, vendorID, ownerID)
	s.Require().NoError(err)
	s.Require().NotNil(resp)

	// Top-level IDs and names
	s.Equal(vendorID.String(), resp.VendorID)
	s.Equal("Full Response Vendor", resp.VendorName)
	s.Equal("Catering", resp.Category)

	// Overview — must be populated
	s.GreaterOrEqual(resp.Overview.CurrentPVSScore, 0)
	s.True(resp.Overview.IsIdentityVerified)

	// Inquiries struct must be initialised
	s.NotNil(resp.Inquiries.RecentInquiries)

	// Reviews struct must be initialised
	s.NotNil(resp.Reviews.RecentReviews)

	// Trends must have both periods
	s.NotNil(resp.Trends.Last7Days)
	s.NotNil(resp.Trends.Last30Days)

	// Performance
	s.True(resp.Performance.IsIdentityVerified)
	s.GreaterOrEqual(resp.Performance.DaysOnPlatform, 0)
	s.NotEmpty(resp.Performance.AccountStatus)
}

func (s *VendorAnalyticsSuite) TestGetVendorAnalytics_AccountStatusNewVendor() {
	ownerID := testhelper.CreateTestUser(s.T(), s.db)
	vendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		OwnerID: ownerID,
	})

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	resp, err := s.analyticsService.GetVendorAnalytics(s.ctx, vendorID, ownerID)
	s.Require().NoError(err)

	// A just-created vendor is fewer than 30 days old
	s.Equal("new", resp.Performance.AccountStatus,
		"vendor created today must have accountStatus='new'")
}

// ============================================================================
// INQUIRY TREND CALCULATION
// ============================================================================

func TestCalculateInquiryTrend(t *testing.T) {
	db := testhelper.NewTestDB(t)
	analyticsRepo := repovendor.NewVendorAnalyticsOptimizedRepository(db)
	svc := servicevendor.NewVendorAnalyticsService(analyticsRepo)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db,
			"profile_views", "reviews", "inquiries", "subscriptions",
			"vendor_stats", "vendor_trust_score", "vendors", "users",
		)
	})

	// Seed a vendor with much higher activity in the last 7 days vs monthly average
	ownerID := testhelper.CreateTestUser(t, db)
	vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{OwnerID: ownerID})

	recent := time.Now().AddDate(0, 0, -2)
	older := time.Now().AddDate(0, 0, -20)

	// 5 inquiries in last 7 days, 1 older one → weekly surge
	for i := 0; i < 5; i++ {
		testhelper.CreateTestInquiry(t, db, testhelper.InquirySeedOpts{
			VendorID: vendorID, CreatedAt: &recent,
		})
	}
	testhelper.CreateTestInquiry(t, db, testhelper.InquirySeedOpts{
		VendorID: vendorID, CreatedAt: &older,
	})

	testhelper.RefreshAnalyticsViews(t, db)

	resp, err := svc.GetVendorAnalytics(ctx, vendorID, ownerID)
	require.NoError(t, err)

	// 5 in 7 days vs monthly avg of 6/4.3 ≈ 1.4 per week → 5 > 1.4 * 1.2 → "increasing"
	assert.Equal(t, "increasing", resp.Inquiries.InquiryTrend)
}

// ============================================================================
// GET VENDOR TIER (optimized repo)
// ============================================================================

func TestGetVendorTier(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewVendorAnalyticsOptimizedRepository(db)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db, "subscriptions", "vendors", "users")
	})

	t.Run("no subscription returns TierFree", func(t *testing.T) {
		vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{})
		tier, err := repo.GetVendorTier(ctx, vendorID)
		require.NoError(t, err)
		assert.Equal(t, models.TierFree, tier)
	})

	t.Run("active premium subscription returns TierPremium", func(t *testing.T) {
		vendorID := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{})
		testhelper.CreateTestSubscription(t, db, testhelper.SubscriptionSeedOpts{
			VendorID: vendorID, Tier: "premium", Status: "active",
		})
		tier, err := repo.GetVendorTier(ctx, vendorID)
		require.NoError(t, err)
		assert.Equal(t, models.TierPremium, tier)
	})

	t.Run("non-existent vendor returns error", func(t *testing.T) {
		_, err := repo.GetVendorTier(ctx, uuid.New())
		assert.Error(t, err)
	})
}

// ============================================================================
// CATEGORY RANK
// ============================================================================

func TestGetCategoryRank_MultipleVendors(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorStatsRepo(db)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db, "profile_views", "vendors", "users")
	})

	// Seed 3 caterers; the one with more profile views and higher PVS should rank #1
	highPVS := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
		Name:     "Top Caterer",
		Category: "Catering",
		State:    "Lagos",
		PVSScore: 90,
	})
	medPVS := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
		Name:     "Mid Caterer",
		Category: "Catering",
		State:    "Lagos",
		PVSScore: 50,
	})
	lowPVS := testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
		Name:     "Low Caterer",
		Category: "Catering",
		State:    "Lagos",
		PVSScore: 10,
	})

	// Add profile views for highPVS to boost composite score
	now := time.Now()
	for i := 0; i < 10; i++ {
		testhelper.CreateTestProfileView(t, db, highPVS, now.Add(-time.Duration(i)*time.Hour))
	}

	rank, total, category, err := repo.GetCategoryRank(ctx, highPVS)
	require.NoError(t, err)
	assert.Equal(t, 1, rank, "vendor with highest PVS + views must be ranked #1")
	assert.Equal(t, 3, total, "total vendors in category must be 3")
	assert.Equal(t, "Catering", category)

	// The others should be behind
	rankMed, _, _, _ := repo.GetCategoryRank(ctx, medPVS)
	rankLow, _, _, _ := repo.GetCategoryRank(ctx, lowPVS)
	assert.Greater(t, rankMed, rank)
	assert.Greater(t, rankLow, rankMed)
}

func TestGetCategoryRank_NonExistentVendor(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewPostgresVendorStatsRepo(db)
	ctx := context.Background()

	_, _, _, err := repo.GetCategoryRank(ctx, uuid.New())
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}