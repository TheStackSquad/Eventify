// backend/pkg/services/vendor/vendor_read.go

package vendor

import (
	"context"
	"errors"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

// GetVendorByOwnerID retrieves a vendor by their owner ID
func (s *VendorServiceImpl) GetVendorByOwnerID(ctx context.Context, ownerID uuid.UUID) (*models.Vendor, error) {
	return s.vendorRepo.GetByOwnerID(ctx, ownerID)
}

// GetVendors retrieves vendors with optional filters
func (s *VendorServiceImpl) GetVendors(ctx context.Context, filters map[string]interface{}) ([]models.Vendor, error) {
	processedFilters := s.processFilters(filters)
	repoFilters := make(map[string]string)

	for k, v := range processedFilters {
		if strVal, ok := v.(string); ok {
			repoFilters[k] = strVal
		}
	}

	vendors, err := s.vendorRepo.FindPublicVendors(ctx, repoFilters)
	if err != nil {
		return nil, err
	}

	return s.enrichVendorData(ctx, vendors), nil
}

// GetVendorByID retrieves a vendor by ID
func (s *VendorServiceImpl) GetVendorByID(ctx context.Context, id string) (models.Vendor, error) {
	if id == "" {
		return models.Vendor{}, errors.New("vendor ID is required")
	}

	parsedID, err := uuid.Parse(id)
	if err != nil {
		return models.Vendor{}, errors.New("invalid vendor ID format")
	}

	vendor, err := s.vendorRepo.GetByID(ctx, parsedID)
	if err != nil {
		return models.Vendor{}, err
	}

	return vendor, nil
}

// processFilters removes empty or nil values from filters
func (s *VendorServiceImpl) processFilters(filters map[string]interface{}) map[string]interface{} {
	processed := make(map[string]interface{})
	for k, v := range filters {
		if v != "" && v != nil {
			processed[k] = v
		}
	}
	return processed
}

// enrichVendorData enriches vendor data with additional information
func (s *VendorServiceImpl) enrichVendorData(ctx context.Context, vendors []models.Vendor) []models.Vendor {
	return vendors
}