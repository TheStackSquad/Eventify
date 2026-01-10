// backend/pkg/services/vendor/vendor_write.go

package vendor

import (
	"context"
	"errors"
	"reflect"

	"eventify/backend/pkg/models"
	"github.com/google/uuid"
)

// CreateVendor creates a new vendor
func (s *VendorServiceImpl) CreateVendor(ctx context.Context, vendor *models.Vendor) (string, error) {
	if vendor.Status == "" {
		vendor.Status = models.StatusActive
	}

	vendor.PVSScore = models.CalculatePVS(vendor)

	vendorID, err := s.vendorRepo.Create(ctx, vendor)
	if err != nil {
		return "", err
	}

	return vendorID.String(), nil
}

// UpdateVendor updates a vendor's information
func (s *VendorServiceImpl) UpdateVendor(ctx context.Context, id string, updates map[string]interface{}) error {
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return errors.New("invalid vendor ID format")
	}

	currentVendor, err := s.vendorRepo.GetByID(ctx, parsedID)
	if err != nil {
		return err
	}

	needsPVSRecalculation := s.needsPVSRecalculation(updates)

	if needsPVSRecalculation {
		tempVendor := currentVendor
		s.applyUpdatesToVendor(&tempVendor, updates)

		newScore := models.CalculatePVS(&tempVendor)
		updates["pvs_score"] = newScore
	}

	return s.vendorRepo.UpdateFields(ctx, parsedID, updates)
}

// DeleteVendor deletes a vendor by ID
func (s *VendorServiceImpl) DeleteVendor(ctx context.Context, id string) error {
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return errors.New("invalid vendor ID format")
	}

	deletedCount, err := s.vendorRepo.Delete(ctx, parsedID)
	if err != nil {
		return err
	}

	if deletedCount == 0 {
		return errors.New("vendor not found")
	}

	return nil
}

// CalculateAndUpdatePVS recalculates and updates the PVS score for a vendor
func (s *VendorServiceImpl) CalculateAndUpdatePVS(ctx context.Context, vendorID string) error {
	parsedID, err := uuid.Parse(vendorID)
	if err != nil {
		return errors.New("invalid vendor ID format")
	}

	vendor, err := s.vendorRepo.GetByID(ctx, parsedID)
	if err != nil {
		return err
	}

	newScore := models.CalculatePVS(&vendor)
	return s.vendorRepo.UpdatePVSScore(ctx, parsedID, int(newScore))
}

// UpdateVerificationStatus updates verification flags for a vendor
func (s *VendorServiceImpl) UpdateVerificationStatus(ctx context.Context, vendorID string, field string, isVerified bool, reason string) error {
	parsedID, err := uuid.Parse(vendorID)
	if err != nil {
		return errors.New("invalid vendor ID format")
	}

	return s.vendorRepo.UpdateVerificationFlag(ctx, parsedID, field, isVerified, reason)
}

// needsPVSRecalculation checks if the updates require PVS recalculation
func (s *VendorServiceImpl) needsPVSRecalculation(updates map[string]interface{}) bool {
	pvsFields := map[string]struct{}{
		"category":               {},
		"sub_categories":         {},
		"image_url":              {},
		"is_identity_verified":   {},
		"is_business_registered": {},
	}
	for k := range updates {
		if _, ok := pvsFields[k]; ok {
			return true
		}
	}
	return false
}

// applyUpdatesToVendor applies the updates to a vendor struct
func (s *VendorServiceImpl) applyUpdatesToVendor(vendor *models.Vendor, updates map[string]interface{}) {
	v := reflect.ValueOf(vendor).Elem()
	t := v.Type()

	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		dbTag := field.Tag.Get("db")

		if updateValue, ok := updates[dbTag]; ok {
			if v.Field(i).CanSet() && updateValue != nil {
				if v.Field(i).Kind() == reflect.String {
					if strVal, ok := updateValue.(string); ok {
						v.Field(i).SetString(strVal)
					}
				}
			}
		}
	}
}