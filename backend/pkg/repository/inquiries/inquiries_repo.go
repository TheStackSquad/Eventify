// backend/pkg/repository/inquiries/inquiries_repo.go

package inquiries

import (
	"context"

	"eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type InquiryReadRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*models.Inquiry, error)
	GetByVendorID(ctx context.Context, vendorID uuid.UUID) ([]models.Inquiry, error)
}


type InquiryWriteRepository interface {
	Create(ctx context.Context, inquiry *models.Inquiry) error
	Delete(ctx context.Context, id uuid.UUID) error
	UpdateFields(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error
}

type InquiryRepository struct {
	// These embedded fields must match the interfaces defined above.
	InquiryReadRepository
	InquiryWriteRepository
}


func NewInquiryRepository(db *sqlx.DB) *InquiryRepository {
	readRepo := &PostgresInquiryReadRepository{DB: db}
	writeRepo := &PostgresInquiryWriteRepository{DB: db}

	return &InquiryRepository{
		InquiryReadRepository:  readRepo,
		InquiryWriteRepository: writeRepo,
	}
}

// Note: PostgresInquiryReadRepository and PostgresInquiryWriteRepository 
// must be defined in inquiries_read_repo.go and inquiries_write_repo.go respectively, 
// NOT in this file, to prevent the original re-declaration errors.
//