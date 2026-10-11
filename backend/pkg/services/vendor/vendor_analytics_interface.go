// backend/pkg/services/vendor/analytics_service.go

package vendor

import (
	"context"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/models"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type VendorAnalyticsService interface {
	// Accept userID as the third parameter for the ownership check
	GetVendorAnalytics(ctx context.Context, vendorID uuid.UUID, userID uuid.UUID) (*models.VendorAnalyticsResponse, error)
}

type vendorAnalyticsServiceImpl struct {
	optimizedRepo repovendor.VendorAnalyticsOptimizedRepository
}

func NewVendorAnalyticsService(
	optimizedRepo repovendor.VendorAnalyticsOptimizedRepository,
) VendorAnalyticsService {
	return &vendorAnalyticsServiceImpl{
		optimizedRepo: optimizedRepo,
	}
}

// GetVendorAnalytics fetches complete analytics with a built-in ownership check
func (s *vendorAnalyticsServiceImpl) GetVendorAnalytics(
	ctx context.Context,
	vendorID uuid.UUID,
	userID uuid.UUID,
) (*models.VendorAnalyticsResponse, error) {

	// 1. SECURITY CHECK: Verify the User owns this Vendor profile
	isOwner, err := s.optimizedRepo.ExistsForOwner(ctx, vendorID, userID)
	if err != nil {
		log.Error().Err(err).Msg("Database error during ownership check")
		return nil, err
	}

	if !isOwner {
		log.Warn().
			Str("user_id", userID.String()).
			Str("vendor_id", vendorID.String()).
			Msg("Unauthorized: User does not own this vendor")
		// We return "vendor not found" for security to avoid confirming valid IDs to unauthorized users
		return nil, fmt.Errorf("vendor not found")
	}

	log.Info().
		Str("vendor_id", vendorID.String()).
		Msg("Fetching vendor analytics (verified owner)")

	// 2. FETCH DATA: Call the optimized repository logic
	data, err := s.optimizedRepo.GetCompleteVendorAnalytics(ctx, vendorID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve vendor analytics: %w", err)
	}

	// 3. TRANSFORM: Map the internal Data model to the API Response format
	response := s.transformToResponse(data)

	log.Info().
		Str("vendor_id", vendorID.String()).
		Str("vendor_name", data.Name).
		Msg("Vendor analytics fetched successfully")

	return response, nil
}

// transformToResponse converts internal data model to API response
func (s *vendorAnalyticsServiceImpl) transformToResponse(
	data *models.VendorAnalyticsData,
) *models.VendorAnalyticsResponse {
	
	// Calculate inquiry trend
	trend := s.calculateInquiryTrend(data.Inquiries7d, data.Inquiries30d)
	
	// Calculate sentiment trend
	sentimentTrend := "stable"
	if data.AvgRatingAll >= 4.5 {
		sentimentTrend = "improving"
	} else if data.AvgRatingAll < 3.0 {
		sentimentTrend = "declining"
	}
	
	// Calculate PVS trend
	pvsScoreTrend := "stable"
	if data.PvsScore >= 80 {
		pvsScoreTrend = "improving"
	} else if data.PvsScore < 50 {
		pvsScoreTrend = "declining"
	}
	
	// Parse timestamps
	createdAt, _ := time.Parse(time.RFC3339, data.CreatedAt)
	updatedAt, _ := time.Parse(time.RFC3339, data.UpdatedAt)
	
	// Calculate days on platform
	daysOnPlatform := int(time.Since(createdAt).Hours() / 24)
	
	// Determine account status
	accountStatus := "active"
	if daysOnPlatform < 30 {
		accountStatus = "new"
	} else if time.Since(updatedAt).Hours() > 30*24 {
		accountStatus = "inactive"
	}
	
	return &models.VendorAnalyticsResponse{
		VendorID:   data.ID.String(),
		VendorName: data.Name,
		Category:   data.Category,
		
		Overview: models.VendorOverview{
			CurrentPVSScore:    data.PvsScore,
			TotalInquiries:     data.TotalInquiries,
			TotalViews:         data.ViewsTotal,
			Views30d:           data.Views30d,
			ProfileCompletion:  float64(data.ProfileCompletion),
			AverageRating:      data.AvgRatingAll,
			TotalReviews:       data.TotalReviews,
			IsIdentityVerified: data.IsIdentityVerified,
			IsBusinessVerified: data.IsBusinessVerified,
			IsFullyVerified:    data.IsIdentityVerified && data.IsBusinessVerified,
		},
		
		Inquiries: models.VendorInquiries{
			Total:               data.Inquiries30d,
			Pending:             0, // TODO: Track status in inquiries table
			Responded:           0,
			Closed:              0,
			ResponseRate:        0.0,
			AverageResponseTime: "N/A",
			RecentInquiries:     data.RecentInquiries,
			InquiryTrend:        trend,
		},
		
		Reviews: models.VendorReviews{
			TotalReviews:    data.TotalReviews,
			ApprovedReviews: data.TotalReviews,
			PendingReviews:  0,
			AverageRating:   data.AvgRatingAll,
			RatingDistribution: models.RatingDistribution{
				FiveStar:  data.FiveStar,
				FourStar:  data.FourStar,
				ThreeStar: data.ThreeStar,
				TwoStar:   data.TwoStar,
				OneStar:   data.OneStar,
				AvgRating: data.AvgRatingAll,
			},
			RecentReviews:  data.RecentReviews,
			SentimentTrend: sentimentTrend,
		},
		
		Trends: models.VendorTrends{
			Last7Days: models.PeriodMetrics{
				InquiryCount:  data.Inquiries7d,
				NewReviews:    data.Reviews7d,
				AverageRating: data.AvgRating7d,
			},
			Last30Days: models.PeriodMetrics{
				InquiryCount:  data.Inquiries30d,
				NewReviews:    data.Reviews30d,
				AverageRating: data.AvgRating30d,
			},
		},
		
		Performance: models.VendorPerformance{
			IsIdentityVerified:  data.IsIdentityVerified,
			IsBusinessVerified:  data.IsBusinessVerified,
			CACNumber:           data.CacNumber,
			DaysOnPlatform:      daysOnPlatform,
			LastProfileUpdate:   updatedAt,
			AccountStatus:       accountStatus,
			ProfileCompleteness: float64(data.ProfileCompletion),
			PVSScoreTrend:       pvsScoreTrend,
		},
		
		// No tier restrictions for now (all vendors get full access)
		Restrictions: nil,
	}
}

func (s *vendorAnalyticsServiceImpl) calculateInquiryTrend(
	inquiries7d int,
	inquiries30d int,
) string {
	if inquiries30d == 0 {
		return "stable"
	}
	
	weeklyAvg := float64(inquiries7d)
	monthlyAvg := float64(inquiries30d) / 4.3 // Avg weeks in a month
	
	if weeklyAvg > monthlyAvg*1.2 {
		return "increasing"
	} else if weeklyAvg < monthlyAvg*0.8 {
		return "decreasing"
	}
	
	return "stable"
}