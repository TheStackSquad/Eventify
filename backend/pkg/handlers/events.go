// backend/pkg/handlers/events.go
package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"eventify/backend/pkg/models"
	"eventify/backend/pkg/services"
	"eventify/backend/pkg/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// EventHandler holds the service dependencies.
type EventHandler struct {
	EventService services.EventService
	LikeService  services.LikeService
}

// NewEventHandler creates a new instance of EventHandler.
func NewEventHandler(eventService services.EventService, likeService services.LikeService) *EventHandler {
	return &EventHandler{
		EventService: eventService,
		LikeService:  likeService,
	}
}

// CreateEvent handles the creation of a new event.
func (h *EventHandler) CreateEvent(c *gin.Context) {
	var event models.Event

	// 1. Bind and Validate the JSON Payload
	if err := c.ShouldBindJSON(&event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid event data",
			"error":   utils.GetValidationErrors(err),
		})
		return
	}

	// 2. Inject Required Fields (HTTP Layer Responsibility)
	organizerID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Organizer ID not found in context"})
		return
	}
	objID, ok := organizerID.(primitive.ObjectID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Invalid organizer ID format"})
		return
	}

	event.ID = primitive.NewObjectID()
	event.OrganizerID = objID
	event.IsDeleted = false
	event.CreatedAt = time.Now()
	event.UpdatedAt = time.Now()

	// 3. Call the Service Layer
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := h.EventService.Create(ctx, &event); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to save event to database",
			"error":   err.Error(),
		})
		return
	}

	// 4. Success Response
	c.JSON(http.StatusCreated, event)
}

// GetUserEventsHandler fetches all events owned by the authenticated user, excluding soft-deleted ones.
func (h *EventHandler) GetUserEventsHandler(c *gin.Context) {
	organizerID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Organizer ID not found in context"})
		return
	}
	objID, ok := organizerID.(primitive.ObjectID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Invalid organizer ID format"})
		return
	}
	fmt.Printf("🎯 DEBUG: Calling FindAllByOrganizer with organizerID: %s\n", objID.Hex())

	// 1. Call the Service Layer
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	events, err := h.EventService.FindAllByOrganizer(ctx, objID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch user events."})
		return
	}

	// 2. Success Response
	fmt.Printf("✅ DEBUG: Retrieved %d events from database\n", len(events))
	c.JSON(http.StatusOK, events)
}

// GetPublicEventByID - PUBLIC: For anyone viewing event details
func (h *EventHandler) GetPublicEventByID(c *gin.Context) {
	fmt.Println("🌍 [PUBLIC HANDLER] GetPublicEventByID called")
	fmt.Printf("🌍 [PUBLIC HANDLER] Request Path: %s\n", c.Request.URL.Path)
	fmt.Printf("🌍 [PUBLIC HANDLER] Request Method: %s\n", c.Request.Method)

	eventIDParam := c.Param("eventId")
	fmt.Printf("🌍 [PUBLIC HANDLER] Event ID param: %s\n", eventIDParam)

	eventID, err := primitive.ObjectIDFromHex(eventIDParam)
	if err != nil {
		fmt.Printf("❌ [PUBLIC HANDLER] Invalid event ID format: %s\n", err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid event ID format"})
		return
	}

	fmt.Printf("🎯 [PUBLIC HANDLER] Fetching public event with eventID: %s\n", eventID.Hex())

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	event, err := h.EventService.FindByIDPublic(ctx, eventID)
	if err != nil {
		fmt.Printf("❌ [PUBLIC HANDLER] Error fetching event: %s\n", err.Error())
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"message": "Event not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch event"})
		return
	}

	fmt.Printf("✅ [PUBLIC HANDLER] Retrieved public event: %s\n", event.EventTitle)
	c.JSON(http.StatusOK, event)
}

// GetEventByID - PROTECTED: For organizer's own events
func (h *EventHandler) GetEventByID(c *gin.Context) {
	fmt.Println("🔒 [PROTECTED HANDLER] GetEventByID called")
	fmt.Printf("🔒 [PROTECTED HANDLER] Request Path: %s\n", c.Request.URL.Path)
	fmt.Printf("🔒 [PROTECTED HANDLER] Request Method: %s\n", c.Request.Method)

	organizerID, exists := c.Get("user_id")
	if !exists {
		fmt.Println("❌ [PROTECTED HANDLER] Organizer ID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Organizer ID not found in context"})
		return
	}

	fmt.Printf("🔒 [PROTECTED HANDLER] Organizer ID found: %v\n", organizerID)

	objID, ok := organizerID.(primitive.ObjectID)
	if !ok {
		fmt.Println("❌ [PROTECTED HANDLER] Invalid organizer ID format")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Invalid organizer ID format"})
		return
	}

	eventIDParam := c.Param("eventId")
	fmt.Printf("🔒 [PROTECTED HANDLER] Event ID param: %s\n", eventIDParam)

	eventID, err := primitive.ObjectIDFromHex(eventIDParam)
	if err != nil {
		fmt.Printf("❌ [PROTECTED HANDLER] Invalid event ID format: %s\n", err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid event ID format"})
		return
	}

	fmt.Printf("🎯 [PROTECTED HANDLER] Calling FindByID with eventID: %s, organizerID: %s\n", eventID.Hex(), objID.Hex())

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	event, err := h.EventService.FindByID(ctx, eventID, objID)
	if err != nil {
		fmt.Printf("❌ [PROTECTED HANDLER] Error: %s\n", err.Error())
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"message": "Event not found or unauthorized to access"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch event"})
		return
	}

	fmt.Printf("✅ [PROTECTED HANDLER] Retrieved event: %s\n", event.EventTitle)
	c.JSON(http.StatusOK, event)
}

