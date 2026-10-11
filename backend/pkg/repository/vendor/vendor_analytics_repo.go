// backend/pkg/repository/vendor/vendor_analytics_repo.go

package vendor

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

// VendorCoreMetricsRepository handles fetching pre-calculated metrics.
type VendorCoreMetricsRepository interface {
	GetVendorTrustScore(ctx context.Context, vendorID uuid.UUID) (*models.VendorTrustScore, error)
	GetVendorBasicInfo(ctx context.Context, vendorID uuid.UUID) (*models.VendorBasicInfo, error)
	GetVendorTier(ctx context.Context, vendorID uuid.UUID) (models.SubscriptionTier, error)
}

// VendorMetricsRepository handles aggregated analytics.
type VendorMetricsRepository interface {
	GetInquiryCountByPeriod(ctx context.Context, vendorID uuid.UUID, days int) (int, error)
	GetReviewMetrics(ctx context.Context, vendorID uuid.UUID) (*models.ReviewMetricsRaw, error)
	GetReviewCountByPeriod(ctx context.Context, vendorID uuid.UUID, days int) (int, error)
	GetAverageRatingByPeriod(ctx context.Context, vendorID uuid.UUID, days int) (float64, error)
}

// VendorDataRepository handles detailed lists.
type VendorDataRepository interface {
	GetRecentInquiries(ctx context.Context, vendorID uuid.UUID, limit int) ([]models.RecentInquiry, error)
	GetRecentReviews(ctx context.Context, vendorID uuid.UUID, limit int) ([]models.RecentReview, error)
}

// VendorPublicStatsRepository handles tracking and subscription details.
type VendorPublicStatsRepository interface {
	RecordProfileView(ctx context.Context, vendorID uuid.UUID, viewerID *uuid.UUID, viewerIP string, sessionID string, userAgent string) (bool, error)
	GetProfileViewCount30d(ctx context.Context, vendorID uuid.UUID) (int, error)
	GetCategoryRank(ctx context.Context, vendorID uuid.UUID) (rank int, total int, category string, err error)
	GetLocationRank(ctx context.Context, vendorID uuid.UUID) (rank int, total int, location string, err error)
	GetVendorTier(ctx context.Context, vendorID uuid.UUID) (models.SubscriptionTier, error)
	GetVendorSubscription(ctx context.Context, vendorID uuid.UUID) (*models.VendorWithSubscription, error)
}

// ============================================================================
// NEW: Optimized Single-Query Repository
// ============================================================================

// VendorAnalyticsOptimizedRepository fetches all analytics in ONE query
// UPDATED: Now includes GetVendorTier for tier-based restrictions
type VendorAnalyticsOptimizedRepository interface {
	GetCompleteVendorAnalytics(ctx context.Context, vendorID uuid.UUID) (*models.VendorAnalyticsData, error)
	GetVendorTier(ctx context.Context, vendorID uuid.UUID) (models.SubscriptionTier, error)
	ExistsForOwner(ctx context.Context, vendorID uuid.UUID, ownerID uuid.UUID) (bool, error)
}


// VendorAnalyticsData represents the raw data from the optimized query
// This is used internally and transformed to VendorAnalyticsResponse
type VendorAnalyticsDataRaw struct {
	// Base vendor info
	ID                 uuid.UUID      `db:"id"`
	Name               string         `db:"name"`
	Category           string         `db:"category"`
	PvsScore           int            `db:"pvs_score"`
	ReviewCount        int            `db:"review_count"`
	IsIdentityVerified bool           `db:"is_identity_verified"`
	CacNumber          sql.NullString `db:"cac_number"`
	IsBusinessVerified sql.NullBool `db:"is_business_verified"`
	ProfileCompletion  int            `db:"profile_completion"`
	InquiryCount       int            `db:"inquiry_count"`
	RespondedCount     int            `db:"responded_count"`
	CreatedAt          string         `db:"created_at"`
	UpdatedAt          string         `db:"updated_at"`

	// Subscription info
	Tier               string `db:"tier"`
	SubscriptionStatus string `db:"subscription_status"`

	// Views (can be NULL for new vendors)
	ViewsTotal sql.NullInt64 `db:"views_total"`
	Views30d   sql.NullInt64 `db:"views_30d"`

	// Metrics from materialized view (can be NULL for vendors with no activity)
	Inquiries7d    sql.NullInt64   `db:"inquiries_7d"`
	Reviews7d      sql.NullInt64   `db:"reviews_7d"`
	AvgRating7d    sql.NullFloat64 `db:"avg_rating_7d"`
	Inquiries30d   sql.NullInt64   `db:"inquiries_30d"`
	Reviews30d     sql.NullInt64   `db:"reviews_30d"`
	AvgRating30d   sql.NullFloat64 `db:"avg_rating_30d"`
	TotalInquiries sql.NullInt64   `db:"total_inquiries"`
	TotalReviews   sql.NullInt64   `db:"total_reviews"`
	AvgRatingAll   sql.NullFloat64 `db:"avg_rating_all"`

	// Rating distribution (NULL when no reviews)
	FiveStar  sql.NullInt64 `db:"five_star"`
	FourStar  sql.NullInt64 `db:"four_star"`
	ThreeStar sql.NullInt64 `db:"three_star"`
	TwoStar   sql.NullInt64 `db:"two_star"`
	OneStar   sql.NullInt64 `db:"one_star"`

	// JSON aggregated data
	RecentInquiriesJSON []byte `db:"recent_inquiries"`
	RecentReviewsJSON   []byte `db:"recent_reviews"`
}

