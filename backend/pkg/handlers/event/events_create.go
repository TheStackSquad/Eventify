// backend/pkg/handlers/events_create.go

package event

import (
	"context"
	"net/http"
	"time"

	"eventify/backend/pkg/models"
	"eventify/backend/pkg/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type EventCreateRequest struct {
	OrganizerID            uuid.UUID         `json:"organizerId"`
	EventTitle             string            `json:"eventTitle" binding:"required"`
	EventDescription       string            `json:"eventDescription" binding:"required"`
	Category               string            `json:"category" binding:"required"`
	EventType              string            `json:"eventType" binding:"required,oneof=physical virtual"`
	EventImageURL          string            `json:"eventImage" binding:"required"`
	VenueName              *string           `json:"venueName"`
	VenueAddress           *string           `json:"venueAddress"`
	City                   *string           `json:"city"`
	State                  *string           `json:"state"`
	Country                *string           `json:"country"`
	VirtualPlatform        *string           `json:"virtualPlatform"`
	MeetingLink            *string           `json:"meetingLink"`
	StartDate              time.Time         `json:"startDate" binding:"required"`
	EndDate                time.Time         `json:"endDate" binding:"required"`
	MaxAttendees           *int32            `json:"maxAttendees"`
	PaystackSubaccountCode *string           `json:"paystackSubaccountCode"`
	Tags                   []string          `json:"tags"`
	TicketTiers            []TicketTierInput `json:"ticketTiers" binding:"required,min=1"`
}

type TicketTierInput struct {
	TierName    string  `json:"tierName" binding:"required"`
	Price       float64 `json:"price" binding:"required,gte=0"`
	Quantity    int32   `json:"quantity" binding:"required,gt=0"`
	Description *string `json:"description"`
}

func (req *EventCreateRequest) toEventModel() *models.Event {
	event := &models.Event{
		ID:                     uuid.New(),
		OrganizerID:            req.OrganizerID,
		EventTitle:             req.EventTitle,
		EventDescription:       req.EventDescription,
		Category:               req.Category,
		EventType:              models.EventType(req.EventType),
		EventImageURL:          req.EventImageURL,
		VenueName:              req.VenueName,
		VenueAddress:           req.VenueAddress,
		City:                   req.City,
		State:                  req.State,
		Country:                req.Country,
		VirtualPlatform:        req.VirtualPlatform,
		MeetingLink:            req.MeetingLink,
		StartDate:              req.StartDate,
		EndDate:                req.EndDate,
		MaxAttendees:           req.MaxAttendees,
		PaystackSubaccountCode: req.PaystackSubaccountCode,
		Tags:                   req.Tags,
		CreatedAt:              time.Now(),
		UpdatedAt:              time.Now(),
	}
	if event.Tags == nil {
		event.Tags = []string{}
	}
	return event
}

func (req *EventCreateRequest) toTicketTierModels(eventID uuid.UUID) []models.TicketTier {
	tiers := make([]models.TicketTier, len(req.TicketTiers))
	now := time.Now()
	for i, tier := range req.TicketTiers {
		priceKobo := int32(tier.Price * 100)
		tiers[i] = models.TicketTier{
			ID:          uuid.New(),
			EventID:     eventID,
			Name:        tier.TierName,
			Description: tier.Description,
			PriceKobo:   priceKobo,
			Capacity:    tier.Quantity,
			Sold:        0,
			Available:   tier.Quantity,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		log.Debug().
			Int("tier_index", i).
			Str("name", tier.TierName).
			Float64("price_naira", tier.Price).
			Int32("price_kobo", priceKobo).
			Int32("capacity", tier.Quantity).
			Msg("Converting ticket tier")
	}
	return tiers
}

func validateEventRequest(req *EventCreateRequest) error {
	if req.EndDate.Before(req.StartDate) || req.EndDate.Equal(req.StartDate) {
		return utils.NewError(utils.ErrCategoryValidation,
			"end date must be after start date", nil)
	}
	if req.EventType == "physical" {
		if req.VenueName == nil || *req.VenueName == "" {
			return utils.NewError(utils.ErrCategoryValidation,
				"venue name is required for physical events", nil)
		}
		if req.City == nil || *req.City == "" {
			return utils.NewError(utils.ErrCategoryValidation,
				"city is required for physical events", nil)
		}
	}
	if req.EventType == "virtual" {
		if req.VirtualPlatform == nil || *req.VirtualPlatform == "" {
			return utils.NewError(utils.ErrCategoryValidation,
				"virtual platform is required for virtual events", nil)
		}
		if req.MeetingLink == nil || *req.MeetingLink == "" {
			return utils.NewError(utils.ErrCategoryValidation,
				"meeting link is required for virtual events", nil)
		}
	}
	if len(req.TicketTiers) == 0 {
		return utils.NewError(utils.ErrCategoryValidation,
			"at least one ticket tier is required", nil)
	}
	for _, tier := range req.TicketTiers {
		if tier.TierName == "" {
			return utils.NewError(utils.ErrCategoryValidation,
				"ticket tier name is required", nil)
		}
		if tier.Price < 0 {
			return utils.NewError(utils.ErrCategoryValidation,
				"ticket price cannot be negative", nil)
		}
		if tier.Quantity <= 0 {
			return utils.NewError(utils.ErrCategoryValidation,
				"ticket quantity must be greater than 0", nil)
		}
	}
	return nil
}

func (h *EventHandler) CreateEvent(c *gin.Context) {
	organizerID, err := extractUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Authentication required"})
		return
	}
	var req EventCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("Invalid request payload")
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request data",
			"errors":  utils.GetValidationErrors(err),
		})
		return
	}
	log.Info().
		Str("organizer_id", req.OrganizerID.String()).
		Str("event_title", req.EventTitle).
		Int("ticket_tiers_count", len(req.TicketTiers)).
		Msg("Received event creation request")
	req.OrganizerID = organizerID
	if err := validateEventRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	event := req.toEventModel()
	ticketTiers := req.toTicketTierModels(event.ID)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	err = h.eventService.CreateEvent(ctx, event, ticketTiers)
	if err != nil {
		log.Error().Err(err).
			Str("event_id", event.ID.String()).
			Msg("Failed to create event")
		if appErr, ok := err.(*utils.AppError); ok {
			c.JSON(appErr.HTTPStatus(), gin.H{"message": appErr.Message})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to create event",
			"error":   err.Error(),
		})
		return
	}
	log.Info().
		Str("event_id", event.ID.String()).
		Str("organizer_id", organizerID.String()).
		Int("ticket_tiers", len(ticketTiers)).
		Msg("Event created successfully")
	c.JSON(http.StatusCreated, gin.H{
		"message": "Event created successfully",
		"eventId": event.ID,
		"event":   event,
	})
}