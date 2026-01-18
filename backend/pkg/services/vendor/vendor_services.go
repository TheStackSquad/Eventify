// backend/pkg/services/vendor/vendor_services.go

package vendor

import (
	"context"

	"github.com/eventify/backend/pkg/models"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	"github.com/google/uuid"
)

// VendorService defines the contract for vendor CRUD operations
type VendorService interface {
	GetVendors(ctx context.Context, filters map[string]interface{}) ([]models.Vendor, error)
	GetVendorByID(ctx context.Context, id string) (models.Vendor, error)
	GetVendorByOwnerID(ctx context.Context, ownerID uuid.UUID) (*models.Vendor, error)
	CreateVendor(ctx context.Context, vendor *models.Vendor) (string, error)
	UpdateVendor(ctx context.Context, id string, requestorID uuid.UUID, updates map[string]interface{}) error
	DeleteVendor(ctx context.Context, id string) error
	CalculateAndUpdatePVS(ctx context.Context, vendorID string) error
	UpdateVerificationStatus(ctx context.Context, vendorID string, field string, isVerified bool, reason string) error
}

// VendorServiceImpl implements the VendorService interface
type VendorServiceImpl struct {
	vendorRepo repovendor.VendorRepository
}

// NewVendorService creates a new instance of VendorService
func NewVendorService(vendorRepo repovendor.VendorRepository) *VendorServiceImpl {
	return &VendorServiceImpl{
		vendorRepo: vendorRepo,
	}
}