// UnmarshalJSON fields into structured data with proper NULL handling
func (d *VendorAnalyticsDataRaw) ToAnalyticsData() (*models.VendorAnalyticsData, error) {
	var recentInquiries []models.RecentInquiry
	var recentReviews []models.RecentReview

	// Handle JSON arrays
	if len(d.RecentInquiriesJSON) > 0 && string(d.RecentInquiriesJSON) != "null" {
		if err := json.Unmarshal(d.RecentInquiriesJSON, &recentInquiries); err != nil {
			return nil, err
		}
	}
	if recentInquiries == nil {
		recentInquiries = []models.RecentInquiry{} // Empty array instead of nil
	}

	if len(d.RecentReviewsJSON) > 0 && string(d.RecentReviewsJSON) != "null" {
		if err := json.Unmarshal(d.RecentReviewsJSON, &recentReviews); err != nil {
			return nil, err
		}
	}
	if recentReviews == nil {
		recentReviews = []models.RecentReview{} // Empty array instead of nil
	}

	// Helper function to safely extract int64 values
	getInt := func(n sql.NullInt64) int {
		if n.Valid {
			return int(n.Int64)
		}
		return 0
	}

	// Helper function to safely extract float64 values
	getFloat := func(n sql.NullFloat64) float64 {
		if n.Valid {
			return n.Float64
		}
		return 0.0
	}

	// Extract CAC number
	cacNumber := ""
	if d.CacNumber.Valid {
		cacNumber = d.CacNumber.String
	}

	return &models.VendorAnalyticsData{
		ID:                 d.ID,
		Name:               d.Name,
		Category:           d.Category,
		PvsScore:           d.PvsScore,
		ReviewCount:        d.ReviewCount,
		IsIdentityVerified: d.IsIdentityVerified,
		CacNumber:          cacNumber,
		IsBusinessVerified: d.IsBusinessVerified.Bool,
		ProfileCompletion:  d.ProfileCompletion,
		InquiryCount:       d.InquiryCount,
		RespondedCount:     d.RespondedCount,
		CreatedAt:          d.CreatedAt,
		UpdatedAt:          d.UpdatedAt,
		Tier:               d.Tier,
		SubscriptionStatus: d.SubscriptionStatus,
		
		// Views with NULL handling
		ViewsTotal: getInt(d.ViewsTotal),
		Views30d:   getInt(d.Views30d),
		
		// Time-based metrics with NULL handling
		Inquiries7d:    getInt(d.Inquiries7d),
		Reviews7d:      getInt(d.Reviews7d),
		AvgRating7d:    getFloat(d.AvgRating7d),
		Inquiries30d:   getInt(d.Inquiries30d),
		Reviews30d:     getInt(d.Reviews30d),
		AvgRating30d:   getFloat(d.AvgRating30d),
		TotalInquiries: getInt(d.TotalInquiries),
		TotalReviews:   getInt(d.TotalReviews),
		AvgRatingAll:   getFloat(d.AvgRatingAll),
		
		// Rating distribution with NULL handling
		FiveStar:  getInt(d.FiveStar),
		FourStar:  getInt(d.FourStar),
		ThreeStar: getInt(d.ThreeStar),
		TwoStar:   getInt(d.TwoStar),
		OneStar:   getInt(d.OneStar),
		
		// Recent activity
		RecentInquiries: recentInquiries,
		RecentReviews:   recentReviews,
	}, nil
}

// ExistsForOwner verifies the vendor exists and is owned by the given user.
// Used by the analytics service for the security ownership check,
// replacing the previous raw db.QueryRowContext call in that layer.
func (r *PostgresVendorAnalyticsOptimizedRepo) ExistsForOwner(
    ctx context.Context,
    vendorID uuid.UUID,
    ownerID uuid.UUID,
) (bool, error) {
    var exists bool
    const q = `SELECT EXISTS(SELECT 1 FROM vendors WHERE id = $1 AND owner_id = $2)`
    err := r.db.QueryRowContext(ctx, q, vendorID, ownerID).Scan(&exists)
    if err != nil {
        return false, fmt.Errorf("ownership check failed: %w", err)
    }
    return exists, nil
}