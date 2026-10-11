// backend/pkg/models/vendor_stats.go

package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ============================================================================
// PROFILE VIEWS
// ============================================================================

// ProfileViewRecord represents a single profile view event in the database.
type ProfileViewRecord struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	VendorID  uuid.UUID  `json:"vendor_id" db:"vendor_id"`
	ViewerID  *uuid.UUID `json:"viewer_id,omitempty" db:"viewer_id"` // nil if anonymous
	ViewerIP  string     `json:"viewer_ip" db:"viewer_ip"`
	SessionID string     `json:"session_id" db:"session_id"`
	UserAgent string     `json:"user_agent,omitempty" db:"user_agent"`
	ViewedAt  time.Time  `json:"viewed_at" db:"viewed_at"`
}

// ============================================================================
// RANKINGS
// ============================================================================

type VendorRankInfo struct {
	Rank       int     `json:"rank"`       // Position (1 = best)
	Total      int     `json:"total"`      // Total vendors in group
	ScopeName  string  `json:"scope_name"` // e.g., "Catering"
	ScopeType  string  `json:"scope_type"` // "category" or "location"
	Percentile float64 `json:"percentile"` // Top X%
}

func (r *VendorRankInfo) CalculatePercentile() {
	if r.Total > 0 {
		r.Percentile = (float64(r.Rank) / float64(r.Total)) * 100.0
	} else {
		r.Percentile = 0
	}
}

func (r *VendorRankInfo) FormatRankDisplay(includePercentile bool) string {
	if !includePercentile {
		return fmt.Sprintf("#%d in %s", r.Rank, r.ScopeName)
	}
	r.CalculatePercentile()
	return fmt.Sprintf("#%d in %s (top %.0f%%)", r.Rank, r.ScopeName, r.Percentile)
}

// ============================================================================
// SUBSCRIPTION LOGIC
// ============================================================================

// VendorSubscription maps to the existing subscriptions table
type VendorSubscription struct {
	ID               uuid.UUID          `json:"id" db:"id"`
	VendorID         uuid.UUID          `json:"vendor_id" db:"vendor_id"`
	Tier             SubscriptionTier   `json:"tier" db:"tier"`
	Status           SubscriptionStatus `json:"status" db:"status"`
	Price            int64              `json:"price" db:"price"`
	Currency         string             `json:"currency" db:"currency"`
	PaymentMethod    *string            `json:"payment_method,omitempty" db:"payment_method"`
	PaymentReference *string            `json:"payment_reference,omitempty" db:"payment_reference"`
	StartsAt         time.Time          `json:"starts_at" db:"starts_at"`
	ExpiresAt        *time.Time         `json:"expires_at,omitempty" db:"expires_at"`
	LastPaymentDate  *time.Time         `json:"last_payment_date,omitempty" db:"last_payment_date"`
	NextPaymentDate  *time.Time         `json:"next_payment_date,omitempty" db:"next_payment_date"`
	AutoRenew        bool               `json:"auto_renew" db:"auto_renew"`
	CreatedAt        time.Time          `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time          `json:"updated_at" db:"updated_at"`
}

func (s *VendorSubscription) IsActive() bool {
	if s.Status != SubStatusActive {
		return false
	}
	if s.ExpiresAt != nil && time.Now().After(*s.ExpiresAt) {
		return false
	}
	return true
}

func (s *VendorSubscription) IsExpired() bool {
	if s.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*s.ExpiresAt)
}

func (s *VendorSubscription) HasFeature(feature string) bool {
	if !s.IsActive() {
		return HasTierFeature(TierFree, feature)
	}
	return HasTierFeature(s.Tier, feature)
}

// HasTierFeature defines the permissions for each tier
func HasTierFeature(tier SubscriptionTier, feature string) bool {
	features := map[SubscriptionTier]map[string]bool{
		TierFree: {
			"profile_view_tracking": true,
			"view_count_display":    false,
			"category_rank":         false,
			"location_rank":         false,
		},
		TierBasic: {
			"profile_view_tracking": true,
			"view_count_display":    true,
			"category_rank":         false,
			"location_rank":         false,
		},
		TierPremium: {
			"profile_view_tracking": true,
			"view_count_display":    true,
			"category_rank":         true,
			"location_rank":         true,
		},
		TierFeatured: {
			"profile_view_tracking": true,
			"view_count_display":    true,
			"category_rank":         true,
			"location_rank":         true,
			"featured_placement":    true,
		},
	}

	if tierFeatures, ok := features[tier]; ok {
		return tierFeatures[feature]
	}
	return false
}

// ============================================================================
// API & INTERNAL SCORES
// ============================================================================

type VendorPublicStats struct {
	VendorID         uuid.UUID           `json:"vendor_id"`
	ProfileViews30d  *int                `json:"profile_views_30d,omitempty"`
	CategoryRank     *VendorRankInfo     `json:"category_rank,omitempty"`
	LocationRank     *VendorRankInfo     `json:"location_rank,omitempty"`
	Tier             SubscriptionTier    `json:"tier"`
	TierStatus       SubscriptionStatus  `json:"tier_status"`
	UpgradeAvailable bool                `json:"upgrade_available"`
}

type VendorRankingScore struct {
	VendorID         uuid.UUID `db:"vendor_id"`
	Category         string    `db:"category"`
	State            string    `db:"state"`
	City             *string   `db:"city"`
	Views30d         int       `db:"views_30d"`
	PVSScore         int32     `db:"pvs_score"`
	CompositeScore   float64   `db:"composite_score"`
	CategoryRank     int       `db:"category_rank"`
	LocationRank     int       `db:"location_rank"`
	TotalInCategory  int       `db:"total_in_category"`
	TotalInLocation  int       `db:"total_in_location"`
}

func (v *VendorRankingScore) GetLocationName() string {
	if v.City != nil && *v.City != "" {
		return fmt.Sprintf("%s, %s", *v.City, v.State)
	}
	return v.State
}

type VendorBasicInfo struct {
    ID                 uuid.UUID        `json:"id" db:"id"`
    Name               string           `json:"name" db:"name"`
    Category           string           `json:"category" db:"category"`
    PvsScore           int              `json:"pvs_score" db:"pvs_score"`
    ReviewCount        int              `json:"review_count" db:"review_count"`
    IsIdentityVerified bool             `json:"is_identity_verified" db:"is_identity_verified"`
    CacNumber          string           `json:"cac_number" db:"cac_number"`
    IsBusinessVerified bool             `json:"is_business_verified" db:"is_business_verified"`
    ProfileCompletion  int              `json:"profile_completion" db:"profile_completion"`
    InquiryCount       int              `json:"inquiry_count" db:"inquiry_count"`
    RespondedCount     int              `json:"responded_count" db:"responded_count"`
    CreatedAt          time.Time        `json:"created_at" db:"created_at"`
    UpdatedAt          time.Time        `json:"updated_at" db:"updated_at"`
    
    // Enriched Fields from Joins
    Tier               SubscriptionTier `json:"tier" db:"tier"`
    SubscriptionStatus string           `json:"subscription_status" db:"subscription_status"`
    ViewsTotal         int              `json:"views_total" db:"views_total"`
    Views30d           int              `json:"views_30d" db:"views_30d"`
}