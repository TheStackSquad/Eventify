// backend/pkg/services/vendor/vendor_analytics

// backend/pkg/services/vendor/analytics_service.go

package vendor

import (
	"context"
	"fmt"
	"sync"

	"eventify/backend/pkg/models"
	repovendor "eventify/backend/pkg/repository/vendor"
	"github.com/google/uuid"
)

// VendorAnalyticsService defines the contract for fetching aggregated profile data.
type VendorAnalyticsService interface {
	GetVendorAnalytics(ctx context.Context, vendorID uuid.UUID) (*models.VendorAnalyticsResponse, error)
}

// vendorAnalyticsServiceImpl implements the service using the split repositories.
type vendorAnalyticsServiceImpl struct {
	CoreRepo    repovendor.VendorCoreMetricsRepository
	MetricsRepo repovendor.VendorMetricsRepository
	DataRepo    repovendor.VendorDataRepository
}

// NewVendorAnalyticsService provides the factory function for the service.
func NewVendorAnalyticsService(
	coreRepo repovendor.VendorCoreMetricsRepository,
	metricsRepo repovendor.VendorMetricsRepository,
	dataRepo repovendor.VendorDataRepository,
) VendorAnalyticsService {
	return &vendorAnalyticsServiceImpl{
		CoreRepo:    coreRepo,
		MetricsRepo: metricsRepo,
		DataRepo:    dataRepo,
	}
}

// GetVendorAnalytics orchestrates the collection and aggregation of all vendor profile data.
func (s *vendorAnalyticsServiceImpl) GetVendorAnalytics(
	ctx context.Context,
	vendorID uuid.UUID,
) (*models.VendorAnalyticsResponse, error) {

	// --- PHASE 1: Fetching Core Info (Must be synchronous) ---

	// 1. Get Basic Info and Increment Views (uses CoreRepo)
	vendorInfo, err := s.CoreRepo.GetVendorBasicInfo(ctx, vendorID)
	if err != nil {
		return nil, fmt.Errorf("failed to get vendor basic info and increment views: %w", err)
	}

	// 2. Get PVS Score (uses CoreRepo)
	trustScore, err := s.CoreRepo.GetVendorTrustScore(ctx, vendorID)
	if err != nil && trustScore == nil {
		trustScore = &models.VendorTrustScore{} // Initialize to prevent nil panic
	}

	// --- PHASE 2: Concurrent Metric/Data Fetching ---

	var wg sync.WaitGroup
	var reviewMetrics *models.ReviewMetricsRaw
	var recentReviews []models.RecentReview
	var recentInquiries []models.RecentInquiry

	// Variables for time-based metrics
	var inquiries7d, reviews7d int
	var avgRating7d float64
	var inquiries30d, reviews30d int
	var avgRating30d float64

	// Error collection channel for concurrent tasks
	errCh := make(chan error, 7)

	// Fetch Review Metrics (using MetricsRepo)
	wg.Add(1)
	go func() {
		defer wg.Done()
		var e error
		reviewMetrics, e = s.MetricsRepo.GetReviewMetrics(ctx, vendorID)
		if e != nil {
			errCh <- fmt.Errorf("failed to get review metrics: %w", e)
		}
	}()

	// Fetch Recent Reviews (using DataRepo)
	wg.Add(1)
	go func() {
		defer wg.Done()
		var e error
		recentReviews, e = s.DataRepo.GetRecentReviews(ctx, vendorID, 5)
		if e != nil {
			errCh <- fmt.Errorf("failed to get recent reviews: %w", e)
		}
	}()

	// Fetch Recent Inquiries (using DataRepo)
	wg.Add(1)
	go func() {
		defer wg.Done()
		var e error
		recentInquiries, e = s.DataRepo.GetRecentInquiries(ctx, vendorID, 5)
		if e != nil {
			errCh <- fmt.Errorf("failed to get recent inquiries: %w", e)
		}
	}()

	// Fetch 7-Day Metrics (using MetricsRepo)
	wg.Add(1)
	go func() {
		defer wg.Done()
		var e error
		inquiries7d, e = s.MetricsRepo.GetInquiryCountByPeriod(ctx, vendorID, 7)
		if e != nil {
			errCh <- fmt.Errorf("failed to get 7d inquiries: %w", e)
		}

		reviews7d, e = s.MetricsRepo.GetReviewCountByPeriod(ctx, vendorID, 7)
		if e != nil {
			errCh <- fmt.Errorf("failed to get 7d reviews: %w", e)
		}

		avgRating7d, e = s.MetricsRepo.GetAverageRatingByPeriod(ctx, vendorID, 7)
		if e != nil {
			errCh <- fmt.Errorf("failed to get 7d avg rating: %w", e)
		}
	}()

	// Fetch 30-Day Metrics (using MetricsRepo)
	wg.Add(1)
	go func() {
		defer wg.Done()
		var e error
		inquiries30d, e = s.MetricsRepo.GetInquiryCountByPeriod(ctx, vendorID, 30)
		if e != nil {
			errCh <- fmt.Errorf("failed to get 30d inquiries: %w", e)
		}

		reviews30d, e = s.MetricsRepo.GetReviewCountByPeriod(ctx, vendorID, 30)
		if e != nil {
			errCh <- fmt.Errorf("failed to get 30d reviews: %w", e)
		}

		avgRating30d, e = s.MetricsRepo.GetAverageRatingByPeriod(ctx, vendorID, 30)
		if e != nil {
			errCh <- fmt.Errorf("failed to get 30d avg rating: %w", e)
		}
	}()

	// Wait for all concurrent tasks to finish
	wg.Wait()
	close(errCh)

	// Check for any errors from the concurrent tasks
	for err := range errCh {
		return nil, fmt.Errorf("concurrent data fetch failed: %w", err)
	}

	// Handle case where GetReviewMetrics failed but didn't return an error via channel
	if reviewMetrics == nil {
		reviewMetrics = &models.ReviewMetricsRaw{RatingCounts: make(map[int]int)}
	}

	// --- PHASE 3: Data Aggregation and Calculation ---
	overview := s.calculateOverview(vendorInfo, trustScore)
	inquiries := s.calculateInquiries(recentInquiries, inquiries7d, inquiries30d)
	reviews := s.calculateReviews(reviewMetrics, recentReviews)

	trends := s.calculateTrends(
		inquiries7d, reviews7d, avgRating7d,
		inquiries30d, reviews30d, avgRating30d,
	)

	performance := s.calculatePerformance(vendorInfo, trustScore)
	insights := s.generateActionableInsights(vendorInfo, reviewMetrics, overview)

	// --- PHASE 4: Final Response ---
	response := &models.VendorAnalyticsResponse{
		VendorID:    vendorInfo.ID,
		VendorName:  vendorInfo.Name,
		Category:    vendorInfo.Category,
		Overview:    overview,
		Inquiries:   inquiries,
		Reviews:     reviews,
		Trends:      trends,
		Performance: performance,
		Insights:    insights,
	}

	return response, nil
}