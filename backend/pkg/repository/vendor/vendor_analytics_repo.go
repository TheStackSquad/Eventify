// backend/pkg/repository/ vendor/vendor_analytics_repo.go

package vendor

import (
	"context"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

// VendorCoreMetricsRepository handles fetching pre-calculated PVS and essential vendor information.
type VendorCoreMetricsRepository interface {
	// GetVendorTrustScore fetches the calculated PVS score and review count from vendor_trust_score.
	GetVendorTrustScore(ctx context.Context, vendorID uuid.UUID) (*models.VendorTrustScore, error)
	
	// GetVendorBasicInfo fetches essential vendor info and increments the profile_views counter.
	GetVendorBasicInfo(ctx context.Context, vendorID uuid.UUID) (*models.VendorBasicInfo, error)
}

// VendorMetricsRepository handles aggregated analytics calculated at runtime.
type VendorMetricsRepository interface {
	// GetInquiryCountByPeriod returns the count of inquiries for a vendor within the specified days.
	GetInquiryCountByPeriod(ctx context.Context, vendorID uuid.UUID, days int) (int, error)
	
	// GetReviewMetrics returns comprehensive review metrics for a vendor.
	GetReviewMetrics(ctx context.Context, vendorID uuid.UUID) (*models.ReviewMetricsRaw, error)
	
	// GetReviewCountByPeriod returns the count of reviews for a vendor within the specified days.
	GetReviewCountByPeriod(ctx context.Context, vendorID uuid.UUID, days int) (int, error)
	
	// GetAverageRatingByPeriod returns the average rating for a vendor within the specified days.
	GetAverageRatingByPeriod(ctx context.Context, vendorID uuid.UUID, days int) (float64, error)
}

// VendorDataRepository handles fetching detailed lists of customer activity.
type VendorDataRepository interface {
	// GetRecentInquiries fetches the most recent inquiries for a vendor.
	GetRecentInquiries(ctx context.Context, vendorID uuid.UUID, limit int) ([]models.RecentInquiry, error)
	
	// GetRecentReviews fetches the most recent reviews for a vendor.
	GetRecentReviews(ctx context.Context, vendorID uuid.UUID, limit int) ([]models.RecentReview, error)
}