//backend/ pkg/models/subscription_model_test.go
//
// Pure unit tests — no database, no network.
// Proves the business rules encoded in the Subscription model are correct.
package models_test

import (
	"database/sql"
	"testing"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// ============================================================================
// STATE MACHINE — CanTransitionTo
// ============================================================================

func TestCanTransitionTo(t *testing.T) {
	cases := []struct {
		name      string
		from      models.SubscriptionStatus
		to        models.SubscriptionStatus
		wantAllow bool
	}{
		// Valid transitions
		{"pending → active", models.SubStatusPending, models.SubStatusActive, true},
		{"pending → cancelled", models.SubStatusPending, models.SubStatusCancelled, true},
		{"active → expired", models.SubStatusActive, models.SubStatusExpired, true},
		{"active → cancelled", models.SubStatusActive, models.SubStatusCancelled, true},
		{"expired → active (renewal)", models.SubStatusExpired, models.SubStatusActive, true},

		// Invalid transitions
		{"cancelled → active", models.SubStatusCancelled, models.SubStatusActive, false},
		{"cancelled → expired", models.SubStatusCancelled, models.SubStatusExpired, false},
		{"cancelled → pending", models.SubStatusCancelled, models.SubStatusPending, false},
		{"active → pending", models.SubStatusActive, models.SubStatusPending, false},
		{"expired → pending", models.SubStatusExpired, models.SubStatusPending, false},
		{"expired → cancelled", models.SubStatusExpired, models.SubStatusCancelled, false},
		{"pending → expired", models.SubStatusPending, models.SubStatusExpired, false},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			sub := &models.Subscription{Status: tc.from}
			got := sub.CanTransitionTo(tc.to)
			assert.Equal(t, tc.wantAllow, got,
				"transition %s → %s: expected allowed=%v", tc.from, tc.to, tc.wantAllow)
		})
	}
}

// ============================================================================
// TIER RANKING — Rank()
// ============================================================================

func TestTierRank(t *testing.T) {
	// Ranks must be strictly ascending: free < basic < premium < featured
	assert.Less(t, models.TierFree.Rank(), models.TierBasic.Rank())
	assert.Less(t, models.TierBasic.Rank(), models.TierPremium.Rank())
	assert.Less(t, models.TierPremium.Rank(), models.TierFeatured.Rank())

	// Unknown tier defaults to 0 (same as free)
	assert.Equal(t, 0, models.SubscriptionTier("unknown").Rank())
}

// ============================================================================
// FEATURES — GetFeatures (additive up the tier ladder)
// ============================================================================

func TestGetFeatures_Additive(t *testing.T) {
	free := models.GetFeatures(models.TierFree)
	basic := models.GetFeatures(models.TierBasic)
	premium := models.GetFeatures(models.TierPremium)
	featured := models.GetFeatures(models.TierFeatured)

	// Free has nothing
	assert.False(t, free.EnhancedProfile, "free tier must have no features")
	assert.False(t, free.BasicAnalytics)

	// Basic: enhanced profile + basic analytics + recent inquiries
	assert.True(t, basic.EnhancedProfile)
	assert.True(t, basic.BasicAnalytics)
	assert.True(t, basic.RecentInquiries)
	assert.False(t, basic.PriorityListing, "basic must not have priority listing")
	assert.False(t, basic.DetailedAnalytics, "basic must not have detailed analytics")

	// Premium: all basic features + more
	assert.True(t, premium.EnhancedProfile)
	assert.True(t, premium.PriorityListing)
	assert.True(t, premium.DetailedAnalytics)
	assert.True(t, premium.VerifiedBadge)
	assert.False(t, premium.FeaturedPlacement, "premium must not have featured placement")
	assert.False(t, premium.GoldBadge, "premium must not have gold badge")

	// Featured: everything
	assert.True(t, featured.FeaturedPlacement)
	assert.True(t, featured.GoldBadge)
	assert.True(t, featured.CategoryBoost)
	assert.True(t, featured.HomepageRotation)
}

func TestGetFeatures_UnknownTierDefaultsToFree(t *testing.T) {
	f := models.GetFeatures(models.SubscriptionTier("nonexistent"))
	assert.False(t, f.EnhancedProfile, "unknown tier must default to free (no features)")
}

// ============================================================================
// PRICING — GetPricing
// ============================================================================

func TestGetPricing(t *testing.T) {
	free := models.GetPricing(models.TierFree)
	basic := models.GetPricing(models.TierBasic)
	premium := models.GetPricing(models.TierPremium)
	featured := models.GetPricing(models.TierFeatured)

	// Free is always zero
	assert.Equal(t, int64(0), free.MinKobo)
	assert.Equal(t, int64(0), free.MaxKobo)

	// Prices are positive and increasing
	assert.Greater(t, basic.MinKobo, int64(0))
	assert.Greater(t, premium.MinKobo, basic.MaxKobo,
		"premium min must exceed basic max")
	assert.Greater(t, featured.MinKobo, premium.MaxKobo,
		"featured min must exceed premium max")

	// Max >= Min within each tier
	assert.GreaterOrEqual(t, basic.MaxKobo, basic.MinKobo)
	assert.GreaterOrEqual(t, premium.MaxKobo, premium.MinKobo)
	assert.GreaterOrEqual(t, featured.MaxKobo, featured.MinKobo)
}

func TestGetPricing_UnknownTierReturnsZero(t *testing.T) {
	p := models.GetPricing(models.SubscriptionTier("bogus"))
	assert.Equal(t, int64(0), p.MinKobo)
	assert.Equal(t, int64(0), p.MaxKobo)
}

// ============================================================================
// BADGE COLOUR — ResolveBadgeColor
// ============================================================================

func TestResolveBadgeColor(t *testing.T) {
	activeTime := sql.NullTime{Time: time.Now().AddDate(0, 1, 0), Valid: true}

	cases := []struct {
		name      string
		tier      models.SubscriptionTier
		status    models.SubscriptionStatus
		wantColor string
	}{
		{"featured active → gold", models.TierFeatured, models.SubStatusActive, "gold"},
		{"premium active → silver", models.TierPremium, models.SubStatusActive, "silver"},
		{"basic active → bronze", models.TierBasic, models.SubStatusActive, "bronze"},
		{"free active → empty", models.TierFree, models.SubStatusActive, ""},
		{"premium expired → empty", models.TierPremium, models.SubStatusExpired, ""},
		{"premium cancelled → empty", models.TierPremium, models.SubStatusCancelled, ""},
		{"nil subscription → empty", models.TierFree, "", ""}, // handled via nil sub
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			v := &models.VendorWithSubscription{}

			if tc.status != "" {
				v.Subscription = &models.Subscription{
					ID:        uuid.New(),
					Tier:      tc.tier,
					Status:    tc.status,
					ExpiresAt: activeTime,
				}
			}
			// nil subscription case tests the nil guard

			got := v.ResolveBadgeColor()
			assert.Equal(t, tc.wantColor, got)
		})
	}
}