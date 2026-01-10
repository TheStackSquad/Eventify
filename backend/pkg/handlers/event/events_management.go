// backend/pkg/handlers/event/events_management.go

package event

import (
	"context"
	"net/http"
	"time"

	//"eventify/backend/pkg/models"
	serviceevent "eventify/backend/pkg/services/event"
	"eventify/backend/pkg/utils"

	"github.com/gin-gonic/gin"
	//"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// ============================================================================
// EVENT MANAGEMENT HANDLERS (Organizer Dashboard)
// ============================================================================

func (h *EventHandler) GetUserEvents(c *gin.Context) {
	// 1. Extract organizer ID
	organizerID, err := extractUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Authentication required"})
		return
	}
	
	// 2. Query parameters
	includeDeleted := c.Query("includeDeleted") == "true"
	
	log.Debug().
		Str("organizer_id", organizerID.String()).
		Bool("include_deleted", includeDeleted).
		Msg("Fetching user events")
	
	// 3. Call service
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	
	events, err := h.eventService.GetEventsByOrganizer(ctx, organizerID, includeDeleted)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch user events")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch events"})
		return
	}
	
	// 4. Success response
	c.JSON(http.StatusOK, gin.H{
		"events": events,
		"total":  len(events),
	})
}

func (h *EventHandler) GetEventByID(c *gin.Context) {
	// 1. Extract organizer ID
	organizerID, err := extractUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Authentication required"})
		return
	}
	
	// 2. Parse event ID
	eventID, err := parseEventID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid event ID"})
		return
	}
	
	log.Debug().
		Str("event_id", eventID.String()).
		Str("organizer_id", organizerID.String()).
		Msg("Fetching protected event")
	
	// 3. Call service
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	
	event, err := h.eventService.GetEventByID(ctx, eventID, &organizerID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch event")
		c.JSON(http.StatusNotFound, gin.H{"message": "Event not found"})
		return
	}
	
	// 4. Verify ownership
	if event.OrganizerID != organizerID {
		c.JSON(http.StatusForbidden, gin.H{"message": "You don't have permission to access this event"})
		return
	}
	
	// 5. Success response
	c.JSON(http.StatusOK, event)
}

func (h *EventHandler) UpdateEvent(c *gin.Context) {
	// 1. Extract organizer ID
	organizerID, err := extractUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Authentication required"})
		return
	}
	
	// 2. Parse event ID
	eventID, err := parseEventID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid event ID"})
		return
	}
	
	// 3. Bind update payload
	var updates serviceevent.EventUpdateDTO
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid update data",
			"errors":  utils.GetValidationErrors(err),
		})
		return
	}
	
	log.Debug().
		Str("event_id", eventID.String()).
		Str("organizer_id", organizerID.String()).
		Msg("Updating event")
	
	// 4. Call service
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	
	updatedEvent, err := h.eventService.UpdateEvent(ctx, eventID, organizerID, &updates)
	if err != nil {
		log.Error().Err(err).Msg("Failed to update event")
		
		if appErr, ok := err.(*utils.AppError); ok {
			c.JSON(appErr.HTTPStatus(), gin.H{"message": appErr.Message})
			return
		}
		
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to update event",
			"error":   err.Error(),
		})
		return
	}
	
	// 5. Success response
	c.JSON(http.StatusOK, gin.H{
		"message": "Event updated successfully",
		"event":   updatedEvent,
	})
}

func (h *EventHandler) DeleteEvent(c *gin.Context) {
	// 1. Extract organizer ID
	organizerID, err := extractUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Authentication required"})
		return
	}
	
	// 2. Parse event ID
	eventID, err := parseEventID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid event ID"})
		return
	}
	
	log.Debug().
		Str("event_id", eventID.String()).
		Str("organizer_id", organizerID.String()).
		Msg("Deleting event")
	
	// 3. Call service
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	
	err = h.eventService.SoftDeleteEvent(ctx, eventID, organizerID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to delete event")
		
		if appErr, ok := err.(*utils.AppError); ok {
			c.JSON(appErr.HTTPStatus(), gin.H{"message": appErr.Message})
			return
		}
		
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to delete event",
			"error":   err.Error(),
		})
		return
	}
	
	// 4. Success response
	c.JSON(http.StatusOK, gin.H{
		"message": "Event deleted successfully",
		"eventId": eventID.String(),
	})
}

func (h *EventHandler) GetEventAnalytics(c *gin.Context) {
	// 1. Extract organizer ID
	organizerID, err := extractUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Authentication required"})
		return
	}
	
	// 2. Parse event ID
	eventID, err := parseEventID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid event ID"})
		return
	}
	
	log.Debug().
		Str("event_id", eventID.String()).
		Str("organizer_id", organizerID.String()).
		Msg("Fetching event analytics")
	
	// 3. Call service
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	
	analytics, err := h.eventService.GetEventAnalytics(ctx, eventID, organizerID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch analytics")
		
		if appErr, ok := err.(*utils.AppError); ok {
			c.JSON(appErr.HTTPStatus(), gin.H{"message": appErr.Message})
			return
		}
		
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to fetch analytics",
			"error":   err.Error(),
		})
		return
	}
	
	// 4. Success response
	c.JSON(http.StatusOK, analytics)
}