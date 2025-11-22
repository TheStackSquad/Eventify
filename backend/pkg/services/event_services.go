// backend/pkg/services/event_service.go
package services

import (
	"context"
	"errors"
	"fmt"

	"eventify/backend/pkg/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// EventService provides methods for event-related business logic and data persistence.
type EventService struct {
	EventCollection *mongo.Collection
	// NOTE: In a real implementation, you would add a TicketSalesCollection here
	// TicketSalesCollection *mongo.Collection 
}

// NewEventService creates a new instance of EventService.
func NewEventService(eventColl *mongo.Collection) *EventService {
	return &EventService{
		EventCollection: eventColl,
	}
}

// Create handles the insertion of a new event into the database.
func (s *EventService) Create(ctx context.Context, event *models.Event) error {
	_, err := s.EventCollection.InsertOne(ctx, event)
	return err
}

// FindAllByOrganizer fetches all non-deleted events owned by the specified organizer.
func (s *EventService) FindAllByOrganizer(ctx context.Context, organizerID primitive.ObjectID) ([]models.Event, error) {
    // Filter to include only events belonging to the organizer AND not soft-deleted
    filter := bson.M{
        "organizer_id": organizerID,
        "is_deleted": false,
    }
    
    // 🎯 ADD THIS DEBUG LOGGING:
    fmt.Printf("🔍 DEBUG: MongoDB filter: %+v\n", filter)
    fmt.Printf("🔍 DEBUG: organizerID type: %T, value: %s\n", organizerID, organizerID.Hex())
    
    cursor, err := s.EventCollection.Find(ctx, filter)
    if err != nil {
        fmt.Printf("❌ DEBUG: MongoDB Find error: %v\n", err)
        return nil, err
    }
    defer cursor.Close(ctx)

    var events []models.Event
    if err = cursor.All(ctx, &events); err != nil {
        fmt.Printf("❌ DEBUG: cursor.All error: %v\n", err)
        return nil, err
    }
    
    fmt.Printf("✅ DEBUG: Raw events found: %d\n", len(events))
    return events, nil
}

// FindAll fetches all non-deleted events from the database (public listing).
func (s *EventService) FindAll(ctx context.Context) ([]models.Event, error) {
    // Filter to include only non-deleted events (no organizer filter)
    filter := bson.M{
        "is_deleted": false,
    }
    
    // Debug logging
    fmt.Printf("🔍 DEBUG: MongoDB filter for all events: %+v\n", filter)
    
    cursor, err := s.EventCollection.Find(ctx, filter)
    if err != nil {
        fmt.Printf("❌ DEBUG: MongoDB Find error: %v\n", err)
        return nil, err
    }
    defer cursor.Close(ctx)
    
    var events []models.Event
    if err = cursor.All(ctx, &events); err != nil {
        fmt.Printf("❌ DEBUG: cursor.All error: %v\n", err)
        return nil, err
    }
    
    fmt.Printf("✅ DEBUG: Total events found: %d\n", len(events))
    return events, nil
}

// backend/pkg/services/event_service.go

// FindByID finds a single event by ID and organizer ID (PROTECTED)
func (s *EventService) FindByID(ctx context.Context, eventID, organizerID primitive.ObjectID) (*models.Event, error) {
    filter := bson.M{
        "_id":          eventID,
        "organizer_id": organizerID,
        "is_deleted":   false,
    }
    var event models.Event
    err := s.EventCollection.FindOne(ctx, filter).Decode(&event)
    if err != nil {
        return nil, err
    }
    
    return &event, nil
}

// FindByIDPublic finds a single event by ID without authentication (PUBLIC)
func (s *EventService) FindByIDPublic(ctx context.Context, eventID primitive.ObjectID) (*models.Event, error) {
    filter := bson.M{
        "_id":        eventID,
        "is_deleted": false,
    }
    var event models.Event
    err := s.EventCollection.FindOne(ctx, filter).Decode(&event)
    if err != nil {
        return nil, err
    }
    
    return &event, nil
}

// Update handles modifying an existing event document.
func (s *EventService) Update(ctx context.Context, eventID, organizerID primitive.ObjectID, updates *models.EventUpdate) (*models.Event, error) {
	filter := bson.M{
		"_id": eventID,
		"organizer_id": organizerID,
		"is_deleted": false,
	}

	// Build update document dynamically - only include non-nil fields
	setFields := bson.M{}
	
	// Manual checks for all updatable fields
	if updates.EventTitle != nil {
		setFields["event_title"] = *updates.EventTitle
	}
	if updates.EventDescription != nil {
		setFields["event_description"] = *updates.EventDescription
	}
	if updates.Category != nil {
		setFields["category"] = *updates.Category
	}
	if updates.EventType != nil {
		setFields["event_type"] = *updates.EventType
	}
	if updates.EventImageURL != nil {
		setFields["event_image_url"] = *updates.EventImageURL
	}
	if updates.VenueName != nil {
		setFields["venue_name"] = *updates.VenueName
	}
	if updates.VenueAddress != nil {
		setFields["venue_address"] = *updates.VenueAddress
	}
	if updates.City != nil {
		setFields["city"] = *updates.City
	}
	if updates.State != nil {
		setFields["state"] = *updates.State
	}
	if updates.Country != nil {
		setFields["country"] = *updates.Country
	}
	if updates.VirtualPlatform != nil {
		setFields["virtual_platform"] = *updates.VirtualPlatform
	}
	if updates.MeetingLink != nil {
		setFields["meeting_link"] = *updates.MeetingLink
	}
	if updates.StartDate != nil {
		setFields["start_date"] = *updates.StartDate
	}
	if updates.EndDate != nil {
		setFields["end_date"] = *updates.EndDate
	}
	if updates.TicketTiers != nil {
		setFields["ticket_tiers"] = *updates.TicketTiers
	}
	if updates.Tags != nil {
		setFields["tags"] = *updates.Tags
	}
	if updates.MaxAttendees != nil {
		setFields["max_attendees"] = *updates.MaxAttendees
	}
	
	updateDoc := bson.M{
		"$set": setFields,
		"$currentDate": bson.M{"updated_at": true},
	}

	result, err := s.EventCollection.UpdateOne(ctx, filter, updateDoc)
	if err != nil {
		return nil, err
	}

	if result.ModifiedCount == 0 {
		return nil, mongo.ErrNoDocuments
	}
	
	// Fetch and return the updated document
	var updatedEvent models.Event
	err = s.EventCollection.FindOne(ctx, filter).Decode(&updatedEvent)
	if err != nil {
		return nil, err
	}
	
	return &updatedEvent, nil
}

// SoftDelete marks an event as deleted.
func (s *EventService) SoftDelete(ctx context.Context, eventID, organizerID primitive.ObjectID) (bool, error) {
	filter := bson.M{
		"_id": eventID,
		"organizer_id": organizerID,  // ← FIX: was "organizerId"
		"is_deleted": false,          // ← FIX: was "isDeleted"
	}

	// Soft delete: Set IsDeleted to true and record deletion time
	updateDoc := bson.M{
		"$set": bson.M{"is_deleted": true},  // ← FIX: was "isDeleted"
		"$currentDate": bson.M{"deleted_at": true}, // ← FIX: was "deletedAt"
	}

	result, err := s.EventCollection.UpdateOne(ctx, filter, updateDoc)
	if err != nil {
		return false, err
	}

	if result.ModifiedCount == 0 {
		return false, nil // Not found or unauthorized
	}
	
	return true, nil // Successfully modified
}

// Returns a map[string]interface{} to remain framework-agnostic.
func (s *EventService) GetAnalytics(ctx context.Context, eventID, organizerID primitive.ObjectID) (map[string]interface{}, error) {
	var event models.Event
	filter := bson.M{
		"_id": eventID,
		"organizerId": organizerID,
		"isDeleted": false,
	}

	err := s.EventCollection.FindOne(ctx, filter).Decode(&event)
	if err != nil {
		return nil, err
	}

	// --- Analytics Calculation Logic (MOCK PLACEHOLDER) ---
	// TO DO: Replace this section with a real MongoDB Aggregation query against 
	// the TicketSales collection to get actual sales figures and revenue.
	
	totalInventory := 0
	for _, tier := range event.TicketTiers {
		totalInventory += tier.Quantity
	}
	
	// Calculate mock sold tickets (e.g., 15% of inventory)
	mockSoldTickets := int(float64(totalInventory) * 0.15)
	
	ticketsLeft := totalInventory - mockSoldTickets
	
	mockRevenue := 0.0
	numTiers := float64(len(event.TicketTiers))
	for _, tier := range event.TicketTiers {
		// Simplified: use average price for the sold calculation
		if numTiers > 0 {
			mockRevenue += float64(tier.Price) * (float64(mockSoldTickets) / numTiers)
		}
	}

	// Conversion Rate (simple mock)
	mockConversionRate := 5.5 

	// CORRECTED: Using map[string]interface{} instead of gin.H
	analytics := map[string]interface{}{
		"ticketsSold": mockSoldTickets,
		"ticketsLeft": ticketsLeft,
		"totalRevenue": int(mockRevenue),
		"conversionRate": mockConversionRate,
	}

	return analytics, nil
}

// A simple utility to wrap the standard MongoDB error for clearer API responses
var ErrEventNotFound = errors.New("event not found or unauthorized")
