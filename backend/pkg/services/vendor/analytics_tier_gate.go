// backend/pkg/services/vendor/analytics_tier_gate.go

package vendor

import (
	"context"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

// ApplyTierRestrictions limits analytics data based on subscription tier
func (s *vendorAnalyticsServiceImpl) ApplyTierRestrictions(
	ctx context.Context,
	vendorID uuid.UUID,
	fullAnalytics *models.VendorAnalyticsResponse,
) (*models.VendorAnalyticsResponse, error) {

	tier, err := s.optimizedRepo.GetVendorTier(ctx, vendorID)
	if err != nil {
		tier = models.TierFree // Default to free on error
	}

	switch tier {
	case models.TierFree:
		return s.buildFreeTierAnalytics(fullAnalytics), nil

	case models.TierPremium:
		return s.buildPremiumTierAnalytics(fullAnalytics), nil

	case models.TierFeatured:
		return fullAnalytics, nil // Full access

	default:
		return s.buildFreeTierAnalytics(fullAnalytics), nil
	}
}

func (s *vendorAnalyticsServiceImpl) buildFreeTierAnalytics(full *models.VendorAnalyticsResponse) *models.VendorAnalyticsResponse {
	return &models.VendorAnalyticsResponse{
		VendorID:   full.VendorID,
		VendorName: full.VendorName,
		Category:   full.Category,
		Overview: models.VendorOverview{
			CurrentPVSScore:   full.Overview.CurrentPVSScore,
			TotalReviews:      full.Overview.TotalReviews,
			AverageRating:     full.Overview.AverageRating,
			ProfileCompletion: full.Overview.ProfileCompletion,
			IsVerified:        full.Overview.IsVerified,
			// Hide: TotalInquiries, TotalViews
		},
		Inquiries: models.VendorInquiries{
			Total: full.Inquiries.Total,
			// Hide: Breakdown, response rate, recent inquiries
		},
		Reviews: models.VendorReviews{
			TotalReviews:       full.Reviews.TotalReviews,
			AverageRating:      full.Reviews.AverageRating,
			RatingDistribution: full.Reviews.RatingDistribution,
			// Hide: Recent reviews, sentiment trend
		},
		// Hide: Trends, Performance
		Restrictions: &models.TierRestrictions{
			Tier:    "free",
			Message: "🔒 Upgrade to Premium to unlock: detailed inquiries, performance trends, and comparative analytics",
			MissingFeatures: []string{
				"Inquiry response tracking",
				"Profile view analytics",
				"7-day and 30-day trends",
				"Performance scoring",
				"Category/location rankings",
			},
		},
	}
}

func (s *vendorAnalyticsServiceImpl) buildPremiumTierAnalytics(full *models.VendorAnalyticsResponse) *models.VendorAnalyticsResponse {
	premium := *full // Copy all data

	premium.Restrictions = &models.TierRestrictions{
		Tier:    "premium",
		Message: "⭐ Upgrade to Featured for priority placement and advanced insights",
		MissingFeatures: []string{
			"Top-of-search placement",
			"Featured badge",
			"Competitive intelligence",
		},
	}

	return &premium
}