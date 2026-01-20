//pkg/services/vendor/vendor_write.go

package vendor

import (
	"context"
	"errors"
	"reflect"
	"database/sql"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

func (s *VendorServiceImpl) CreateVendor(ctx context.Context, vendor *models.Vendor) (string, error) {
	// 1. Strict Validation: Vendor cannot exist without vNIN
	// We check .Valid (is it not null?) and .String (is it not empty?)
	if !vendor.VNIN.Valid || vendor.VNIN.String == "" {
		return "", errors.New("vNIN is mandatory for vendor registration")
	}

	// 2. Business Rules: Set default status if empty
	if vendor.Status == "" {
		vendor.Status = models.StatusActive
	}

	// 3. Auto-verify identity since vNIN is now guaranteed present
	vendor.IsIdentityVerified = true

	// 4. Auto-verify business if CAC number is provided
	// Fix: vendor.CACNumber is sql.NullString, IsBusinessVerified is sql.NullBool
	if vendor.CACNumber.Valid && vendor.CACNumber.String != "" {
		vendor.IsBusinessVerified = sql.NullBool{
			Bool:  true,
			Valid: true,
		}
	}

	// 5. Calculate initial PVS score
	vendor.PVSScore = models.CalculatePVS(vendor)

	// 6. Persistence
	vendorID, err := s.vendorRepo.Create(ctx, vendor)
	if err != nil {
		return "", err
	}
	
	return vendorID.String(), nil
}

func (s *VendorServiceImpl) UpdateVendor(ctx context.Context, id string, requestorID uuid.UUID, updates map[string]interface{}) error {
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return errors.New("invalid vendor ID format")
	}

	// Get current vendor to verify ownership
	currentVendor, err := s.vendorRepo.GetByID(ctx, parsedID)
	if err != nil {
		return err
	}
	if currentVendor.OwnerID != requestorID {
		return errors.New("unauthorized")
	}

	// Security: Verify vNIN if being updated
	if v, ok := updates["vnin"]; ok {
		if snap, snapOk := updates["verifiedVnin"]; !snapOk || v != snap {
			return errors.New("identity verification mismatch")
		}
		updates["is_identity_verified"] = true
	}
	
	// Security: Verify CAC number if being updated
	if c, ok := updates["cac_number"]; ok {
		if snap, snapOk := updates["verifiedCacNumber"]; !snapOk || c != snap {
			return errors.New("business verification mismatch")
		}
		updates["is_business_verified"] = true
	}
	
	// Recalculate PVS score if needed
	if s.needsPVSRecalculation(updates) {
		tempVendor := currentVendor
		s.applyUpdatesToVendor(&tempVendor, updates)
		newScore := models.CalculatePVS(&tempVendor)
		updates["pvs_score"] = newScore
	}
	
	return s.vendorRepo.UpdateFields(ctx, parsedID, updates)
}

func (s *VendorServiceImpl) UpdateVerificationStatus(ctx context.Context, vendorID string, field string, isVerified bool, reason string) error {
	parsedID, err := uuid.Parse(vendorID)
	if err != nil {
		return errors.New("invalid vendor ID format")
	}
	return s.vendorRepo.UpdateVerificationFlag(ctx, parsedID, field, isVerified, reason)
}

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

// Helper: Check if updates require PVS recalculation
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

// Helper: Apply updates to a vendor struct (for PVS calculation)
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