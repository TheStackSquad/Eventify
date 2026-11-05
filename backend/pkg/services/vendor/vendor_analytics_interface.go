// backend/pkg/services/vendor/analytics_service.go

package vendor

import (
	"context"
	"fmt"
	"sync"

	"github.com/eventify/backend/pkg/models"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	"github.com/google/uuid"
)

// VendorAnalyticsService defines the contract for fetching aggregated profile data.
type VendorAnalyticsService interface {
	GetVendorAnalytics(ctx context.Context, vendorID uuid.UUID) (*models.VendorAnalyticsResponse, error)
}

type vendorAnalyticsServiceImpl struct {
	VendorRepo  repovendor.VendorRepository
	CoreRepo    repovendor.VendorCoreMetricsRepository
	MetricsRepo repovendor.VendorMetricsRepository
	DataRepo    repovendor.VendorDataRepository
}

func NewVendorAnalyticsService(
	vendorRepo repovendor.VendorRepository,
	coreRepo repovendor.VendorCoreMetricsRepository,
	metricsRepo repovendor.VendorMetricsRepository,
	dataRepo repovendor.VendorDataRepository,
) VendorAnalyticsService {
	return &vendorAnalyticsServiceImpl{
		VendorRepo:  vendorRepo,
		CoreRepo:    coreRepo,
		MetricsRepo: metricsRepo,
		DataRepo:    dataRepo,
	}
}

func (s *vendorAnalyticsServiceImpl) GetVendorAnalytics(
	ctx context.Context,
	vendorID uuid.UUID,
) (*models.VendorAnalyticsResponse, error) {

	// --- PHASE 1: Fetching Core Info (Synchronous) ---
	vendorInfo, err := s.CoreRepo.GetVendorBasicInfo(ctx, vendorID)
	if err != nil {
		return nil, fmt.Errorf("failed to get vendor basic info: %w", err)
	}

	// Trust Score (PVS) — kept for potential future use, non-fatal if missing
	_, err = s.CoreRepo.GetVendorTrustScore(ctx, vendorID)
	if err != nil {
		// Non-critical, continue
	}

	// --- PHASE 2: Concurrent Metric/Data Fetching ---
	var wg sync.WaitGroup
	var reviewMetrics *models.ReviewMetricsRaw
	var recentReviews []models.RecentReview
	var recentInquiries []models.RecentInquiry
	var inquiries30d int
	var avgRating30d float64

	errCh := make(chan error, 5)

	// 1. Review Metrics
	wg.Add(1)
	go func() {
		defer wg.Done()
		var e error
		reviewMetrics, e = s.MetricsRepo.GetReviewMetrics(ctx, vendorID)
		if e != nil {
			errCh <- fmt.Errorf("reviews: %w", e)
		}
	}()

	// 2. Recent Reviews
	wg.Add(1)
	go func() {
		defer wg.Done()
		var e error
		recentReviews, e = s.DataRepo.GetRecentReviews(ctx, vendorID, 5)
		if e != nil {
			errCh <- fmt.Errorf("recent reviews: %w", e)
		}
	}()

	// 3. Recent Inquiries
	wg.Add(1)
	go func() {
		defer wg.Done()
		var e error
		recentInquiries, e = s.DataRepo.GetRecentInquiries(ctx, vendorID, 5)
		if e != nil {
			errCh <- fmt.Errorf("recent inquiries: %w", e)
		}
	}()

	// 4. 30-Day Window — inquiry count and average rating
	wg.Add(1)
	go func() {
		defer wg.Done()
		inquiries30d, _ = s.MetricsRepo.GetInquiryCountByPeriod(ctx, vendorID, 30)
		avgRating30d, _ = s.MetricsRepo.GetAverageRatingByPeriod(ctx, vendorID, 30)
	}()

	wg.Wait()
	close(errCh)

	for e := range errCh {
		fmt.Printf("Warning: background fetch error: %v\n", e)
	}

	// Null safety
	if reviewMetrics == nil {
		reviewMetrics = &models.ReviewMetricsRaw{RatingCounts: make(map[int]int)}
	}

	// --- PHASE 3: Resolve Subscription Tier ---
	// Fetch the vendor's active subscription via the joined query.
	// If no subscription exists or the lookup fails, tier defaults to Free.
	tier := models.TierFree
	vendorWithSub, err := s.VendorRepo.GetVendorWithSubscription(ctx, vendorID)
	if err == nil && vendorWithSub.Subscription != nil && vendorWithSub.Subscription.Status == models.SubscriptionActive {
		tier = vendorWithSub.Subscription.Tier
	}

	// --- PHASE 4: Assemble Response ---

	response := &models.VendorAnalyticsResponse{
		Tier:         tier,
		ProfileViews: vendorInfo.ProfileViews,
	}

	// Basic+ fields — gated by tier
	if tier.Rank() >= models.TierBasic.Rank() {
		response.InquiryCount    = &inquiries30d
		response.RecentInquiries = recentInquiries
	}

	// Premium+ fields — gated by tier
	if tier.Rank() >= models.TierPremium.Rank() {
		response.ReviewMetrics = reviewMetrics
		response.AverageRating = &avgRating30d
		response.RecentReviews = recentReviews
	}

	return response, nil
}