// GetAllEventsHandler fetches all non-deleted events (public listing)
func (h *EventHandler) GetAllEventsHandler(c *gin.Context) {
	fmt.Printf("🎯 DEBUG: Fetching all events\n")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Call service to get all events (you'll need to create this method)
	events, err := h.EventService.FindAll(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch events."})
		return
	}

	fmt.Printf("✅ DEBUG: Retrieved %d events from database\n", len(events))
	c.JSON(http.StatusOK, events)
}

// UpdateEvent handles the updating of an existing event.
func (h *EventHandler) UpdateEvent(c *gin.Context) {
	organizerID, _ := c.Get("user_id")
	eventIDParam := c.Param("eventId")

	// 1. Validate IDs
	eventID, err := primitive.ObjectIDFromHex(eventIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid event ID format"})
		return
	}
	organizerObjID := organizerID.(primitive.ObjectID)

	// 2. Bind Updates Payload
	var updates models.EventUpdate
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid update data",
			"error":   utils.GetValidationErrors(err),
		})
		return
	}

	// 3. Call the Service Layer
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Call Update, which returns the modified model or an error
	updatedEvent, err := h.EventService.Update(ctx, eventID, organizerObjID, &updates)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"message": "Event not found or unauthorized to modify"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update event"})
		return
	}

	// 4. Success Response: Ensure the returned event object has the correct IDs set
	updatedEvent.ID = eventID
	updatedEvent.OrganizerID = organizerObjID
	updatedEvent.UpdatedAt = time.Now()
	c.JSON(http.StatusOK, updatedEvent)
}

// DeleteEvent handles the soft deletion of an event.
func (h *EventHandler) DeleteEvent(c *gin.Context) {
	organizerID, _ := c.Get("user_id")
	eventIDParam := c.Param("eventId")

	// 1. Validate IDs
	eventID, err := primitive.ObjectIDFromHex(eventIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid event ID format"})
		return
	}
	organizerObjID := organizerID.(primitive.ObjectID)

	// 2. Call the Service Layer (Soft Delete)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	deleted, err := h.EventService.SoftDelete(ctx, eventID, organizerObjID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to delete event"})
		return
	}

	if !deleted {
		c.JSON(http.StatusNotFound, gin.H{"message": "Event not found or unauthorized to delete"})
		return
	}

	// 3. Success Response: Frontend expects the eventId back
	c.JSON(http.StatusOK, gin.H{"eventId": eventIDParam, "message": "Event successfully deleted"})
}

func (h *EventHandler) ToggleLikeHandler(c *gin.Context) {
	// 1. Extract IDs
	userIDContext, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "User ID not found in context. Authentication required."})
		return
	}
	userID, ok := userIDContext.(primitive.ObjectID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Invalid user ID format in context."})
		return
	}

	eventIDStr := c.Param("eventId")
	if eventIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Missing event ID."})
		return
	}

	fmt.Printf("🎯 DEBUG: ToggleLike request for Event: %s by User: %s\n", eventIDStr, userID.Hex())

	// 2. Call the Service Layer using the directly available h.LikeService
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// 🛑 FIX 3: DIRECTLY CALL THE CORRECT SERVICE
	// Pass the ObjectID (userID) as its Hex string representation, as the service expects strings.
	res, err := h.LikeService.ToggleLike(ctx, eventIDStr, userID.Hex())

	// The previous complex dependency access is no longer needed:
	// likeService, isLikeService := h.EventService.LikeService.(services.LikeService)
	// ...

	if err != nil {
		appErr, ok := err.(*utils.AppError)
		if ok {
			c.JSON(appErr.HTTPStatus(), gin.H{"message": appErr.Message}) // Use HTTPStatus from AppError
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to toggle like status.", "error": err.Error()})
		return
	}

	// 3. Success Response
	c.JSON(http.StatusOK, res)
}
