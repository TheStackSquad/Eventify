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
	
	// FIXED: Signature changed to use TierID and match implementation return types
	CheckTicketAvailability(ctx context.Context, tierID uuid.UUID, quantity int32) (bool, error)
	ReserveTickets(ctx context.Context, tierID uuid.UUID, quantity int32) error
	ValidateAndCheckInTicket(ctx context.Context, ticketCode string) error
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

// EventUpdateDTO for partial updates remains exactly as you designed
type EventUpdateDTO struct {
	EventTitle       *string             `json:"eventTitle"`
	EventDescription *string             `json:"description"`
	Category         *string             `json:"category"`
	EventType        *models.EventType   `json:"eventType"`
	EventImageURL    *string             `json:"imageUrl"`
	VenueName        *string             `json:"venueName"`
	VenueAddress     *string             `json:"venueAddress"`
	City             *string             `json:"city"`
	State            *string             `json:"state"`
	Country          *string             `json:"country"`
	VirtualPlatform  *string             `json:"virtualPlatform"`
	MeetingLink      *string             `json:"meetingLink"`
	StartDate        *time.Time          `json:"startDate"`
	EndDate          *time.Time          `json:"endDate"`
	MaxAttendees     *int32              `json:"maxAttendees"`
	Tickets          []models.TicketTier `json:"tickets"`
	Tags             *[]string           `json:"tags"`
}