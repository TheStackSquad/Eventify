//pkg/services/vendor/vendor_write.go

package vendor

import (
	"context"
	"errors"
	"reflect"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

func (s *VendorServiceImpl) CreateVendor(ctx context.Context, vendor *models.Vendor) (string, error) {
	if vendor.Status == "" {
		vendor.Status = models.StatusActive
	}
	if vendor.VNIN != "" {
		vendor.IsIdentityVerified = true
	}
	if vendor.CACNumber != "" {
		vendor.IsBusinessVerified = true
	}
	vendor.PVSScore = models.CalculatePVS(vendor)

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

	currentVendor, err := s.vendorRepo.GetByID(ctx, parsedID)
	if err != nil {
		return err
	}
	if currentVendor.OwnerID != requestorID {
		return errors.New("unauthorized")
	}

	if v, ok := updates["vnin"]; ok {
		if snap, snapOk := updates["verifiedVnin"]; !snapOk || v != snap {
			return errors.New("identity verification mismatch")
		}
		updates["is_identity_verified"] = true
	}
	if c, ok := updates["cac_number"]; ok {
		if snap, snapOk := updates["verifiedCacNumber"]; !snapOk || c != snap {
			return errors.New("business verification mismatch")
		}
		updates["is_business_verified"] = true
	}
	if s.needsPVSRecalculation(updates) {
		tempVendor := currentVendor
		s.applyUpdatesToVendor(&tempVendor, updates)
		newScore := models.CalculatePVS(&tempVendor)
		updates["pvs_score"] = newScore
	}
	return s.vendorRepo.UpdateFields(ctx, parsedID, updates)
}

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