//backend/pkg/models/vendor_ranking,go
package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// VendorRanking represents a vendor's position in leaderboards
type VendorRanking struct {
	// From materialized view
	VendorID         uuid.UUID `db:"vendor_id" json:"vendorId"`
	Name             string    `db:"name" json:"name"`
	Category         string    `db:"category" json:"category"`
	State            string    `db:"state" json:"state"`
	City             string    `db:"city" json:"city,omitempty"`
	SubscriptionTier string    `db:"subscription_tier" json:"subscriptionTier"`
	MonthlyViews     int       `db:"monthly_views" json:"monthlyViews"`
	PVSScore         int       `db:"pvs_score" json:"pvsScore"`
	ReviewCount      int       `db:"review_count" json:"reviewCount"`
	
	// Rankings from view
	OverallRank  int `db:"overall_rank" json:"overallRank,omitempty"`
	CategoryRank int `db:"category_rank" json:"categoryRank,omitempty"`
	LocationRank int `db:"location_rank" json:"locationRank,omitempty"`
	
	// From vendors table JOIN
	ImageURL             string         `db:"image_url" json:"imageUrl"`
	IsIdentityVerified   bool           `db:"is_identity_verified" json:"isIdentityVerified"`
	IsBusinessVerified   sql.NullBool   `db:"is_business_verified" json:"isBusinessVerified"`
	IsBusinessRegistered bool           `db:"is_business_registered" json:"isBusinessRegistered"`
	
	// Metadata
	LastUpdated time.Time `db:"last_updated" json:"lastUpdated,omitempty"`
}
// LeaderboardResponse wraps ranking results for API responses
type LeaderboardResponse struct {
	Type     string          `json:"type"` // "category", "location", "overall"
	Category string          `json:"category,omitempty"`
	Location string          `json:"location,omitempty"`
	Rankings []VendorRanking `json:"rankings"`
	UpdatedAt string         `json:"updated_at"`
}
