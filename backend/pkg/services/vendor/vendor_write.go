// pkg/services/vendor/vendor_write.go

package vendor

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"reflect"
	"strings"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

// CreateVendor registers a new vendor profile
func (s *VendorServiceImpl) CreateVendor(ctx context.Context, vendor *models.Vendor) (string, error) {
	// Step 1: Check row existence (includes soft-deleted rows)
	isRegistered, err := s.vendorRepo.IsRegisteredVendor(ctx, vendor.OwnerID)
	if err != nil {
		return "", fmt.Errorf("failed to check vendor registration: %w", err)
	}

	if isRegistered {
		// Row exists — determine whether it's active or soft-deleted
		existingVendor, err := s.vendorRepo.GetByOwnerID(ctx, vendor.OwnerID)
		if err != nil {
			return "", fmt.Errorf("failed to check existing vendor: %w", err)
		}
		if existingVendor == nil {
			// GetByOwnerID filters deleted_at IS NULL — nil here means soft-deleted
			return "", errors.New("you previously had a vendor account that was deleted. Please contact support to restore it")
		}
		return "", errors.New("user already has an active vendor account")
	}

	// Step 2: Validate required fields
	if strings.TrimSpace(vendor.VNIN) == "" {
		return "", errors.New("vNIN is mandatory for vendor registration")
	}

	// Step 3: Apply business rules
	if vendor.Status == "" {
		vendor.Status = models.VendorStatusActive
	}

	// Auto-verify identity since vNIN is guaranteed present
	vendor.IsIdentityVerified = true

	// Auto-verify business if CAC number is provided
	if vendor.CACNumber.Valid && vendor.CACNumber.String != "" {
		vendor.IsBusinessVerified = sql.NullBool{
			Bool:  true,
			Valid: true,
		}
	}

	// Step 4: Calculate initial PVS score
	vendor.PVSScore = models.CalculatePVS(vendor)

	// Step 5: Persist
	vendorID, err := s.vendorRepo.Create(ctx, vendor)
	if err != nil {
		return "", err
	}

	return vendorID.String(), nil
}

// UpdateVendor modifies an existing vendor profile
func (s *VendorServiceImpl) UpdateVendor(ctx context.Context, id string, requestorID uuid.UUID, updatedVendor *models.Vendor) error {
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return errors.New("invalid vendor ID format")
	}

	// Fetch current vendor (for ownership check + PVS calculation)
	currentVendor, err := s.vendorRepo.GetByID(ctx, parsedID)
	if err != nil {
		return err
	}

	// Ownership check
	if currentVendor.OwnerID != requestorID {
		return errors.New("unauthorized")
	}

	// CRITICAL: Set ID and OwnerID on the update struct
	updatedVendor.ID = parsedID
	updatedVendor.OwnerID = requestorID

	// Preserve fields needed for PVS calculation (don't overwrite)
	updatedVendor.ProfileCompletion = currentVendor.ProfileCompletion
	updatedVendor.InquiryCount = currentVendor.InquiryCount
	updatedVendor.RespondedCount = currentVendor.RespondedCount
	updatedVendor.ReviewCount = currentVendor.ReviewCount

	// Don't automatically set IsBusinessVerified based on CAC presence
	if !updatedVendor.IsBusinessVerified.Valid {
		updatedVendor.IsBusinessVerified = currentVendor.IsBusinessVerified
	}

	// Recalculate PVS Score with complete data
	updatedVendor.PVSScore = models.CalculatePVS(updatedVendor)

	// Persist
	return s.vendorRepo.Update(ctx, updatedVendor)
}

// UpdateVerificationStatus modifies vendor verification flags
func (s *VendorServiceImpl) UpdateVerificationStatus(ctx context.Context, vendorID string, field string, isVerified bool, reason string) error {
	parsedID, err := uuid.Parse(vendorID)
	if err != nil {
		return errors.New("invalid vendor ID format")
	}
	return s.vendorRepo.UpdateVerificationFlag(ctx, parsedID, field, isVerified, reason)
}

// DeleteVendor soft-deletes a vendor profile
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

// needsPVSRecalculation checks if updates require PVS recalculation
func (s *VendorServiceImpl) needsPVSRecalculation(updates map[string]interface{}) bool {
	pvsFields := map[string]struct{}{
		"category":             {},
		"image_url":            {},
		"is_identity_verified": {},
		"is_business_verified": {},
		"description":          {},
		"min_price":            {},
		"phone_number":         {},
	}
	for k := range updates {
		if _, ok := pvsFields[k]; ok {
			return true
		}
	}
	return false
}

// applyUpdatesToVendor applies updates to a vendor struct (for PVS calculation)
func (s *VendorServiceImpl) applyUpdatesToVendor(vendor *models.Vendor, updates map[string]interface{}) {
	v := reflect.ValueOf(vendor).Elem()
	t := v.Type()
	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		dbTag := field.Tag.Get("db")
		if updateValue, ok := updates[dbTag]; ok {
			f := v.Field(i)
			if f.CanSet() && updateValue != nil {
				val := reflect.ValueOf(updateValue)
				if val.Type().AssignableTo(f.Type()) {
					f.Set(val)
				}
			}
		}
	}
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