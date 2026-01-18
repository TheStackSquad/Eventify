// backend/pkg/services/event/event_services.go

package event

import (
	"context"
	"time"

	"github.com/eventify/backend/pkg/models"
	repoevent "github.com/eventify/backend/pkg/repository/event"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// EventService defines the business logic for events
type EventService interface {
	CreateEvent(ctx context.Context, event *models.Event, tiers []models.TicketTier) error
	GetEventByID(ctx context.Context, eventID uuid.UUID, userID *uuid.UUID) (*models.Event, error)
	GetEventsByOrganizer(ctx context.Context, organizerID uuid.UUID, includeDeleted bool) ([]*models.Event, error)
	GetAllEvents(ctx context.Context, filters repoevent.EventFilters) ([]*models.Event, error)
	UpdateEvent(ctx context.Context, eventID, organizerID uuid.UUID, updates *EventUpdateDTO) (*models.Event, error)
	SoftDeleteEvent(ctx context.Context, eventID, organizerID uuid.UUID) error
	GetEventAnalytics(ctx context.Context, eventID, organizerID uuid.UUID) (*EventAnalytics, error)
	CheckTicketAvailability(ctx context.Context, eventID uuid.UUID, tierName string, quantity int) error
	ReserveTickets(ctx context.Context, eventID uuid.UUID, tierName string, quantity int) error
}

type eventService struct {
	db        *sqlx.DB
	eventRepo repoevent.EventRepository
}

func NewEventService(db *sqlx.DB, eventRepo repoevent.EventRepository) EventService {
	return &eventService{
		db:        db,
		eventRepo: eventRepo,
	}
}

// EventUpdateDTO for partial updates
type EventUpdateDTO struct {
	EventTitle       *string
	EventDescription *string
	Category         *string
	EventType        *models.EventType
	EventImageURL    *string
	VenueName        *string
	VenueAddress     *string
	City             *string
	State            *string
	Country          *string
	VirtualPlatform  *string
	MeetingLink      *string
	StartDate        *time.Time
	EndDate          *time.Time
	MaxAttendees     *int32
	Tags             *[]string
}