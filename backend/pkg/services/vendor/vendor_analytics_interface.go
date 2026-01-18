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
	CoreRepo    repovendor.VendorCoreMetricsRepository
	MetricsRepo repovendor.VendorMetricsRepository
	DataRepo    repovendor.VendorDataRepository
}

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

func (s *vendorAnalyticsServiceImpl) GetVendorAnalytics(
	ctx context.Context,
	vendorID uuid.UUID,
) (*models.VendorAnalyticsResponse, error) {

	// --- PHASE 1: Fetching Core Info (Synchronous) ---
	// Basic Info provides the Name, ID, Category, and vNIN status needed for the calculation methods
	vendorInfo, err := s.CoreRepo.GetVendorBasicInfo(ctx, vendorID)
	if err != nil {
		return nil, fmt.Errorf("failed to get vendor basic info: %w", err)
	}

	// Trust Score (PVS)
	trustScore, err := s.CoreRepo.GetVendorTrustScore(ctx, vendorID)
	if err != nil {
		// We don't fail the whole request if trust score is missing, just default it
		trustScore = &models.VendorTrustScore{TotalTrustWeight: 0} 
	}

	// --- PHASE 2: Concurrent Metric/Data Fetching ---
	var wg sync.WaitGroup
	var reviewMetrics *models.ReviewMetricsRaw
	var recentReviews []models.RecentReview
	var recentInquiries []models.RecentInquiry

	var inquiries7d, reviews7d int
	var avgRating7d float64
	var inquiries30d, reviews30d int
	var avgRating30d float64

	errCh := make(chan error, 5) // Reduced buffer to actual concurrent task count

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

	// 4. 7-Day Window
	wg.Add(1)
	go func() {
		defer wg.Done()
	//	var e error
		inquiries7d, _ = s.MetricsRepo.GetInquiryCountByPeriod(ctx, vendorID, 7)
		reviews7d, _ = s.MetricsRepo.GetReviewCountByPeriod(ctx, vendorID, 7)
		avgRating7d, _ = s.MetricsRepo.GetAverageRatingByPeriod(ctx, vendorID, 7)
	}()

	// 5. 30-Day Window
	wg.Add(1)
	go func() {
		defer wg.Done()
	//	var e error
		inquiries30d, _ = s.MetricsRepo.GetInquiryCountByPeriod(ctx, vendorID, 30)
		reviews30d, _ = s.MetricsRepo.GetReviewCountByPeriod(ctx, vendorID, 30)
		avgRating30d, _ = s.MetricsRepo.GetAverageRatingByPeriod(ctx, vendorID, 30)
	}()

	wg.Wait()
	close(errCh)

	// Log or handle non-critical errors here if desired
	for e := range errCh {
		// Log error but continue if possible, or return error for critical failures
		fmt.Printf("Warning: background fetch error: %v\n", e)
	}

	// Null safety for metrics mapping
	if reviewMetrics == nil {
		reviewMetrics = &models.ReviewMetricsRaw{RatingCounts: make(map[int]int)}
	}

	// --- PHASE 3: Data Aggregation (Using our cleaned-up logic) ---
	overview := s.calculateOverview(vendorInfo, trustScore)
	inquiries := s.calculateInquiries(recentInquiries, inquiries7d, inquiries30d)
	reviews := s.calculateReviews(reviewMetrics, recentReviews)
	trends := s.calculateTrends(inquiries7d, reviews7d, avgRating7d, inquiries30d, reviews30d, avgRating30d)
	performance := s.calculatePerformance(vendorInfo, trustScore)
	insights := s.generateActionableInsights(vendorInfo, reviewMetrics, overview)

	// --- PHASE 4: Final Response ---
	return &models.VendorAnalyticsResponse{
		VendorID:    vendorInfo.ID,
		VendorName:  vendorInfo.Name,
		Category:    vendorInfo.Category,
		Overview:    overview,
		Inquiries:   inquiries,
		Reviews:     reviews,
		Trends:      trends,
		Performance: performance,
		Insights:    insights,
	}, nil
}