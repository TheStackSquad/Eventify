// pkg/repository/vendor/vendor_leaderboard_integration_test.go
//
// Integration tests for VendorLeaderboardRepo and VendorLeaderboardService.
// These tests are sensitive to the materialized view definitions, particularly:
//   - vendor_of_the_month: only includes status='active' AND tier IN ('premium','featured')
//   - vendor_daily_metrics: requires REFRESH after seeding
package vendor_test

import (
	"context"
	"testing"

	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	servicevendor "github.com/eventify/backend/pkg/services/vendor"
	"github.com/eventify/backend/pkg/testhelper"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// ============================================================================
// SUITE
// ============================================================================

type VendorLeaderboardSuite struct {
	suite.Suite
	db              *sqlx.DB
	leaderboardRepo *repovendor.VendorLeaderboardRepo
	leaderboardSvc  servicevendor.VendorLeaderboardService
	ctx             context.Context
}

func TestVendorLeaderboardSuite(t *testing.T) {
	suite.Run(t, new(VendorLeaderboardSuite))
}

func (s *VendorLeaderboardSuite) SetupSuite() {
	s.db = testhelper.NewTestDB(s.T())
	s.leaderboardRepo = repovendor.NewVendorLeaderboardRepo(s.db)
	s.leaderboardSvc = servicevendor.NewVendorLeaderboardService(s.leaderboardRepo)
	s.ctx = context.Background()
}

func (s *VendorLeaderboardSuite) TearDownTest() {
	testhelper.TruncateTables(s.T(), s.db,
		"profile_views", "reviews", "inquiries", "subscriptions",
		"vendor_stats", "vendor_trust_score", "vendors", "users",
	)
}

// ============================================================================
// MATERIALIZED VIEW VISIBILITY RULES
// ============================================================================

// The vendor_of_the_month view definition includes:
//   WHERE v.status = 'active' AND subscription_tier IN ('premium', 'featured')
// Free and basic vendors must NOT appear in leaderboards.
func (s *VendorLeaderboardSuite) TestLeaderboard_OnlyPremiumAndFeaturedVendorsAppear() {
	// Seed vendors at every tier
	freeID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name: "Free Vendor", Category: "Catering", SubscriptionTier: "free", Status: "active", PVSScore: 80,
	})
	basicID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name: "Basic Vendor", Category: "Catering", SubscriptionTier: "basic", Status: "active", PVSScore: 80,
	})
	premiumID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name: "Premium Vendor", Category: "Catering", SubscriptionTier: "premium", Status: "active", PVSScore: 90,
	})
	featuredID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name: "Featured Vendor", Category: "Catering", SubscriptionTier: "featured", Status: "active", PVSScore: 95,
	})

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	rankings, err := s.leaderboardSvc.GetTopVendorsByCategory(s.ctx, "Catering", 10)
	s.Require().NoError(err)

	ids := make([]interface{}, len(rankings))
	for i, r := range rankings {
		ids[i] = r.VendorID
	}

	// Premium and featured must appear
	s.Contains(ids, premiumID, "premium vendor must appear in category leaderboard")
	s.Contains(ids, featuredID, "featured vendor must appear in category leaderboard")

	// Free and basic must NOT appear
	s.NotContains(ids, freeID,
		"free tier vendor must be EXCLUDED from leaderboard (view filter: subscription_tier IN ('premium','featured'))")
	s.NotContains(ids, basicID,
		"basic tier vendor must be EXCLUDED from leaderboard")
}

func (s *VendorLeaderboardSuite) TestLeaderboard_SuspendedVendorDoesNotAppear() {
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name:             "Suspended Premium",
		Category:         "Photography",
		SubscriptionTier: "premium",
		Status:           "suspended", // NOT active
		PVSScore:         99,
	})

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	rankings, err := s.leaderboardSvc.GetTopVendorsByCategory(s.ctx, "Photography", 10)
	s.Require().NoError(err)

	for _, r := range rankings {
		s.NotEqual("Suspended Premium", r.Name,
			"suspended vendor must not appear in leaderboard (view filter: status = 'active')")
	}
}

