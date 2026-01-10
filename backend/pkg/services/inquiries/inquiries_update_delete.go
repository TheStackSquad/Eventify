// backend/pkg/services/inquiries/inquiries_update_delete.go

package inquiries

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func (s *inquiryService) UpdateInquiryStatus(ctx context.Context, inquiryID, status, response string) error {
	inquiryUUID, err := uuid.Parse(inquiryID)
	if err != nil {
		return errors.New("invalid inquiry ID format")
	}

	updateFields := map[string]interface{}{
		"updated_at": time.Now(),
	}

	// Add status and response to update if provided
	if status != "" {
		updateFields["status"] = status
	}
	if response != "" {
		updateFields["response"] = response
	}

	// Check if we have more than just updated_at to update
	if len(updateFields) == 1 {
		// Only updated_at was set, nothing meaningful to update
		log.Warn().Str("inquiryID", inquiryID).Msg("No status or response provided for update")
		return nil
	}

	err = s.InquiryWriteRepo.UpdateFields(ctx, inquiryUUID, updateFields)
	if err != nil {
		log.Error().Err(err).Str("inquiryID", inquiryID).Msg("Failed to update inquiry status in repository")
		return err
	}

	return nil
}

func (s *inquiryService) DeleteInquiry(ctx context.Context, id string) error {
	inquiryUUID, err := uuid.Parse(id)
	if err != nil {
		return errors.New("invalid inquiry ID format")
	}

	inquiry, err := s.InquiryReadRepo.FindByID(ctx, inquiryUUID)
	if err != nil {
		log.Error().Err(err).Str("inquiryID", id).Msg("failed to find inquiry before deletion")
		return err
	}

	if inquiry == nil {
		return errors.New("inquiry not found")
	}

	err = s.InquiryWriteRepo.Delete(ctx, inquiryUUID)
	if err != nil {
		log.Error().Err(err).Str("inquiryID", id).Msg("failed to delete inquiry")
		return err
	}

	err = s.VendorRepo.IncrementField(ctx, inquiry.VendorID, "inquiry_count", -1)
	if err != nil {
		log.Error().Err(err).Str("vendorID", inquiry.VendorID.String()).Msg("failed to decrement vendor inquiry count")
	}

	return nil
}