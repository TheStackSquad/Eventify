// backend/pkg/repository/ vendor/vendor_metrics_repo.go

package vendor

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ============================================================================
// OPTIMIZED REPOSITORY - SINGLE QUERY IMPLEMENTATION
// ============================================================================

type PostgresVendorAnalyticsOptimizedRepo struct {
	db *sqlx.DB
}

func NewVendorAnalyticsOptimizedRepository(db *sqlx.DB) *PostgresVendorAnalyticsOptimizedRepo {
	return &PostgresVendorAnalyticsOptimizedRepo{db: db}
}

const completeAnalyticsQuery = `
	WITH vendor_base AS (
		SELECT
			v.id, v.name, v.category, v.pvs_score, v.review_count,
			v.is_identity_verified, v.cac_number, v.is_business_verified,
			v.profile_completion, v.inquiry_count, v.responded_count,
			v.created_at, v.updated_at,
			COALESCE(s.tier, 'free') as tier,
			COALESCE(s.status, 'inactive') as subscription_status,
			COALESCE(vs.views_total, 0) as views_total,
			COALESCE(vs.views_30d, 0) as views_30d
		FROM vendors v
		LEFT JOIN subscriptions s ON v.id = s.vendor_id
			AND s.status = 'active'
			AND (s.expires_at IS NULL OR s.expires_at > NOW())
		LEFT JOIN vendor_stats vs ON v.id = vs.vendor_id
		WHERE v.id = $1
	)
	SELECT 
		vb.*,
		-- Metrics with NULL protection
		COALESCE(m.inquiries_7d, 0) as inquiries_7d,
		COALESCE(m.reviews_7d, 0) as reviews_7d,
		COALESCE(m.avg_rating_7d, 0) as avg_rating_7d,
		COALESCE(m.inquiries_30d, 0) as inquiries_30d,
		COALESCE(m.reviews_30d, 0) as reviews_30d,
		COALESCE(m.avg_rating_30d, 0) as avg_rating_30d,
		COALESCE(m.total_inquiries, 0) as total_inquiries,
		COALESCE(m.total_reviews, 0) as total_reviews,
		COALESCE(m.avg_rating_all, 0) as avg_rating_all,
		-- Rating distribution with NULL protection
		COALESCE(
			(SELECT SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) 
			 FROM reviews WHERE vendor_id = vb.id), 
			0
		) as five_star,
		COALESCE(
			(SELECT SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) 
			 FROM reviews WHERE vendor_id = vb.id), 
			0
		) as four_star,
		COALESCE(
			(SELECT SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) 
			 FROM reviews WHERE vendor_id = vb.id), 
			0
		) as three_star,
		COALESCE(
			(SELECT SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) 
			 FROM reviews WHERE vendor_id = vb.id), 
			0
		) as two_star,
		COALESCE(
			(SELECT SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) 
			 FROM reviews WHERE vendor_id = vb.id), 
			0
		) as one_star,
		-- Recent data with empty array defaults
		COALESCE(
			(SELECT json_agg(sub) FROM (
				SELECT id, name, email, message, created_at
				FROM inquiries WHERE vendor_id = vb.id
				ORDER BY created_at DESC LIMIT 5
			) sub),
			'[]'::json
		) as recent_inquiries,
		COALESCE(
			(SELECT json_agg(sub) FROM (
				SELECT id, rating, comment, user_name, created_at
				FROM reviews WHERE vendor_id = vb.id
				ORDER BY created_at DESC LIMIT 5
			) sub),
			'[]'::json
		) as recent_reviews
	FROM vendor_base vb
	LEFT JOIN vendor_daily_metrics m ON vb.id = m.vendor_id
`

func (r *PostgresVendorAnalyticsOptimizedRepo) GetCompleteVendorAnalytics(ctx context.Context, vendorID uuid.UUID) (*models.VendorAnalyticsData, error) {
	var rawData VendorAnalyticsDataRaw
	err := r.db.GetContext(ctx, &rawData, completeAnalyticsQuery, vendorID)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("vendor not found")
	}
	if err != nil {
		return nil, fmt.Errorf("analytics query failed: %w", err)
	}
	return rawData.ToAnalyticsData()
}

// GetVendorTier implements the VendorAnalyticsOptimizedRepository interface
// This allows tier-based access restrictions without a separate query
func (r *PostgresVendorAnalyticsOptimizedRepo) GetVendorTier(ctx context.Context, vendorID uuid.UUID) (models.SubscriptionTier, error) {
	analytics, err := r.GetCompleteVendorAnalytics(ctx, vendorID)
	if err != nil {
		return models.TierFree, err
	}
	return models.SubscriptionTier(analytics.Tier), nil
}

// ============================================================================
// BACKWARD COMPATIBILITY LAYER
// ============================================================================

type PostgresVendorCoreMetricsRepository struct {
	db   *sqlx.DB
	core *PostgresVendorAnalyticsOptimizedRepo
}

func NewVendorCoreMetricsRepository(db *sqlx.DB) *PostgresVendorCoreMetricsRepository {
	return &PostgresVendorCoreMetricsRepository{
		db:   db,
		core: NewVendorAnalyticsOptimizedRepository(db),
	}
}

