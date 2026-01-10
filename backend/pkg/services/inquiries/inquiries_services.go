// backend/pkg/services/inquiries/inquiries_services.go

package inquiries

import (
	"context"


	"eventify/backend/pkg/models"
	repoinquiries "eventify/backend/pkg/repository/inquiries"
	repovendor "eventify/backend/pkg/repository/vendor"
	//"fmt"

	"github.com/google/uuid"
)

type InquiryService interface {
	CreateInquiry(ctx context.Context, inquiry *models.Inquiry, userID *uuid.UUID) error
	GetInquiriesByVendor(ctx context.Context, vendorID string) ([]models.Inquiry, error)
	UpdateInquiryStatus(ctx context.Context, inquiryID, status, response string) error
	DeleteInquiry(ctx context.Context, id string) error
}

type inquiryService struct {
	InquiryReadRepo  repoinquiries.InquiryReadRepository
	InquiryWriteRepo repoinquiries.InquiryWriteRepository
	VendorRepo       repovendor.VendorRepository
}

func NewInquiryService(
    inquiryReadRepo repoinquiries.InquiryReadRepository,
    inquiryWriteRepo repoinquiries.InquiryWriteRepository,
    vendorRepo repovendor.VendorRepository,
) InquiryService {
	return &inquiryService{
		InquiryReadRepo:  inquiryReadRepo,
		InquiryWriteRepo: inquiryWriteRepo,
		VendorRepo:       vendorRepo,
	}
}