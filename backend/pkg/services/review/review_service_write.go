//backend/pkg/services/review/review_service_write.go

package review

import (
	"context"
	"errors"
	"fmt"
	"time"

	"eventify/backend/pkg/models"
	
)

func (s *reviewServiceImpl) CreateReview(ctx context.Context, review *models.Review) error {
	if review == nil { return errors.New("review object is nil") }

	// 1. Logic Check: Interaction Verification (The New Trust Engine)
	hasInquired, err := s.reviewRepo.CheckInteraction(
        ctx, 
        review.VendorID, 
        review.UserID,
        review.IPAddress.String,
    )
	if err != nil {
		return fmt.Errorf("failed to verify interaction: %w", err)
	}

	// 2. Set Weighting based on Interaction
	if hasInquired {
		review.IsVerified = true
		review.TrustWeight = 5.0
	} else {
		review.IsVerified = false
		review.TrustWeight = 1.0
	}

	// 3. Metadata Setup
	review.CreatedAt = time.Now()
	review.UpdatedAt = time.Now()

	// 4. Persist
	if err := s.reviewRepo.Create(ctx, review); err != nil {
		return fmt.Errorf("failed to save review: %w", err)
	}

	// 5. Update Vendor Stats (Async-friendly)
	go func() {
		_ = s.CalculateAndUpdateVendorRating(context.Background(), review.VendorID.String())
	}()

	return nil
}
