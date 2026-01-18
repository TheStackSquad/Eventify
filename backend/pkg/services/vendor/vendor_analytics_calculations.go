// backend/pkg/services/vendor/vendor_analytics_calculations.go

package vendor

import (
	"fmt"
//	"math"
	"time"

	"github.com/eventify/backend/pkg/models"
)

// calculateOverview uses the cached PVS score and tracks core KPIs
func (s *vendorAnalyticsServiceImpl) calculateOverview(
	vendorInfo *models.VendorBasicInfo,
	trustScore *models.VendorTrustScore,
) models.VendorOverview {
	// Logic simplified: Verification is now binary based on vNIN (Identity)
	isVerified := vendorInfo.IsIdentityVerified

	return models.VendorOverview{
		CurrentPVSScore:   int(trustScore.TotalTrustWeight),
		TotalInquiries:    vendorInfo.InquiryCount,
		TotalResponded:    vendorInfo.RespondedCount,
		ResponseRate:      s.calculateResponseRate(vendorInfo.InquiryCount, vendorInfo.RespondedCount),
		ProfileCompletion: roundToTwoDecimals(float64(vendorInfo.ProfileCompletion)),
		AverageRating:     0.0, // Populated later by calculateReviews if needed
		TotalReviews:      int(trustScore.ReviewCount),
		IsVerified:        isVerified,
	}
}

// calculateInquiries computes inquiry-related metrics and trends
func (s *vendorAnalyticsServiceImpl) calculateInquiries(
	recentInquiries []models.RecentInquiry,
	inquiries7d int,
	inquiries30d int,
) models.VendorInquiries {
	trend := "stable"
	if inquiries30d > 0 {
		weeklyAvg := float64(inquiries7d)
		monthlyAvg := float64(inquiries30d) / 4.3
		if weeklyAvg > monthlyAvg*1.2 {
			trend = "increasing"
		} else if weeklyAvg < monthlyAvg*0.8 {
			trend = "decreasing"
		}
	}

	return models.VendorInquiries{
		Total:               inquiries30d,
		Pending:             0,
		Responded:           0,
		Closed:              0,
		ResponseRate:        0.0, 
		AverageResponseTime: "N/A",
		RecentInquiries:     recentInquiries,
		InquiryTrend:        trend,
	}
}

// calculateReviews computes review metrics and rating distribution
func (s *vendorAnalyticsServiceImpl) calculateReviews(
	metrics *models.ReviewMetricsRaw,
	recentReviews []models.RecentReview,
) models.VendorReviews {
	distribution := models.RatingDistribution{
		FiveStar:  metrics.RatingCounts[5],
		FourStar:  metrics.RatingCounts[4],
		ThreeStar: metrics.RatingCounts[3],
		TwoStar:   metrics.RatingCounts[2],
		OneStar:   metrics.RatingCounts[1],
		AvgRating: roundToTwoDecimals(metrics.AverageRating),
	}

	sentimentTrend := "stable"
	if metrics.AverageRating >= 4.5 {
		sentimentTrend = "improving"
	} else if metrics.AverageRating < 3.0 {
		sentimentTrend = "declining"
	}

	return models.VendorReviews{
		TotalReviews:       metrics.TotalReviews,
		ApprovedReviews:    metrics.TotalReviews,
		PendingReviews:     0,
		AverageRating:      roundToTwoDecimals(metrics.AverageRating),
		RatingDistribution: distribution,
		RecentReviews:      recentReviews,
		SentimentTrend:     sentimentTrend,
	}
}

// calculateTrends computes trend metrics for 7-day and 30-day periods
func (s *vendorAnalyticsServiceImpl) calculateTrends(
	inquiries7d, reviews7d int, avgRating7d float64,
	inquiries30d, reviews30d int, avgRating30d float64,
) models.VendorTrends {
	return models.VendorTrends{
		Last7Days: models.PeriodMetrics{
			InquiryCount:  inquiries7d,
			NewReviews:    reviews7d,
			AverageRating: roundToTwoDecimals(avgRating7d),
		},
		Last30Days: models.PeriodMetrics{
			InquiryCount:  inquiries30d,
			NewReviews:    reviews30d,
			AverageRating: roundToTwoDecimals(avgRating30d),
		},
	}
}