func (s *VendorLeaderboardSuite) TestLeaderboard_SoftDeletedVendorDoesNotAppear() {
	deletedID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name:             "Deleted Premium",
		Category:         "Decoration",
		SubscriptionTier: "premium",
		Status:           "active", // start active
		PVSScore:         85,
	})

	// Soft-delete (sets status = 'deleted')
	testhelper.SoftDeleteVendor(s.T(), s.db, deletedID)

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	rankings, err := s.leaderboardSvc.GetTopVendorsByCategory(s.ctx, "Decoration", 10)
	s.Require().NoError(err)

	for _, r := range rankings {
		s.NotEqual(deletedID, r.VendorID,
			"soft-deleted vendor must not appear in leaderboard")
	}
}

// ============================================================================
// CATEGORY RANKING
// ============================================================================

func (s *VendorLeaderboardSuite) TestGetTopVendorsByCategory_OrderedByRank() {
	// High PVS + high views wins
	topVendorID := testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name:             "Category King",
		Category:         "Music",
		SubscriptionTier: "featured",
		Status:           "active",
		PVSScore:         95,
	})
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name:             "Category Runner",
		Category:         "Music",
		SubscriptionTier: "premium",
		Status:           "active",
		PVSScore:         60,
	})

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	rankings, err := s.leaderboardSvc.GetTopVendorsByCategory(s.ctx, "Music", 10)
	s.Require().NoError(err)
	s.GreaterOrEqual(len(rankings), 2)

	// First rank must be the highest PVS vendor
	s.Equal(topVendorID, rankings[0].VendorID,
		"vendor with highest PVS score must hold rank 1")
	s.Equal(1, rankings[0].CategoryRank,
		"category_rank field must be 1 for the top vendor")
}

func (s *VendorLeaderboardSuite) TestGetTopVendorsByCategory_LimitIsRespected() {
	// Seed 5 premium vendors
	for i := 0; i < 5; i++ {
		testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
			Category:         "Entertainment",
			SubscriptionTier: "premium",
			Status:           "active",
		})
	}

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	rankings, err := s.leaderboardSvc.GetTopVendorsByCategory(s.ctx, "Entertainment", 3)
	s.Require().NoError(err)
	s.LessOrEqual(len(rankings), 3, "limit parameter must cap results at 3")
}

func (s *VendorLeaderboardSuite) TestGetTopVendorsByCategory_UnknownCategoryReturnsEmpty() {
	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	rankings, err := s.leaderboardSvc.GetTopVendorsByCategory(s.ctx, "NonExistentCategory9999", 10)
	// Some DB drivers return no rows (not an error) for empty result sets
	if err != nil {
		// If it returns an error, that's acceptable only if it's a "not found" error
		s.Contains(err.Error(), "not found")
	} else {
		s.Empty(rankings, "unknown category must return empty list")
	}
}

// ============================================================================
// LOCATION RANKING
// ============================================================================

func (s *VendorLeaderboardSuite) TestGetTopVendorsByLocation_StateFilter() {
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name:             "Lagos Premium",
		State:            "Lagos",
		SubscriptionTier: "premium",
		Status:           "active",
		PVSScore:         70,
	})
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name:             "Rivers Premium",
		State:            "Rivers",
		SubscriptionTier: "premium",
		Status:           "active",
		PVSScore:         70,
	})

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	rankings, err := s.leaderboardSvc.GetTopVendorsByLocation(s.ctx, "Lagos", "", 10)
	s.Require().NoError(err)

	for _, r := range rankings {
		s.Equal("Lagos", r.State,
			"location filter by state must only return vendors in that state")
	}
}

// ============================================================================
// VENDOR OF THE MONTH
// ============================================================================

