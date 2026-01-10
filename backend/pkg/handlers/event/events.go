// backend/pkg/handlers/events.go

package event

import (
	serviceevent "eventify/backend/pkg/services/event"
	servicelike "eventify/backend/pkg/services/like"
	"eventify/backend/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler struct
type EventHandler struct {
	eventService serviceevent.EventService
    likeService  servicelike.LikeService
}

func NewEventHandler(eventService serviceevent.EventService, likeService servicelike.LikeService) *EventHandler {
    return &EventHandler{
        eventService: eventService,
        likeService:  likeService,
    }
}

// Helper functions

// extractUserID safely extracts UUID from context
func extractUserID(c *gin.Context) (uuid.UUID, error) {
	userIDRaw, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, utils.NewError(utils.ErrCategoryAuth, "user not authenticated", nil)
	}
	
	userID, ok := userIDRaw.(uuid.UUID)
	if !ok {
		// Try string conversion
		if userIDStr, ok := userIDRaw.(string); ok {
			return uuid.Parse(userIDStr)
		}
		return uuid.Nil, utils.NewError(utils.ErrCategoryValidation, "invalid user ID format", nil)
	}
	
	return userID, nil
}

// extractOptionalUserID extracts user ID if present (for public endpoints)
func extractOptionalUserID(c *gin.Context) *uuid.UUID {
	userID, err := extractUserID(c)
	if err != nil {
		return nil
	}
	return &userID
}

// parseEventID parses event ID from URL parameter
func parseEventID(c *gin.Context) (uuid.UUID, error) {
	eventIDParam := c.Param("eventId")
	if eventIDParam == "" {
		return uuid.Nil, utils.NewError(utils.ErrCategoryValidation, "event ID is required", nil)
	}
	
	eventID, err := uuid.Parse(eventIDParam)
	if err != nil {
		return uuid.Nil, utils.NewError(utils.ErrCategoryValidation, "invalid event ID format", err)
	}
	
	return eventID, nil
}