// calculatePerformance computes vendor performance metrics
func (s *vendorAnalyticsServiceImpl) calculatePerformance(
	vendorInfo *models.VendorBasicInfo,
	trustScore *models.VendorTrustScore,
) models.VendorPerformance {
	daysOnPlatform := int(time.Since(vendorInfo.CreatedAt).Hours() / 24)

	accountStatus := "active"
	if daysOnPlatform < 30 {
		accountStatus = "new"
	} else if time.Since(vendorInfo.UpdatedAt).Hours() > 30*24 {
		accountStatus = "inactive"
	}

	pvsScoreTrend := "stable"
	pvs := int(trustScore.TotalTrustWeight)
	if pvs >= 80 {
		pvsScoreTrend = "improving"
	} else if pvs < 50 {
		pvsScoreTrend = "declining"
	}

	return models.VendorPerformance{
		IsIdentityVerified:  vendorInfo.IsIdentityVerified,
		DaysOnPlatform:      daysOnPlatform,
		LastProfileUpdate:   vendorInfo.UpdatedAt,
		AccountStatus:       accountStatus,
		ProfileCompleteness: roundToTwoDecimals(float64(vendorInfo.ProfileCompletion)),
		PVSScoreTrend:       pvsScoreTrend,
	}
}

// generateActionableInsights creates insights relevant to the vNIN model
func (s *vendorAnalyticsServiceImpl) generateActionableInsights(
	vendorInfo *models.VendorBasicInfo,
	reviewMetrics *models.ReviewMetricsRaw,
	overview models.VendorOverview,
) []models.ActionableInsight {
	var insights []models.ActionableInsight

	// 1. Identity Verification (vNIN) Insight
	if !vendorInfo.IsIdentityVerified {
		insights = append(insights, models.ActionableInsight{
			Type:        "critical",
			Title:       "Verify your Identity",
			Description: "Your vNIN verification is missing. Verified vendors build more trust.",
			Action:      "Complete vNIN Check",
			Priority:    1,
		})
	}

	// 2. Profile completion insights
	if vendorInfo.ProfileCompletion < 80 {
		insights = append(insights, models.ActionableInsight{
			Type:        "tip",
			Title:       fmt.Sprintf("Profile is %0.0f%% complete", vendorInfo.ProfileCompletion),
			Description: "Profiles with photos and descriptions receive more inquiries.",
			Action:      "Update Profile",
			Priority:    2,
		})
	}

	// 3. Positive rating insights
	if reviewMetrics.AverageRating >= 4.5 && reviewMetrics.TotalReviews >= 5 {
		insights = append(insights, models.ActionableInsight{
			Type:        "success",
			Title:       fmt.Sprintf("Top Rated: %0.1f Stars", reviewMetrics.AverageRating),
			Description: "Excellent service! Your high rating is boosting visibility.",
			Action:      "View Reviews",
			Priority:    3,
		})
	}

	// 4. Response Rate Insight
	if overview.ResponseRate < 70 && overview.TotalInquiries > 5 {
		insights = append(insights, models.ActionableInsight{
			Type:        "warning",
			Title:       "Improve Response Rate",
			Description: "Fast responses lead to more bookings.",
			Action:      "Review Inquiries",
			Priority:    1,
		})
	}

	return insights
}

// Helper: Calculate response rate percentage
func (s *vendorAnalyticsServiceImpl) calculateResponseRate(total, responded int) float64 {
	if total == 0 {
		return 0.0
	}
	return roundToTwoDecimals((float64(responded) / float64(total)) * 100)
}

