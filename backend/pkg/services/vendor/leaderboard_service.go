// backend/pkg/services/vendor/leaderboard_service.go

package vendor

import (
	"context"

	"github.com/eventify/backend/pkg/models"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
)

type VendorLeaderboardService interface {
	GetVendorOfTheMonth(ctx context.Context) (*models.VendorRanking, error)
	GetTopVendorsByCategory(ctx context.Context, category string, limit int) ([]models.VendorRanking, error)
	GetTopVendorsByLocation(ctx context.Context, state, city string, limit int) ([]models.VendorRanking, error)
	GetAllCategoryLeaderboards(ctx context.Context, limit int) (map[string][]models.VendorRanking, error)
	GetMajorLocationLeaderboards(ctx context.Context, limit int) (map[string][]models.VendorRanking, error)
	// Added to match repository and enable the TestEndpoint in handler
	GetLeaderboardCount(ctx context.Context) (int, error) 
}

type vendorLeaderboardServiceImpl struct {
	leaderboardRepo *repovendor.VendorLeaderboardRepo
}

func NewVendorLeaderboardService(repo *repovendor.VendorLeaderboardRepo) VendorLeaderboardService {
	return &vendorLeaderboardServiceImpl{
		leaderboardRepo: repo,
	}
}

func (s *vendorLeaderboardServiceImpl) GetVendorOfTheMonth(ctx context.Context) (*models.VendorRanking, error) {
	return s.leaderboardRepo.GetVendorOfTheMonth(ctx)
}

func (s *vendorLeaderboardServiceImpl) GetLeaderboardCount(ctx context.Context) (int, error) {
	return s.leaderboardRepo.GetLeaderboardCount(ctx)
}

func (s *vendorLeaderboardServiceImpl) GetTopVendorsByCategory(ctx context.Context, category string, limit int) ([]models.VendorRanking, error) {
	if limit <= 0 || limit > 100 {
		limit = 10 
	}
	return s.leaderboardRepo.GetTopVendorsByCategory(ctx, category, limit)
}

func (s *vendorLeaderboardServiceImpl) GetTopVendorsByLocation(ctx context.Context, state, city string, limit int) ([]models.VendorRanking, error) {
	if limit <= 0 || limit > 100 {
		limit = 10
	}
	return s.leaderboardRepo.GetTopVendorsByLocation(ctx, state, city, limit)
}

func (s *vendorLeaderboardServiceImpl) GetAllCategoryLeaderboards(ctx context.Context, limit int) (map[string][]models.VendorRanking, error) {
	if limit <= 0 {
		limit = 5
	}

	vendors, err := s.leaderboardRepo.GetTopByAllCategories(ctx, limit)
	if err != nil {
		return nil, err
	}

	leaderboardMap := make(map[string][]models.VendorRanking)
	for _, v := range vendors {
		leaderboardMap[v.Category] = append(leaderboardMap[v.Category], v)
	}

	return leaderboardMap, nil
}

func (s *vendorLeaderboardServiceImpl) GetMajorLocationLeaderboards(ctx context.Context, limit int) (map[string][]models.VendorRanking, error) {
	if limit <= 0 {
		limit = 5
	}

	majorStates := []string{"Lagos", "Abuja FCT", "Rivers"}
	locationMap := make(map[string][]models.VendorRanking)

	for _, state := range majorStates {
		vendors, err := s.leaderboardRepo.GetTopVendorsByLocation(ctx, state, "", limit)
		if err == nil && len(vendors) > 0 {
			locationMap[state] = vendors
		}
	}

	return locationMap, nil
}