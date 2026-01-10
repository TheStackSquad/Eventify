// backend/pkg/handlers/events_public.go

package event

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"eventify/backend/pkg/models"
	repoevent "eventify/backend/pkg/repository/event"
	//"eventify/backend/pkg/services"
	"eventify/backend/pkg/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// ============================================================================
// PUBLIC EVENT HANDLERS (Public Listing & Likes)
// ============================================================================

func (h *EventHandler) GetAllEvents(c *gin.Context) {
	// 1. Build filters from query params
	filters := repoevent.EventFilters{
		IsDeleted: false, // Always exclude deleted for public
	}
	
	// Event type filter
	if eventType := c.Query("eventType"); eventType != "" {
		et := models.EventType(eventType)
		filters.EventType = &et
	}
	
	// Category filter
	if category := c.Query("category"); category != "" {
		filters.Category = &category
	}
	
	// Location filter
	if city := c.Query("city"); city != "" {
		filters.City = &city
	}
	
	// Date range filters
	if startDate := c.Query("startDate"); startDate != "" {
		if t, err := time.Parse(time.RFC3339, startDate); err == nil {
			filters.StartDate = &t
		}
	}
	
	if endDate := c.Query("endDate"); endDate != "" {
		if t, err := time.Parse(time.RFC3339, endDate); err == nil {
			filters.EndDate = &t
		}
	}
	
	// Pagination
	if limit := c.Query("limit"); limit != "" {
		if l, err := strconv.Atoi(limit); err == nil && l > 0 {
			filters.Limit = l
		}
	} else {
		filters.Limit = 50 // Default
	}
	
	if offset := c.Query("offset"); offset != "" {
		if o, err := strconv.Atoi(offset); err == nil && o >= 0 {
			filters.Offset = o
		}
	}
	
	log.Debug().
		Interface("filters", filters).
		Msg("Fetching public events")
	
	// 2. Call service
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	
	events, err := h.eventService.GetAllEvents(ctx, filters)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch public events")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch events"})
		return
	}
	
	// 3. Enrich with like data (if needed)
	userID := extractOptionalUserID(c)
	guestID, _ := c.Cookie("guest_id")
	
	if len(events) > 0 {
		// Extract event IDs for batch query
		eventIDs := make([]uuid.UUID, len(events))
		for i, event := range events {
			eventIDs[i] = event.ID
		}
		
		// Batch get like counts
		likeCounts, err := h.likeService.GetBatchLikeCounts(ctx, eventIDs)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to get like counts")
			likeCounts = make(map[string]int)
		}
		
		// Batch get user likes
		var userLikes map[string]bool
		if userID != nil || guestID != "" {
			userIDStr := ""
			if userID != nil {
				userIDStr = userID.String()
			}
			
			userLikes, err = h.likeService.GetBatchUserLikes(ctx, eventIDs, userIDStr, guestID)
			if err != nil {
				log.Warn().Err(err).Msg("Failed to get user likes")
				userLikes = make(map[string]bool)
			}
		} else {
			userLikes = make(map[string]bool)
		}
		
		// Enrich events
		for i := range events {
			eventIDStr := events[i].ID.String()
			events[i].LikesCount = likeCounts[eventIDStr]
			events[i].IsLiked = userLikes[eventIDStr]
		}
	}
	
	// 4. Success response
	c.JSON(http.StatusOK, gin.H{
		"events": events,
		"total":  len(events),
		"filters": filters,
	})
}

func (h *EventHandler) GetPublicEventByID(c *gin.Context) {
	// 1. Parse event ID
	eventID, err := parseEventID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid event ID"})
		return
	}
	
	// 2. Get optional user ID for like status
	userID := extractOptionalUserID(c)
	
	log.Debug().
		Str("event_id", eventID.String()).
		Bool("authenticated", userID != nil).
		Msg("Fetching public event")
	
	// 3. Call service
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	
	event, err := h.eventService.GetEventByID(ctx, eventID, userID)
	if err != nil {
		log.Error().Err(err).Str("event_id", eventID.String()).Msg("Failed to fetch event")
		
		if appErr, ok := err.(*utils.AppError); ok {
			c.JSON(appErr.HTTPStatus(), gin.H{"message": appErr.Message})
			return
		}
		
		c.JSON(http.StatusNotFound, gin.H{"message": "Event not found"})
		return
	}
	
	// 4. Success response
	c.JSON(http.StatusOK, event)
}

func (h *EventHandler) ToggleLike(c *gin.Context) {
    // 1. Parse event ID
    eventID, err := parseEventID(c)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid event ID"})
        return
    }

    // 2. Extract identifiers
    // We get the guest_id from the cookie (guaranteed by GuestMiddleware)
    guestID, _ := c.Cookie("guest_id")
    
    var userIDStr string
    if userID := extractOptionalUserID(c); userID != nil {
        userIDStr = userID.String()
    }

    // 3. Fallback Safety
    // Even though GuestMiddleware is global, if for some reason it's missing,
    // we use the Client IP as a secondary guest identifier to avoid empty strings.
    if guestID == "" && userIDStr == "" {
        guestID = "ip-" + c.ClientIP()
    }

    // 4. Log request details
    log.Debug().
        Str("event_id", eventID.String()).
        Str("user_id", userIDStr).
        Str("guest_id", guestID).
        Msg("❤️ Toggling like")

    // 5. Call service
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    result, err := h.likeService.ToggleLike(ctx, eventID.String(), userIDStr, guestID)
    if err != nil {
        log.Error().Err(err).Msg("Failed to toggle like")
        
        if appErr, ok := err.(*utils.AppError); ok {
            c.JSON(appErr.HTTPStatus(), gin.H{"message": appErr.Message})
            return
        }

        c.JSON(http.StatusInternalServerError, gin.H{
            "message": "Failed to toggle like",
        })
        return
    }

    // 6. Success response
    c.JSON(http.StatusOK, result)
}