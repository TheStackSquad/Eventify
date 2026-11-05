// backend/pkg/models/vendor_analytics.go

package models

import "time"

// ---------------------------------------------------------------------------
// Internal DTOs — used by the analytics repo and service layers only.
// These are never serialised to the client directly.
// ---------------------------------------------------------------------------

// VendorBasicInfo is fetched once per analytics request (Phase 1).
// It carries the core vendor fields the service needs to build the response,
// and increments profile_views as a side effect in the repo query.
type VendorBasicInfo struct {
	ID                 string    `db:"id"`
	Name               string    `db:"name"`
	Category           string    `db:"category"`
	PVSScore           int       `db:"pvs_score"`
	ReviewCount        int       `db:"review_count"`
	ProfileViews       int       `db:"profile_views"`          // incremented on each fetch
	IsIdentityVerified bool      `db:"is_identity_verified"`
	IsBusinessVerified bool      `db:"is_business_verified"`
	CACNumber          string    `db:"cac_number"`
	ProfileCompletion  float32   `db:"profile_completion"`
	InquiryCount       int       `db:"inquiry_count"`
	RespondedCount     int       `db:"responded_count"`
	CreatedAt          time.Time `db:"created_at"`
	UpdatedAt          time.Time `db:"updated_at"`
}

// VendorTrustScore holds the pre-calculated PVS score and review count.
// Fetched alongside VendorBasicInfo in Phase 1. Non-fatal if missing.
// type VendorTrustScore struct {
// 	TotalTrustWeight int `db:"total_trust_weight"`
// }

// ReviewMetricsRaw is the raw review data returned by the metrics repo.
// Surfaced directly to the client for Premium+ vendors via VendorAnalyticsResponse.
type ReviewMetricsRaw struct {
	TotalReviews    int            `json:"totalReviews"`
	ApprovedReviews int            `json:"approvedReviews"`
	PendingReviews  int            `json:"pendingReviews"`
	AverageRating   float64        `json:"averageRating"`
	RatingCounts    map[int]int    `json:"ratingCounts"` // rating (1-5) → count
}

// RecentInquiry is a single inquiry summary. Surfaced for Basic+ vendors.
type RecentInquiry struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Email     string    `json:"email" db:"email"`
	Message   string    `json:"message" db:"message"`       // truncated to 100 chars in the repo
	Status    string    `json:"status" db:"status"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

// RecentReview is a single review summary. Surfaced for Premium+ vendors.
type RecentReview struct {
	ID         string    `json:"id" db:"id"`
	Rating     int       `json:"rating" db:"rating"`
	Comment    string    `json:"comment" db:"comment"`       // truncated to 150 chars in the repo
	UserName   string    `json:"userName" db:"user_name"`
	IsApproved bool      `json:"isApproved" db:"is_approved"`
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
}