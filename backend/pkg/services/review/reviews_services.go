// backend/pkg/services/review/reviews_service.go

package review

import (
	"context"
	"eventify/backend/pkg/models"
	reporeview "eventify/backend/pkg/repository/review"
	repovendor "eventify/backend/pkg/repository/vendor"
	repoinquiries "eventify/backend/pkg/repository/inquiries"
	//"github.com/google/uuid"
)

type ReviewService interface {
	CreateReview(ctx context.Context, review *models.Review) error
	GetReviewsByVendor(ctx context.Context, vendorID string) ([]models.Review, error)
	CalculateAndUpdateVendorRating(ctx context.Context, vendorID string) error
}

type reviewServiceImpl struct {
	reviewRepo reporeview.ReviewRepository
	vendorRepo repovendor.VendorRepository
	inquiryRepo repoinquiries.InquiryReadRepository 
}

func NewReviewService(
	reviewRepo reporeview.ReviewRepository,
	vendorRepo repovendor.VendorRepository,
	inquiryRepo repoinquiries.InquiryReadRepository,
) ReviewService {
	return &reviewServiceImpl{
		reviewRepo: reviewRepo,
		vendorRepo: vendorRepo,
		inquiryRepo: inquiryRepo,
	}
}