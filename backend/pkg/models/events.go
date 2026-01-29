// backend/pkg/models/events.go

package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type EventType string

const (
	TypePhysical EventType = "physical"
	TypeVirtual  EventType = "virtual"
)

type Event struct {
	ID                     uuid.UUID      `json:"id" db:"id"`
	OrganizerID            uuid.UUID      `json:"organizerId" db:"organizer_id" binding:"required"`
	EventTitle             string         `json:"eventTitle" db:"event_title" binding:"required"`
	EventDescription       string         `json:"eventDescription" db:"event_description" binding:"required"`
	EventSlug              sql.NullString `json:"eventSlug" db:"event_slug"` // Kept as NullString to match DB facts
	Category               string         `json:"category" db:"category" binding:"required"`
	EventType              EventType      `json:"eventType" db:"event_type" binding:"required,oneof=physical virtual"`
	EventImageURL          string         `json:"eventImage" db:"event_image_url" binding:"required"`
	VenueName              *string        `json:"venueName" db:"venue_name"`
	VenueAddress           *string        `json:"venueAddress" db:"venue_address"`
	City                   *string        `json:"city" db:"city"`
	State                  *string        `json:"state" db:"state"`
	Country                *string        `json:"country" db:"country"`
	VirtualPlatform        *string        `json:"virtualPlatform" db:"virtual_platform"`
	MeetingLink            *string        `json:"meetingLink" db:"meeting_link"`
	StartDate              time.Time      `json:"startDate" db:"start_date" binding:"required"`
	EndDate                time.Time      `json:"endDate" db:"end_date" binding:"required"`
	MaxAttendees           *int32         `json:"maxAttendees" db:"max_attendees"`
	PaystackSubaccountCode *string        `json:"paystackSubaccountCode" db:"paystack_subaccount_code"`
	Tags                   []string       `json:"tags" db:"tags"`
	IsDeleted              bool           `json:"isDeleted" db:"is_deleted"`
	DeletedAt              *time.Time     `json:"deletedAt" db:"deleted_at"`
	CreatedAt              time.Time      `json:"createdAt" db:"created_at"`
	UpdatedAt              time.Time      `json:"updatedAt" db:"updated_at"`
	
	// Relationships
	TicketTiers []TicketTier `json:"tickets" db:"-"`
	
	// Computed fields for UI (not in DB)
	LikesCount int  `json:"likesCount" db:"-"`
	IsLiked    bool `json:"isLiked" db:"-"`
}

type TicketTier struct {
	ID          uuid.UUID `json:"id" db:"id"`
	EventID     uuid.UUID `json:"-" db:"event_id"`
	TicketTierID uuid.UUID `db:"id"`
	Name        string    `json:"tierName" db:"name" binding:"required"`
	Description *string   `json:"description" db:"description"`
	// Price comes in as Naira (float) from frontend, but we store Kobo (int)
	PriceKobo   int32     `json:"price" db:"price_kobo"` 
	Capacity    int32     `json:"quantity" db:"capacity" binding:"required"`
	Sold        int32     `json:"soldCount" db:"sold"` // Matched frontend key "soldCount"
	Available   int32     `json:"available" db:"available"` // Required by DB
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}


type TierDetails struct {
	EventID      uuid.UUID `db:"event_id"`
	EventTitle   string    `db:"event_title"`
	EndDate      time.Time `db:"end_date"`
	TicketTierID uuid.UUID `db:"ticket_tier_id"`
	TierName     string    `db:"name"` 
	PriceKobo    int64     `db:"price_kobo"`
	TotalStock   int32     `db:"capacity"`
	SoldCount    int32     `db:"sold"`     
	Available    int32     `db:"available"`
}