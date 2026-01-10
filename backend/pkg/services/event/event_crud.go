// backend/pkg/services/event/event_crud.go

package event

import (
	"context"
	"errors"
	"fmt"
	"time"

	"eventify/backend/pkg/models"
	repoevent "eventify/backend/pkg/repository/event"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)


func (s *eventService) CreateEvent(
	ctx context.Context,
	event *models.Event,
	tiers []models.TicketTier,
) error {
	log.Info().
		Str("organizer_id", event.OrganizerID.String()).
		Msg("Service: Starting CreateEvent process")

	if err := s.validateEvent(event); err != nil {
		log.Error().Err(err).Msg("Service: Event validation failed")
		return fmt.Errorf("validation failed: %w", err)
	}

	if len(tiers) == 0 {
		log.Error().Msg("Service: No ticket tiers provided")
		return errors.New("at least one ticket tier is required")
	}

	// 1. START TRANSACTION
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		log.Error().Err(err).Msg("Service: Failed to start transaction")
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	// The defer statement MUST be executed if the function exits early
	defer func() {
		if r := recover(); r != nil {
			log.Error().Interface("panic", r).Msg("Service: PANIC during transaction. Attempting rollback.")
		}
		// Rollback is safe to call even if the transaction was committed; tx.Commit() closes the transaction handle.
		if err := tx.Rollback(); err != nil && err.Error() != "sql: no transaction to rollback" {
			log.Error().Err(err).Msg("Service: Failed to rollback transaction")
		} else {
			log.Info().Msg("Service: Rollback executed successfully (or transaction already closed)")
		}
	}()

	// Generate IDs and set timestamps
	now := time.Now()
	event.ID = uuid.New() // Generate ID at service layer
	event.CreatedAt = now
	event.UpdatedAt = now
	event.IsDeleted = false
	
	log.Debug().
		Str("new_event_id", event.ID.String()).
		Msg("Service: Generated new Event ID and timestamps")

    // --- OLD LOGIC REMOVED ---
    // The previous loop that assigned event.ID to tiers is now WRONG because 
    // it used the unconfirmed ID. We move this assignment step.

	// 2. INSERT EVENT (AND GET CONFIRMED ID)
	// ============================================================================
	log.Info().Str("event_id", event.ID.String()).Msg("Service: Inserting main event record...")
    
    // 🔥 FIX: Capture the confirmed ID returned by the repository
	confirmedEventID, err := s.eventRepo.CreateEvent(ctx, tx, event) 
    
	if err != nil {
		log.Error().Err(err).Str("event_id", event.ID.String()).Msg("Service: FAILED to insert main event. Rolling back.")
		return fmt.Errorf("failed to insert event: %w", err) 
	}
	log.Info().Str("event_id", confirmedEventID.String()).Msg("Service: Main event insertion SUCCESS.")
    
    // CRITICAL NEW STEP: Use the confirmed ID for ALL ticket tiers
    for i := range tiers {
        tiers[i].EventID = confirmedEventID // Use the database-confirmed ID
        tiers[i].ID = uuid.New()
        tiers[i].CreatedAt = now
        tiers[i].UpdatedAt = now
    }
    log.Debug().
        Str("confirmed_event_id", confirmedEventID.String()).
        Msg("Service: Assigned confirmed Event ID to all ticket tiers")


	// 3. INSERT TICKET TIERS
	// ============================================================================
	log.Info().Int("tiers_count", len(tiers)).Msg("Service: Inserting ticket tiers...")
	if err := s.eventRepo.CreateTicketTiers(ctx, tx, tiers); err != nil {
        log.Error().Err(err).Str("event_id", confirmedEventID.String()).Msg("Service: FAILED to insert tiers. Rolling back.")
		return fmt.Errorf("failed to insert tiers: %w", err) 
	}
	log.Info().Int("tiers_count", len(tiers)).Msg("Service: Ticket tier insertion SUCCESS.")


	// 4. COMMIT TRANSACTION
	// ============================================================================
	if err = tx.Commit(); err != nil {
		log.Error().Err(err).Msg("Service: FAILED to commit transaction.")
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	
	log.Info().Str("event_id", confirmedEventID.String()).Msg("Service: Transaction committed successfully.")
	
	return nil
}

// GetEventByID retrieves an event by its ID
func (s *eventService) GetEventByID(
	ctx context.Context,
	eventID uuid.UUID,
	userID *uuid.UUID,
) (*models.Event, error) {
	return s.eventRepo.GetEventByID(ctx, eventID, userID)
}

// GetAllEvents retrieves all public events with filters
func (s *eventService) GetAllEvents(
	ctx context.Context,
	filters repoevent.EventFilters,
) ([]*models.Event, error) {
	filters.IsDeleted = false
	return s.eventRepo.GetEvents(ctx, filters)
}

// GetEventsByOrganizer retrieves events for a specific organizer
func (s *eventService) GetEventsByOrganizer(
	ctx context.Context,
	organizerID uuid.UUID,
	includeDeleted bool,
) ([]*models.Event, error) {
	filters := repoevent.EventFilters{
		OrganizerID: &organizerID,
		IsDeleted:   includeDeleted,
		Limit:       100,
	}

	return s.eventRepo.GetEvents(ctx, filters)
}

// UpdateEvent updates an existing event
func (s *eventService) UpdateEvent(
	ctx context.Context,
	eventID, organizerID uuid.UUID,
	updates *EventUpdateDTO,
) (*models.Event, error) {
	existing, err := s.eventRepo.GetEventByID(ctx, eventID, nil)
	if err != nil {
		return nil, fmt.Errorf("event not found: %w", err)
	}

	if existing.OrganizerID != organizerID {
		return nil, errors.New("unauthorized: you don't own this event")
	}

	if existing.IsDeleted {
		return nil, errors.New("cannot update deleted event")
	}

	query := `UPDATE events SET updated_at = $1`
	args := []interface{}{time.Now()}
	paramIndex := 2

	if updates.EventTitle != nil {
		query += fmt.Sprintf(", event_title = $%d", paramIndex)
		args = append(args, *updates.EventTitle)
		paramIndex++
	}

	if updates.EventDescription != nil {
		query += fmt.Sprintf(", event_description = $%d", paramIndex)
		args = append(args, *updates.EventDescription)
		paramIndex++
	}

	if updates.Category != nil {
		query += fmt.Sprintf(", category = $%d", paramIndex)
		args = append(args, *updates.Category)
		paramIndex++
	}

	if updates.EventType != nil {
		query += fmt.Sprintf(", event_type = $%d", paramIndex)
		args = append(args, *updates.EventType)
		paramIndex++
	}

	if updates.EventImageURL != nil {
		query += fmt.Sprintf(", event_image_url = $%d", paramIndex)
		args = append(args, *updates.EventImageURL)
		paramIndex++
	}

	if updates.VenueName != nil {
		query += fmt.Sprintf(", venue_name = $%d", paramIndex)
		args = append(args, *updates.VenueName)
		paramIndex++
	}

	if updates.VenueAddress != nil {
		query += fmt.Sprintf(", venue_address = $%d", paramIndex)
		args = append(args, *updates.VenueAddress)
		paramIndex++
	}

	if updates.City != nil {
		query += fmt.Sprintf(", city = $%d", paramIndex)
		args = append(args, *updates.City)
		paramIndex++
	}

	if updates.State != nil {
		query += fmt.Sprintf(", state = $%d", paramIndex)
		args = append(args, *updates.State)
		paramIndex++
	}

	if updates.Country != nil {
		query += fmt.Sprintf(", country = $%d", paramIndex)
		args = append(args, *updates.Country)
		paramIndex++
	}

	if updates.VirtualPlatform != nil {
		query += fmt.Sprintf(", virtual_platform = $%d", paramIndex)
		args = append(args, *updates.VirtualPlatform)
		paramIndex++
	}

	if updates.MeetingLink != nil {
		query += fmt.Sprintf(", meeting_link = $%d", paramIndex)
		args = append(args, *updates.MeetingLink)
		paramIndex++
	}

	if updates.StartDate != nil {
		query += fmt.Sprintf(", start_date = $%d", paramIndex)
		args = append(args, *updates.StartDate)
		paramIndex++
	}

	if updates.EndDate != nil {
		query += fmt.Sprintf(", end_date = $%d", paramIndex)
		args = append(args, *updates.EndDate)
		paramIndex++
	}

	if updates.MaxAttendees != nil {
		query += fmt.Sprintf(", max_attendees = $%d", paramIndex)
		args = append(args, *updates.MaxAttendees)
		paramIndex++
	}

	if updates.Tags != nil {
		query += fmt.Sprintf(", tags = $%d", paramIndex)
		args = append(args, *updates.Tags)
		paramIndex++
	}

	query += fmt.Sprintf(" WHERE id = $%d AND organizer_id = $%d AND is_deleted = false", paramIndex, paramIndex+1)
	args = append(args, eventID, organizerID)

	result, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("update failed: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return nil, errors.New("event not found or unauthorized")
	}

	return s.eventRepo.GetEventByID(ctx, eventID, nil)
}

// SoftDeleteEvent marks an event as deleted
func (s *eventService) SoftDeleteEvent(
	ctx context.Context,
	eventID, organizerID uuid.UUID,
) error {
	query := `
		UPDATE events 
		SET is_deleted = true, deleted_at = $1, updated_at = $1
		WHERE id = $2 
		  AND organizer_id = $3 
		  AND is_deleted = false
	`

	result, err := s.db.ExecContext(ctx, query, time.Now(), eventID, organizerID)
	if err != nil {
		return fmt.Errorf("delete failed: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("event not found or unauthorized")
	}

	return nil
}