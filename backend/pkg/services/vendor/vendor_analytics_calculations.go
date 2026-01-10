// backend/pkg/services/vendor/vendor_analytics_calculations.go

package vendor

import (
	"fmt"
	"time"

	"eventify/backend/pkg/models"
)

// calculateOverview uses the cached PVS score and only tracks reviews
func (s *vendorAnalyticsServiceImpl) calculateOverview(
	vendorInfo *models.VendorBasicInfo,
	trustScore *models.VendorTrustScore,
) models.VendorOverview {
	isVerified := vendorInfo.IsIdentityVerified || vendorInfo.IsBusinessRegistered
	isFullyVerified := vendorInfo.IsIdentityVerified && vendorInfo.IsBusinessRegistered

	return models.VendorOverview{
		CurrentPVSScore:     int(trustScore.TotalTrustWeight),
		TotalInquiries:      0,
		TotalResponded:      0,
		ResponseRate:        0.0,
		TotalBookings:       vendorInfo.BookingsCompleted,
		ProfileCompletion:   roundToTwoDecimals(float64(vendorInfo.ProfileCompletion)),
		AverageRating:       0.0,
		TotalReviews:        int(trustScore.ReviewCount),
		IsVerified:          isVerified,
		IsFullyVerified:     isFullyVerified,
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
	last7Days := models.PeriodMetrics{
		InquiryCount:   inquiries7d,
		RespondedCount: 0,
		ResponseRate:   0.0,
		NewReviews:     reviews7d,
		AverageRating:  roundToTwoDecimals(avgRating7d),
	}

	last30Days := models.PeriodMetrics{
		InquiryCount:   inquiries30d,
		RespondedCount: 0,
		ResponseRate:   0.0,
		NewReviews:     reviews30d,
		AverageRating:  roundToTwoDecimals(avgRating30d),
	}

	return models.VendorTrends{
		Last7Days:  last7Days,
		Last30Days: last30Days,
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
		IsIdentityVerified:   vendorInfo.IsIdentityVerified,
		IsBusinessRegistered: vendorInfo.IsBusinessRegistered,
		DaysOnPlatform:       daysOnPlatform,
		LastProfileUpdate:    vendorInfo.UpdatedAt,
		AccountStatus:        accountStatus,
		ProfileCompleteness:  roundToTwoDecimals(float64(vendorInfo.ProfileCompletion)),
		PVSScoreTrend:        pvsScoreTrend,
	}
}

// generateActionableInsights creates insights relevant to vendor analytics
func (s *vendorAnalyticsServiceImpl) generateActionableInsights(
	vendorInfo *models.VendorBasicInfo,
	reviewMetrics *models.ReviewMetricsRaw,
	overview models.VendorOverview,
) []models.ActionableInsight {
	var insights []models.ActionableInsight

	// Verification insights
	if !vendorInfo.IsIdentityVerified || !vendorInfo.IsBusinessRegistered {
		verifyWhat := "identity and business registration"
		if vendorInfo.IsIdentityVerified {
			verifyWhat = "business registration"
		} else if vendorInfo.IsBusinessRegistered {
			verifyWhat = "identity"
		}
		insights = append(insights, models.ActionableInsight{
			Type:        "tip",
			Title:       fmt.Sprintf("Complete your %s", verifyWhat),
			Description: "Verified vendors get up to 40% more inquiries and higher PVS scores.",
			Action:      "Get verified",
			Priority:    2,
		})
	}

	// Profile completion insights
	if vendorInfo.ProfileCompletion < 80 {
		insights = append(insights, models.ActionableInsight{
			Type:        "tip",
			Title:       fmt.Sprintf("Your profile is %0.0f%% complete", vendorInfo.ProfileCompletion),
			Description: "Complete profiles get 2x more inquiries. Add photos, descriptions, and pricing details.",
			Action:      "Complete your profile",
			Priority:    3,
		})
	}

	// Positive rating insights
	if reviewMetrics.AverageRating >= 4.5 && reviewMetrics.TotalReviews >= 5 {
		insights = append(insights, models.ActionableInsight{
			Type:        "success",
			Title:       fmt.Sprintf("Excellent rating: %0.1f stars!", reviewMetrics.AverageRating),
			Description: "Your customers love your service! Keep up the great work.",
			Action:      "Share your reviews",
			Priority:    3,
		})
	}

	// Low rating warning
	if reviewMetrics.AverageRating < 3.5 && reviewMetrics.TotalReviews >= 5 {
		insights = append(insights, models.ActionableInsight{
			Type:        "warning",
			Title:       "Your rating needs attention",
			Description: "Ratings below 3.5 stars may discourage potential customers. Focus on service quality and follow up with customers.",
			Action:      "Improve service quality",
			Priority:    1,
		})
	}

	// High PVS score insights
	if overview.CurrentPVSScore >= 80 {
		insights = append(insights, models.ActionableInsight{
			Type:        "success",
			Title:       "High PVS Score - Keep it up!",
			Description: fmt.Sprintf("Your PVS score of %d puts you in the top tier. You'll appear higher in search results.", overview.CurrentPVSScore),
			Action:      "Maintain consistency",
			Priority:    3,
		})
	}

	return insights
}