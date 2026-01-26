//backend/pkg/services/review/review_service_write.go

package review

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/models"
	repo "github.com/eventify/backend/pkg/repository/review"
	
)

// backend/pkg/services/review/review_service_write.go

func (s *reviewServiceImpl) CreateReview(ctx context.Context, review *models.Review) error {
	if review == nil {
		return errors.New("review object is nil")
	}

	// 1. Logic Check: Interaction Verification
	hasInquired, err := s.reviewRepo.CheckInteraction(
		ctx,
		review.VendorID,
		review.UserID,
		review.IPAddress.String,
	)
	if err != nil {
		return fmt.Errorf("failed to verify interaction: %w", err)
	}

	// 2. Set Weighting
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
        // If it's our specific duplicate error, return it UNWRAPPED 
        // to ensure the Handler sees it immediately.
        if errors.Is(err, repo.ErrDuplicateReview) {
            return err
        }
        return fmt.Errorf("service layer failed to save: %w", err)
    }

	// 5. Update Vendor Stats (Async-friendly)
	// We only get here if Step 4 succeeded
	go func() {
		// Use a background context as the request context might expire
		_ = s.CalculateAndUpdateVendorRating(context.Background(), review.VendorID.String())
	}()

	return nil
}