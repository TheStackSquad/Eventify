// backend/pkg/services/event/event_crud.go

package event

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/models"
	repoevent "github.com/eventify/backend/pkg/repository/event"
	"github.com/eventify/backend/pkg/utils"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// CreateEvent creates a new event with associated ticket tiers
func (s *eventService) CreateEvent(
	ctx context.Context,
	event *models.Event,
	tiers []models.TicketTier,
) error {
	log.Info().
		Str("organizer_id", event.OrganizerID.String()).
		Msg("Service: Starting CreateEvent process")

	if err := s.validateEvent(event); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	// Generate slug from title
	event.EventSlug = models.ToNullString(utils.GenerateSlug(event.EventTitle))

	if len(tiers) == 0 {
		return errors.New("at least one ticket tier is required")
	}

	// Begin transaction
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer func() {
		if r := recover(); r != nil {
			log.Error().Interface("panic", r).Msg("Service: PANIC. Rolling back.")
			tx.Rollback()
		}
	}()

	// Prepare event data
	now := time.Now()
	event.ID = uuid.New()
	event.CreatedAt = now
	event.UpdatedAt = now

	// Create event
	confirmedEventID, err := s.eventRepo.CreateEvent(ctx, tx, event)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to insert event: %w", err)
	}

	// Prepare ticket tiers
	for i := range tiers {
		tiers[i].PriceKobo = tiers[i].PriceKobo * 100 // Convert to Kobo
		tiers[i].EventID = confirmedEventID
		tiers[i].ID = uuid.New()
		tiers[i].Sold = 0
		tiers[i].Available = tiers[i].Capacity
		tiers[i].CreatedAt = now
		tiers[i].UpdatedAt = now
	}

	// Create ticket tiers
	if err := s.eventRepo.CreateTicketTiers(ctx, tx, confirmedEventID, tiers); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to insert tiers: %w", err)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

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
		return nil, errors.New("unauthorized: you do not own this event")
	}

	if existing.IsDeleted {
		return nil, errors.New("cannot update a deleted event")
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Business Rule: Guard against modification of tiers with existing sales
	if updates.Tickets != nil {
		for _, updatedTier := range updates.Tickets {
			for _, existingTier := range existing.TicketTiers {
				// If IDs match and sales exist, check if sensitive fields are being changed
				if updatedTier.ID == existingTier.ID && existingTier.Sold > 0 {
					if updatedTier.PriceKobo != existingTier.PriceKobo || updatedTier.Name != existingTier.Name {
						return nil, errors.New("cannot change price or name of a ticket tier that has already started selling")
					}
				}
			}
		}
	}

	// 2. Apply updates (Slug generation happens inside applyUpdatesToModel)
	updatedModel := s.applyUpdatesToModel(existing, updates)
	updatedModel.UpdatedAt = time.Now()

	if err := s.eventRepo.UpdateEvent(ctx, tx, updatedModel); err != nil {
		return nil, fmt.Errorf("failed to update event record: %w", err)
	}

	// 3. Sync Tiers (Note: We removed the *100 loop because it's now in the handler/DTO mapping)
	if updates.Tickets != nil {
		if err := s.eventRepo.SyncTicketTiers(ctx, tx, eventID, updates.Tickets); err != nil {
			return nil, fmt.Errorf("failed to sync ticket tiers: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit update: %w", err)
	}

	return s.eventRepo.GetEventByID(ctx, eventID, nil)
}

// SoftDeleteEvent marks an event as deleted if no tickets have been sold
func (s *eventService) SoftDeleteEvent(
	ctx context.Context,
	eventID, organizerID uuid.UUID,
) error {
	// Get existing event with tiers
	existing, err := s.eventRepo.GetEventByID(ctx, eventID, nil)
	if err != nil {
		return fmt.Errorf("event not found: %w", err)
	}

	// Validate ownership
	if existing.OrganizerID != organizerID {
		return errors.New("unauthorized: you do not own this event")
	}

	// Check if already deleted
	if existing.IsDeleted {
		return nil // Already deleted, no action needed
	}

	// Check for active ticket sales
	for _, tier := range existing.TicketTiers {
		if tier.Sold > 0 {
			log.Warn().
				Str("event_id", eventID.String()).
				Int32("sold_count", tier.Sold).
				Msg("Service: Blocked deletion of event with active sales")
			return errors.New("cannot delete event: tickets have already been sold. Please contact support for cancellations")
		}
	}

	// Delegate deletion to repository
	if err := s.eventRepo.SoftDeleteEvent(ctx, eventID); err != nil {
		return fmt.Errorf("failed to delete event: %w", err)
	}

	log.Info().Str("event_id", eventID.String()).Msg("Service: Event soft-deleted successfully")
	return nil
}

// applyUpdatesToModel maps DTO patches to the Event model
func (s *eventService) applyUpdatesToModel(m *models.Event, u *EventUpdateDTO) *models.Event {
    // 1. Logic for Fields that trigger Side Effects
    if u.EventTitle != nil {
        m.EventTitle = *u.EventTitle
        // Slugs use NullString in DB, so we use your helper
        m.EventSlug = models.ToNullString(utils.GenerateSlug(*u.EventTitle))
    }

    // 2. Logic for Standard Pointers (Direct Assignment)
    if u.EventDescription != nil { m.EventDescription = *u.EventDescription }
    if u.Category != nil { m.Category = *u.Category }
    if u.EventType != nil { m.EventType = *u.EventType }
    if u.EventImageURL != nil { m.EventImageURL = *u.EventImageURL }
    
    // These match the *string type in your models.Event
    if u.VenueName != nil { m.VenueName = u.VenueName }
    if u.VenueAddress != nil { m.VenueAddress = u.VenueAddress }
    if u.City != nil { m.City = u.City }
    if u.State != nil { m.State = u.State }
    if u.Country != nil { m.Country = u.Country }
    
    if u.VirtualPlatform != nil { m.VirtualPlatform = u.VirtualPlatform }
    if u.MeetingLink != nil { m.MeetingLink = u.MeetingLink }

    // 3. Logic for Value Types
    if u.StartDate != nil { m.StartDate = *u.StartDate }
    if u.EndDate != nil { m.EndDate = *u.EndDate }
    if u.MaxAttendees != nil { m.MaxAttendees = u.MaxAttendees }

    // 4. Logic for Slices (Dereferencing the DTO pointer)
    if u.Tags != nil {
        m.Tags = *u.Tags
    }

    return m
}