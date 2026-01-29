package fixtures

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// EventFixture represents test event data
type EventFixture struct {
	ID                     uuid.UUID
	OrganizerID            uuid.UUID
	EventTitle             string
	EventDescription       string
	EventSlug              sql.NullString
	Category               string
	EventType              string
	EventImageURL          string
	VenueName              *string
	VenueAddress           *string
	City                   *string
	State                  *string
	Country                *string
	VirtualPlatform        *string
	MeetingLink            *string
	StartDate              time.Time
	EndDate                time.Time
	MaxAttendees           *int32
	PaystackSubaccountCode *string
	Tags                   []string
	IsDeleted              bool
	DeletedAt              *time.Time
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

// TicketTierFixture represents test ticket tier data
type TicketTierFixture struct {
	ID          uuid.UUID
	EventID     uuid.UUID
	Name        string
	Description *string
	PriceKobo   int32
	Capacity    int32
	Sold        int32
	Available   int32
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// TicketFixture represents test ticket data
type TicketFixture struct {
	ID            uuid.UUID
	Code          string
	OrderID       uuid.UUID
	EventID       uuid.UUID
	TicketTierID  uuid.UUID
	UserID        *uuid.UUID
	Status        string
	IsUsed        bool
	UsedAt        *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// NewEventFixture creates a basic event fixture
func NewEventFixture(organizerID uuid.UUID) *EventFixture {
	now := time.Now()
	startDate := now.Add(48 * time.Hour) // Event starts in 2 days
	endDate := startDate.Add(5 * time.Hour)
	
	venueName := "TEST_Venue"
	venueAddress := "123 Test Street"
	city := "Lagos"
	state := "Lagos"
	country := "Nigeria"
	maxAttendees := int32(500)
	
	return &EventFixture{
		ID:               uuid.New(),
		OrganizerID:      organizerID,
		EventTitle:       "TEST_Event_" + uuid.New().String()[:8],
		EventDescription: "This is a test event for automated testing",
		Category:         "Technology",
		EventType:        "physical",
		EventImageURL:    "https://example.com/test-image.jpg",
		VenueName:        &venueName,
		VenueAddress:     &venueAddress,
		City:             &city,
		State:            &state,
		Country:          &country,
		StartDate:        startDate,
		EndDate:          endDate,
		MaxAttendees:     &maxAttendees,
		Tags:             []string{"test", "automation"},
		IsDeleted:        false,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
}

// NewVirtualEventFixture creates a virtual event fixture
func NewVirtualEventFixture(organizerID uuid.UUID) *EventFixture {
	fixture := NewEventFixture(organizerID)
	fixture.EventType = "virtual"
	fixture.VenueName = nil
	fixture.VenueAddress = nil
	fixture.City = nil
	fixture.State = nil
	fixture.Country = nil
	
	virtualPlatform := "Zoom"
	meetingLink := "https://zoom.us/j/test123456"
	fixture.VirtualPlatform = &virtualPlatform
	fixture.MeetingLink = &meetingLink
	
	return fixture
}

// NewEventFixtureWithPaystack creates an event with Paystack subaccount
func NewEventFixtureWithPaystack(organizerID uuid.UUID, subaccountCode string) *EventFixture {
	fixture := NewEventFixture(organizerID)
	fixture.PaystackSubaccountCode = &subaccountCode
	return fixture
}

// NewPastEventFixture creates an event that has already ended
func NewPastEventFixture(organizerID uuid.UUID) *EventFixture {
	fixture := NewEventFixture(organizerID)
	fixture.StartDate = time.Now().Add(-48 * time.Hour) // Started 2 days ago
	fixture.EndDate = time.Now().Add(-43 * time.Hour)   // Ended 43 hours ago
	return fixture
}

// NewDeletedEventFixture creates a soft-deleted event
func NewDeletedEventFixture(organizerID uuid.UUID) *EventFixture {
	fixture := NewEventFixture(organizerID)
	fixture.IsDeleted = true
	deletedAt := time.Now()
	fixture.DeletedAt = &deletedAt
	return fixture
}

// NewTicketTierFixture creates a basic ticket tier fixture
func NewTicketTierFixture(eventID uuid.UUID, name string, price int32, capacity int32) *TicketTierFixture {
	now := time.Now()
	return &TicketTierFixture{
		ID:        uuid.New(),
		EventID:   eventID,
		Name:      name,
		PriceKobo: price,
		Capacity:  capacity,
		Sold:      0,
		Available: capacity,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// NewTicketTierWithSales creates a ticket tier with existing sales
func NewTicketTierWithSales(eventID uuid.UUID, name string, price int32, capacity int32, sold int32) *TicketTierFixture {
	tier := NewTicketTierFixture(eventID, name, price, capacity)
	tier.Sold = sold
	tier.Available = capacity - sold
	return tier
}

// StandardTicketTiers creates a standard set of ticket tiers for an event
func StandardTicketTiers(eventID uuid.UUID) []*TicketTierFixture {
	return []*TicketTierFixture{
		NewTicketTierFixture(eventID, "Early Bird", 500000, 100),    // ₦5,000
		NewTicketTierFixture(eventID, "Regular", 1000000, 200),      // ₦10,000
		NewTicketTierFixture(eventID, "VIP", 2500000, 50),           // ₦25,000
	}
}

// NewTicketFixture creates a basic ticket fixture
func NewTicketFixture(orderID, eventID, tierID uuid.UUID, userID *uuid.UUID) *TicketFixture {
	now := time.Now()
	return &TicketFixture{
		ID:           uuid.New(),
		Code:         generateTestTicketCode(),
		OrderID:      orderID,
		EventID:      eventID,
		TicketTierID: tierID,
		UserID:       userID,
		Status:       "active",
		IsUsed:       false,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}

// NewUsedTicketFixture creates a ticket that has been used at the gate
func NewUsedTicketFixture(orderID, eventID, tierID uuid.UUID, userID *uuid.UUID) *TicketFixture {
	ticket := NewTicketFixture(orderID, eventID, tierID, userID)
	ticket.IsUsed = true
	ticket.Status = "used"
	now := time.Now()
	ticket.UsedAt = &now
	return ticket
}

// NewCancelledTicketFixture creates a cancelled ticket
func NewCancelledTicketFixture(orderID, eventID, tierID uuid.UUID, userID *uuid.UUID) *TicketFixture {
	ticket := NewTicketFixture(orderID, eventID, tierID, userID)
	ticket.Status = "cancelled"
	return ticket
}

// generateTestTicketCode generates a test ticket code
func generateTestTicketCode() string {
	return "TEST-" + uuid.New().String()[:8] + "-SIGNATURE"
}

// UserFixture represents a test user
type UserFixture struct {
	ID    uuid.UUID
	Email string
	Name  string
}

// NewUserFixture creates a test user
func NewUserFixture() *UserFixture {
	id := uuid.New()
	return &UserFixture{
		ID:    id,
		Email: "test_" + id.String()[:8] + "@example.com",
		Name:  "Test User",
	}
}