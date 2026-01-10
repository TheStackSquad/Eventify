// backend/pkg/services/inquiries/inquiries_crud.go

package inquiries

import (
	"context"
	"errors"
	"time"

	"eventify/backend/pkg/models"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (s *inquiryService) CreateInquiry(ctx context.Context, inquiry *models.Inquiry, userID *uuid.UUID) error {
    
    // --- 1. Metadata and Trust Weighting ---
	inquiry.CreatedAt = time.Now()
	inquiry.UpdatedAt = time.Now()

	// Set a default TrustWeight (e.g., 1.0)
    // Complex PVS weighting logic is usually reserved for reviews/bookings, 
    // but a base weight is set here.
    inquiry.TrustWeight = 1.0 
    
    // --- 2. User ID Mapping (using the ToNullUUID helper, if available) ---
    // If you implemented the helper function models.ToNullUUID:
    if userID != nil {
        inquiry.UserID = userID
    }

    // --- 3. Vendor Validation ---
    // Use the GetByID method from the VendorRepo
	_, err := s.VendorRepo.GetByID(ctx, inquiry.VendorID) 
	if err != nil {
		// Note: Check for sql.ErrNoRows explicitly if vendorRepo returns that error
		// For simplicity, we assume any error means validation failed.
		log.Error().Err(err).Msg("Vendor validation failed for inquiry")
		return errors.New("vendor not found")
	}

    // --- 4. Persistence (CRITICAL FIX: Use InquiryWriteRepo) ---
    // The persistence logic uses the dedicated Write Repository
	if err := s.InquiryWriteRepo.Create(ctx, inquiry); err != nil {
        return fmt.Errorf("failed to create inquiry: %w", err)
    }
    
	return nil
}

func (s *inquiryService) GetInquiriesByVendor(ctx context.Context, vendorID string) ([]models.Inquiry, error) {
	if vendorID == "" {
		return nil, errors.New("vendor ID required")
	}

	vendorUUID, err := uuid.Parse(vendorID)
	if err != nil {
		return nil, errors.New("invalid vendor ID format: " + err.Error())
	}

	inquiries, err := s.InquiryReadRepo.GetByVendorID(ctx, vendorUUID)
	if err != nil {
		log.Error().Err(err).Str("vendorID", vendorID).Msg("failed to fetch inquiries")
		return nil, err
	}

	return inquiries, nil
}