//backend/pkg/models/subscription_pricing_test.go

package models_test

import (
	"testing"

	"github.com/eventify/backend/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPriceKobo_PaidTiers(t *testing.T) {
	want := map[models.SubscriptionTier]int64{
		models.TierBasic:    350_000,
		models.TierPremium:  1_000_000,
		models.TierFeatured: 2_500_000,
	}
	for tier, kobo := range want {
		got, ok := models.PriceKobo(tier)
		require.True(t, ok, "tier %q", tier)
		assert.Equal(t, kobo, got, "tier %q", tier)
	}
}

func TestPriceKobo_FreeAndUnknownAreNotPurchasable(t *testing.T) {
	for _, tier := range []models.SubscriptionTier{models.TierFree, "", "platinum", "PREMIUM"} {
		_, ok := models.PriceKobo(tier)
		assert.False(t, ok, "tier %q must not be purchasable", tier)
	}
}

func TestPaidTiers_AllPricedAndAscending(t *testing.T) {
	tiers := models.PaidTiers()
	require.Len(t, tiers, 3)
	var prev int64
	for _, tier := range tiers {
		p, ok := models.PriceKobo(tier)
		require.True(t, ok)
		assert.Greater(t, p, prev, "prices must ascend with tier")
		prev = p
	}
}

func TestGetPlans_MirrorsPriceTableAndFeatures(t *testing.T) {
	plans := models.GetPlans()
	require.Len(t, plans, 3)
	for _, p := range plans {
		price, ok := models.PriceKobo(p.Tier)
		require.True(t, ok)
		assert.Equal(t, price, p.PriceKobo)
		assert.Equal(t, "NGN", p.Currency)
		assert.Equal(t, models.GetFeatures(p.Tier), p.Features)
	}
}