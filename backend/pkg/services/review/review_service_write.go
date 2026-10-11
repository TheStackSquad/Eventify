//backend/pkg/services/review/review_service_write.go

package review

import (
	"context"
	"errors"
	"fmt"
	"time"
	"database/sql"

	"github.com/eventify/backend/pkg/models"
	repo "github.com/eventify/backend/pkg/repository/review"
	
)

func (s *reviewServiceImpl) CreateReview(ctx context.Context, review *models.Review) error {
	if review == nil {
		return errors.New("review object is nil")
	}

	// 1. Logic Check: Interaction Verification
	// IPAddress is a NullString, ensure we pass the underlying string value
	hasInquired, err := s.reviewRepo.CheckInteraction(
		ctx,
		review.VendorID,
		review.UserID,
		review.IPAddress.String,
	)
	if err != nil {
		return fmt.Errorf("failed to verify interaction: %w", err)
	}

	// 2. Set Weighting & Verification Status
	if hasInquired {
		review.IsVerified = true
		review.TrustWeight = 5.0
	} else {
		review.IsVerified = false
		review.TrustWeight = 1.0
	}

	// 3. Metadata & NullString Hydration
	// Because the DB columns are now NOT NULL, we ensure these are Valid.
	// This covers cases where JSON binding might leave Valid as false.
	if review.UserName.String != "" {
		review.UserName.Valid = true
	} else if !review.UserName.Valid {
		review.UserName = sql.NullString{String: "Verified Customer", Valid: true}
	}

	if review.Email.String != "" {
		review.Email.Valid = true
	} else if !review.Email.Valid {
		review.Email = sql.NullString{String: "customer@eventify.com", Valid: true}
	}

	review.CreatedAt = time.Now()
	review.UpdatedAt = time.Now()

	// 4. Persist
	if err := s.reviewRepo.Create(ctx, review); err != nil {
		// If it's our specific duplicate error, return it UNWRAPPED 
		if errors.Is(err, repo.ErrDuplicateReview) {
			return err
		}
		return fmt.Errorf("service layer failed to save: %w", err)
	}

	// 5. Update Vendor Stats (Async)
	go func() {
		// Use a background context as the request context might expire
		_ = s.CalculateAndUpdateVendorRating(context.Background(), review.VendorID.String())
	}()

	return nil
}