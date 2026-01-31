// backend/pkg/handlers/events_create.go

package event

import (
	"context"
	"net/http"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/eventify/backend/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// TicketTierInput represents ticket tier data from request payload
type TicketTierInput struct {
	TierName    string  `json:"tierName" binding:"required"`
	Price       float64 `json:"price" binding:"required,gte=0"` // In Naira (decimal)
	Quantity    int32   `json:"quantity" binding:"required,gt=0"`
	Description *string `json:"description"`
}

// EventCreateRequest defines the event creation payload
type EventCreateRequest struct {
	OrganizerID      uuid.UUID         `json:"-"` // Set from JWT, not user input
	EventTitle       string            `json:"eventTitle" binding:"required"`
	EventDescription string            `json:"eventDescription" binding:"required"`
	Category         string            `json:"category" binding:"required"`
	EventType        string            `json:"eventType" binding:"required,oneof=physical virtual"`
	EventImageURL    string            `json:"eventImage" binding:"required"`
	VenueName        *string           `json:"venueName"`
	VenueAddress     *string           `json:"venueAddress"`
	City             *string           `json:"city"`
	State            *string           `json:"state"`
	Country          *string           `json:"country"`
	VirtualPlatform  *string           `json:"virtualPlatform"`
	MeetingLink      *string           `json:"meetingLink"`
	StartDate        time.Time         `json:"startDate" binding:"required"`
	EndDate          time.Time         `json:"endDate" binding:"required"`
	MaxAttendees     *int32            `json:"maxAttendees"`
	Tags             []string          `json:"tags"`
	TicketTiers      []TicketTierInput `json:"ticketTiers" binding:"required,min=1"`
}

// MapToModels converts request DTO to domain models
func (req *EventCreateRequest) MapToModels() (*models.Event, []models.TicketTier) {
	event := &models.Event{
		OrganizerID:      req.OrganizerID,
		EventTitle:       req.EventTitle,
		EventDescription: req.EventDescription,
		Category:         req.Category,
		EventType:        models.EventType(req.EventType),
		EventImageURL:    req.EventImageURL,
		VenueName:        req.VenueName,
		VenueAddress:     req.VenueAddress,
		City:             req.City,
		State:            req.State,
		Country:          req.Country,
		VirtualPlatform:  req.VirtualPlatform,
		MeetingLink:      req.MeetingLink,
		StartDate:        req.StartDate,
		EndDate:          req.EndDate,
		MaxAttendees:     req.MaxAttendees,
		Tags:             req.Tags,
	}
	if event.Tags == nil {
		event.Tags = []string{}
	}

	// Convert ticket tiers
	tiers := make([]models.TicketTier, len(req.TicketTiers))
	for i, t := range req.TicketTiers {
		tiers[i] = models.TicketTier{
			ID:          uuid.New(), // Generate new ID for each tier
			Name:        t.TierName,
			Description: t.Description,
			// IMPORTANT: Convert Naira to Kobo for storage
			// Price is in Naira from frontend, multiply by 100 to get kobo
			PriceKobo:   int64(t.Price * 100), // Convert Naira to Kobo
			Capacity:    t.Quantity,
			Sold:        0,        // Initialize to 0 for new events
			Available:   t.Quantity, // Initially all tickets are available
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
		
		// Also set the Price field for display (in Naira)
		tiers[i].Price = t.Price
	}
	return event, tiers
}

// CreateEvent handles HTTP POST request to create a new event
func (h *EventHandler) CreateEvent(c *gin.Context) {
	// Extract organizer ID from authentication
	organizerID, err := extractUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Authentication required"})
		return
	}

	// Bind and validate request payload
	var req EventCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("Handler: Invalid request payload")
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request data",
			"errors":  utils.GetValidationErrors(err),
		})
		return
	}
	req.OrganizerID = organizerID

	// Map to domain models
	event, tiers := req.MapToModels()

	// Log the conversion for debugging
	log.Info().
		Str("organizer_id", organizerID.String()).
		Int("ticket_count", len(tiers)).
		Msg("Handler: Converting ticket prices for create")
	
	// Debug log each ticket conversion
	for i, tier := range tiers {
		log.Debug().
			Str("tier_name", tier.Name).
			Float64("price_naira", tier.Price).
			Int64("price_kobo", tier.PriceKobo).
			Msgf("Handler: Ticket %d - Naira→Kobo conversion", i+1)
	}

	// Call service layer with timeout
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	err = h.eventService.CreateEvent(ctx, event, tiers)
	if err != nil {
		log.Error().Err(err).
			Str("organizer_id", organizerID.String()).
			Msg("Handler: Service layer failed to create event")

		// Map application errors to HTTP status codes
		if appErr, ok := err.(*utils.AppError); ok {
			c.JSON(appErr.HTTPStatus(), gin.H{"message": appErr.Message})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create event", "error": err.Error()})
		return
	}

	// Success response
	log.Info().
		Str("event_id", event.ID.String()).
		Str("slug", event.EventSlug.String).
		Msg("Handler: Event creation successful")

	c.JSON(http.StatusCreated, gin.H{
		"message": "Event created successfully",
		"data": gin.H{
			"eventId": event.ID,
			"slug":    event.EventSlug.String,
			"event":   event,
		},
	})
}