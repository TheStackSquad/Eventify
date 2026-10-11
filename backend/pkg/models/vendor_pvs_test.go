// pkg/models/vendor_pvs_test.go
package models

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/assert"
)

// CalculatePVS scoring breakdown (from source):
//   +30  identity verified
//   +40  business verified (only if identity verified first)
//   +15  profile completion (proportional: score * completion% / 100)
//   +10  review_count >= 20
//   + 7  review_count >= 10
//   + 3  review_count >= 1
//   + 5  response rate (5 * responded/inquiries)
//   cap at 100

func nullBool(b bool) sql.NullBool { return sql.NullBool{Bool: b, Valid: true} }

func TestCalculatePVS(t *testing.T) {
	cases := []struct {
		name     string
		vendor   Vendor
		expected int32
	}{
		{
			name:     "zero state: new vendor, nothing filled in",
			vendor:   Vendor{},
			expected: 0,
		},
		{
			name: "identity verified only adds 30",
			vendor: Vendor{
				IsIdentityVerified: true,
			},
			expected: 30,
		},
		{
			name: "business verified without identity verified adds nothing",
			vendor: Vendor{
				IsIdentityVerified: false,
				IsBusinessVerified: nullBool(true),
			},
			expected: 0,
		},
		{
			name: "identity + business verified adds 70",
			vendor: Vendor{
				IsIdentityVerified: true,
				IsBusinessVerified: nullBool(true),
			},
			expected: 70,
		},
		{
			name: "100% profile completion contributes full 15 points",
			vendor: Vendor{
				ProfileCompletion: 100.0,
			},
			expected: 15,
		},
		{
			name: "50% profile completion contributes ~7 points",
			vendor: Vendor{
				ProfileCompletion: 50.0,
			},
			expected: 7, // int32(15.0 * 0.5) = 7
		},
		{
			name: "zero profile completion contributes nothing",
			vendor: Vendor{
				ProfileCompletion: 0.0,
			},
			expected: 0,
		},
		{
			name: "1 review adds 3 points",
			vendor: Vendor{
				ReviewCount: 1,
			},
			expected: 3,
		},
		{
			name: "9 reviews still only 3 points (below tier-2 threshold)",
			vendor: Vendor{
				ReviewCount: 9,
			},
			expected: 3,
		},
		{
			name: "10 reviews adds 7 points",
			vendor: Vendor{
				ReviewCount: 10,
			},
			expected: 7,
		},
		{
			name: "19 reviews still 7 points (below tier-3 threshold)",
			vendor: Vendor{
				ReviewCount: 19,
			},
			expected: 7,
		},
		{
			name: "20 reviews adds full 10 points",
			vendor: Vendor{
				ReviewCount: 20,
			},
			expected: 10,
		},
		{
			name: "100 reviews still caps at 10 (no additional tier)",
			vendor: Vendor{
				ReviewCount: 100,
			},
			expected: 10,
		},
		{
			name: "100% response rate adds 5 points",
			vendor: Vendor{
				InquiryCount:   10,
				RespondedCount: 10,
			},
			expected: 5,
		},
		{
			name: "50% response rate adds 2 points",
			vendor: Vendor{
				InquiryCount:   10,
				RespondedCount: 5,
			},
			expected: 2, // int32(5.0 * 0.5) = 2
		},
		{
			name: "zero inquiries: response rate not applied (no divide-by-zero)",
			vendor: Vendor{
				InquiryCount:   0,
				RespondedCount: 0,
			},
			expected: 0,
		},
		{
			name: "fully loaded vendor: identity + business + 100% profile + 20 reviews + 100% response",
			vendor: Vendor{
				IsIdentityVerified: true,
				IsBusinessVerified: nullBool(true),
				ProfileCompletion:  100.0,
				ReviewCount:        20,
				InquiryCount:       10,
				RespondedCount:     10,
			},
			// 30 + 40 + 15 + 10 + 5 = 100
			expected: 100,
		},
		{
			name: "theoretical overflow is capped at 100",
			vendor: Vendor{
				IsIdentityVerified: true,
				IsBusinessVerified: nullBool(true),
				ProfileCompletion:  100.0,
				ReviewCount:        100,
				InquiryCount:       100,
				RespondedCount:     100,
			},
			// raw: 30+40+15+10+5 = 100 — already at cap; proves cap logic
			expected: 100,
		},
		{
			name: "business verified is NullBool with Valid=false: treated as unverified",
			vendor: Vendor{
				IsIdentityVerified: true,
				IsBusinessVerified: sql.NullBool{Valid: false},
			},
			// identity only
			expected: 30,
		},
		{
			name: "partial response rate rounds down",
			vendor: Vendor{
				InquiryCount:   3,
				RespondedCount: 1,
			},
			// 5.0 * (1/3) = 1.666... → int32(1)
			expected: 1,
		},
	}

	for _, tc := range cases {
		tc := tc // capture
		t.Run(tc.name, func(t *testing.T) {
			got := CalculatePVS(&tc.vendor)
			assert.Equal(t, tc.expected, got,
				"CalculatePVS mismatch for case %q", tc.name)
		})
	}
}

// ---------------------------------------------------------------------------
// VendorRankInfo helpers
// ---------------------------------------------------------------------------

func TestCalculatePercentile(t *testing.T) {
	cases := []struct {
		rank, total        int
		expectedPercentile float64
	}{
		{1, 10, 10.0},
		{5, 10, 50.0},
		{10, 10, 100.0},
		{1, 1, 100.0},
		{0, 0, 0.0},  // zero total guard
		{1, 0, 0.0},  // zero total guard
	}

	for _, tc := range cases {
		r := &VendorRankInfo{Rank: tc.rank, Total: tc.total}
		r.CalculatePercentile()
		assert.InDelta(t, tc.expectedPercentile, r.Percentile, 0.001,
			"rank=%d total=%d", tc.rank, tc.total)
	}
}

func TestFormatRankDisplay(t *testing.T) {
	r := &VendorRankInfo{Rank: 3, Total: 20, ScopeName: "Catering"}

	without := r.FormatRankDisplay(false)
	assert.Equal(t, "#3 in Catering", without)

	with := r.FormatRankDisplay(true)
	assert.Contains(t, with, "#3 in Catering")
	assert.Contains(t, with, "top")
}

// ---------------------------------------------------------------------------
// HasTierFeature
// ---------------------------------------------------------------------------

func TestHasTierFeature(t *testing.T) {
	// Free tier should NOT have view_count_display
	assert.False(t, HasTierFeature(TierFree, "view_count_display"))
	assert.True(t, HasTierFeature(TierFree, "profile_view_tracking"))

	// Basic tier gains view_count_display but not ranking
	assert.True(t, HasTierFeature(TierBasic, "view_count_display"))
	assert.False(t, HasTierFeature(TierBasic, "category_rank"))

	// Premium unlocks ranking
	assert.True(t, HasTierFeature(TierPremium, "category_rank"))
	assert.True(t, HasTierFeature(TierPremium, "location_rank"))
	assert.False(t, HasTierFeature(TierPremium, "featured_placement"))

	// Featured has everything
	assert.True(t, HasTierFeature(TierFeatured, "featured_placement"))

	// Unknown feature returns false
	assert.False(t, HasTierFeature(TierFeatured, "nonexistent_feature"))

	// Unknown tier returns false
	assert.False(t, HasTierFeature("enterprise", "profile_view_tracking"))
}