//backend/pkg/services/review/review_service_read.go

package review

import (
	"context"
	"time"

	"eventify/backend/pkg/models"
	"github.com/google/uuid"
)

func (s *reviewServiceImpl) GetReviewsByVendor(ctx context.Context, vendorID string) ([]models.Review, error) {
	parsedID, err := uuid.Parse(vendorID)
	if err != nil { return nil, err }
	return s.reviewRepo.GetByVendorID(ctx, parsedID)
}

func (s *reviewServiceImpl) CalculateAndUpdateVendorRating(ctx context.Context, vendorID string) error {
	parsedID, err := uuid.Parse(vendorID)
	if err != nil { return err }

	// FIX: Replace the call to the obsolete GetApprovedAverageRating 
    // with the generalized GetAverageRating.
	average, count, err := s.reviewRepo.GetAverageRating(ctx, parsedID)
	if err != nil { return err }

	updateFields := map[string]interface{}{
		"pvs_score": 	  int(average * 20), // Scale 5.0 -> 100
		"review_count": count,
		"updated_at": 	  time.Now(),
	}

	return s.vendorRepo.UpdateFields(ctx, parsedID, updateFields)
}