func (r *PostgresVendorCoreMetricsRepository) GetVendorTrustScore(ctx context.Context, vendorID uuid.UUID) (*models.VendorTrustScore, error) {
	analytics, err := r.core.GetCompleteVendorAnalytics(ctx, vendorID)
	if err != nil {
		return nil, err
	}
	return &models.VendorTrustScore{
		TotalTrustWeight: float64(analytics.PvsScore),
		ReviewCount:      int32(analytics.ReviewCount),
	}, nil
}

func (r *PostgresVendorCoreMetricsRepository) GetVendorBasicInfo(ctx context.Context, vendorID uuid.UUID) (*models.VendorBasicInfo, error) {
	analytics, err := r.core.GetCompleteVendorAnalytics(ctx, vendorID)
	if err != nil {
		return nil, err
	}
	
	// Parse the string dates back to time.Time for VendorBasicInfo
	createdAt, _ := time.Parse(time.RFC3339, analytics.CreatedAt)
	updatedAt, _ := time.Parse(time.RFC3339, analytics.UpdatedAt)
	
	return &models.VendorBasicInfo{
		ID:                 analytics.ID,
		Name:               analytics.Name,
		Category:           analytics.Category,
		PvsScore:           analytics.PvsScore,
		ReviewCount:        analytics.ReviewCount,
		IsIdentityVerified: analytics.IsIdentityVerified,
		CacNumber:          analytics.CacNumber,
		IsBusinessVerified: analytics.IsBusinessVerified,
		ProfileCompletion:  analytics.ProfileCompletion,
		InquiryCount:       analytics.InquiryCount,
		RespondedCount:     analytics.RespondedCount,
		CreatedAt:          createdAt,
		UpdatedAt:          updatedAt,
		Tier:               models.SubscriptionTier(analytics.Tier),
		SubscriptionStatus: analytics.SubscriptionStatus,
		ViewsTotal:         analytics.ViewsTotal,
		Views30d:           analytics.Views30d,
	}, nil
}

func (r *PostgresVendorCoreMetricsRepository) GetVendorTier(ctx context.Context, vendorID uuid.UUID) (models.SubscriptionTier, error) {
	analytics, err := r.core.GetCompleteVendorAnalytics(ctx, vendorID)
	if err != nil {
		return models.TierFree, err
	}
	return models.SubscriptionTier(analytics.Tier), nil
}

type PostgresVendorMetricsRepository struct {
	db   *sqlx.DB
	core *PostgresVendorAnalyticsOptimizedRepo
}

func NewVendorMetricsRepository(db *sqlx.DB) *PostgresVendorMetricsRepository {
	return &PostgresVendorMetricsRepository{
		db:   db,
		core: NewVendorAnalyticsOptimizedRepository(db),
	}
}

func (r *PostgresVendorMetricsRepository) GetReviewMetrics(ctx context.Context, vendorID uuid.UUID) (*models.ReviewMetricsRaw, error) {
	analytics, err := r.core.GetCompleteVendorAnalytics(ctx, vendorID)
	if err != nil {
		return nil, err
	}
	return &models.ReviewMetricsRaw{
		TotalReviews:  analytics.TotalReviews,
		AverageRating: analytics.AvgRatingAll,
		RatingCounts: map[int]int{
			5: analytics.FiveStar,
			4: analytics.FourStar,
			3: analytics.ThreeStar,
			2: analytics.TwoStar,
			1: analytics.OneStar,
		},
	}, nil
}

func (r *PostgresVendorMetricsRepository) GetInquiryCountByPeriod(ctx context.Context, vendorID uuid.UUID, days int) (int, error) {
	if days == 30 || days == 7 {
		analytics, err := r.core.GetCompleteVendorAnalytics(ctx, vendorID)
		if err == nil {
			if days == 30 {
				return analytics.Inquiries30d, nil
			}
			return analytics.Inquiries7d, nil
		}
	}
	// Dynamic Fallback
	var count int
	query := `SELECT COUNT(*) FROM inquiries WHERE vendor_id = $1 AND created_at >= $2`
	err := r.db.GetContext(ctx, &count, query, vendorID, time.Now().AddDate(0, 0, -days))
	return count, err
}

func (r *PostgresVendorMetricsRepository) GetReviewCountByPeriod(ctx context.Context, vendorID uuid.UUID, days int) (int, error) {
	if days == 30 || days == 7 {
		analytics, err := r.core.GetCompleteVendorAnalytics(ctx, vendorID)
		if err == nil {
			if days == 30 {
				return analytics.Reviews30d, nil
			}
			return analytics.Reviews7d, nil
		}
	}
	var count int
	query := `SELECT COUNT(*) FROM reviews WHERE vendor_id = $1 AND created_at >= $2`
	err := r.db.GetContext(ctx, &count, query, vendorID, time.Now().AddDate(0, 0, -days))
	return count, err
}

func (r *PostgresVendorMetricsRepository) GetAverageRatingByPeriod(ctx context.Context, vendorID uuid.UUID, days int) (float64, error) {
	if days == 30 || days == 7 {
		analytics, err := r.core.GetCompleteVendorAnalytics(ctx, vendorID)
		if err == nil {
			if days == 30 {
				return analytics.AvgRating30d, nil
			}
			return analytics.AvgRating7d, nil
		}
	}
	var avg float64
	query := `SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE vendor_id = $1 AND created_at >= $2`
	err := r.db.GetContext(ctx, &avg, query, vendorID, time.Now().AddDate(0, 0, -days))
	return avg, err
}