func (s *VendorLeaderboardSuite) TestGetVendorOfTheMonth_IsOverallRank1() {
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name:             "VOTM Candidate A",
		SubscriptionTier: "featured",
		Status:           "active",
		PVSScore:         99,
	})
	testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
		Name:             "VOTM Candidate B",
		SubscriptionTier: "premium",
		Status:           "active",
		PVSScore:         70,
	})

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	votm, err := s.leaderboardSvc.GetVendorOfTheMonth(s.ctx)
	s.Require().NoError(err)
	s.Require().NotNil(votm)

	s.Equal(1, votm.OverallRank,
		"vendor of the month must have overall_rank = 1")
	s.Equal("VOTM Candidate A", votm.Name,
		"highest PVS vendor must be vendor of the month")
}

func (s *VendorLeaderboardSuite) TestGetVendorOfTheMonth_ReturnsErrorWhenNoEligibleVendors() {
	// No vendors seeded — materialised view is empty after truncation
	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	_, err := s.leaderboardSvc.GetVendorOfTheMonth(s.ctx)
	s.Error(err, "empty leaderboard must return an error, not nil vendor")
}

// ============================================================================
// ALL CATEGORY LEADERBOARDS
// ============================================================================

func (s *VendorLeaderboardSuite) TestGetAllCategoryLeaderboards_GroupsByCategory() {
	categories := []string{"Catering", "Photography", "Music"}
	for _, cat := range categories {
		testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
			Category:         cat,
			SubscriptionTier: "premium",
			Status:           "active",
			PVSScore:         70,
		})
	}

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	boardMap, err := s.leaderboardSvc.GetAllCategoryLeaderboards(s.ctx, 5)
	s.Require().NoError(err)

	for _, cat := range categories {
		vendors, ok := boardMap[cat]
		s.True(ok, "category %q must appear in leaderboard map", cat)
		for _, v := range vendors {
			s.Equal(cat, v.Category, "vendor in %q key must have matching category", cat)
		}
	}
}

func (s *VendorLeaderboardSuite) TestGetAllCategoryLeaderboards_ZeroLimitDefaultsTo5() {
	// Seed 8 premium vendors in same category
	for i := 0; i < 8; i++ {
		testhelper.CreateTestVendor(s.T(), s.db, testhelper.VendorSeedOpts{
			Category:         "Catering",
			SubscriptionTier: "premium",
			Status:           "active",
		})
	}

	testhelper.RefreshAnalyticsViews(s.T(), s.db)

	// limit=0 should default to 5 in the service
	boardMap, err := s.leaderboardSvc.GetAllCategoryLeaderboards(s.ctx, 0)
	s.Require().NoError(err)

	if vendors, ok := boardMap["Catering"]; ok {
		s.LessOrEqual(len(vendors), 5,
			"limit=0 must default to 5, not return all 8")
	}
}

// ============================================================================
// TABLE-DRIVEN: LEADERBOARD COUNT HEALTH CHECK
// ============================================================================

func TestLeaderboardCount(t *testing.T) {
	db := testhelper.NewTestDB(t)
	repo := repovendor.NewVendorLeaderboardRepo(db)
	svc := servicevendor.NewVendorLeaderboardService(repo)
	ctx := context.Background()

	t.Cleanup(func() {
		testhelper.TruncateTables(t, db,
			"profile_views", "reviews", "inquiries", "subscriptions",
			"vendor_stats", "vendor_trust_score", "vendors", "users",
		)
	})

	t.Run("empty view returns count of 0", func(t *testing.T) {
		testhelper.RefreshAnalyticsViews(t, db)
		count, err := svc.GetLeaderboardCount(ctx)
		require.NoError(t, err)
		assert.Equal(t, 0, count)
	})

	t.Run("eligible vendors increase count", func(t *testing.T) {
		testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
			SubscriptionTier: "premium", Status: "active",
		})
		testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
			SubscriptionTier: "featured", Status: "active",
		})
		// Free vendor should NOT count
		testhelper.CreateTestVendor(t, db, testhelper.VendorSeedOpts{
			SubscriptionTier: "free", Status: "active",
		})

		testhelper.RefreshAnalyticsViews(t, db)

		count, err := svc.GetLeaderboardCount(ctx)
		require.NoError(t, err)
		assert.Equal(t, 2, count,
			"only premium and featured vendors count in leaderboard")
	})
}