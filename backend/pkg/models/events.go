// backend/pkg/models/events.go

package models

import (
	"time"
	"database/sql"

	"github.com/google/uuid"
)

type EventType string

const (
	TypePhysical EventType = "physical"
	TypeVirtual  EventType = "virtual"
)

type Event struct {
	ID                     uuid.UUID  `json:"id" db:"id"`
	OrganizerID            uuid.UUID  `json:"organizerId" db:"organizer_id" binding:"required"`
	EventTitle             string     `json:"eventTitle" db:"event_title" binding:"required"`
	EventDescription       string     `json:"eventDescription" db:"event_description" binding:"required"`
	EventSlug           sql.NullString  `db:"event_slug" json:"eventSlug"`
	Category               string     `json:"category" db:"category" binding:"required"`
	EventType              EventType  `json:"eventType" db:"event_type" binding:"required,oneof=physical virtual"`
	EventImageURL          string     `json:"eventImage" db:"event_image_url" binding:"required"`
	VenueName              *string    `json:"venueName" db:"venue_name"`
	VenueAddress           *string    `json:"venueAddress" db:"venue_address"`
	City                   *string    `json:"city" db:"city"`
	State                  *string    `json:"state" db:"state"`
	Country                *string    `json:"country" db:"country"`
	VirtualPlatform        *string    `json:"virtualPlatform" db:"virtual_platform"`
	MeetingLink            *string    `json:"meetingLink" db:"meeting_link"`
	StartDate              time.Time  `json:"startDate" db:"start_date" binding:"required"`
	EndDate                time.Time  `json:"endDate" db:"end_date" binding:"required"`
	MaxAttendees           *int32     `json:"maxAttendees" db:"max_attendees"`
	PaystackSubaccountCode *string    `json:"paystackSubaccountCode" db:"paystack_subaccount_code"`
	Tags                   []string   `json:"tags" db:"tags"`
	IsDeleted              bool       `json:"isDeleted" db:"is_deleted"`
	DeletedAt              *time.Time `json:"deletedAt" db:"deleted_at"`
	CreatedAt              time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt              time.Time  `json:"updatedAt" db:"updated_at"`
	LikesCount             int        `json:"likesCount" db:"-"`
	IsLiked                bool       `json:"isLiked" db:"-"`
	TicketTiers            []TicketTier `json:"tickets" db:"-"`
}

// ✅ FIXED: Match your actual database schema
type TicketTier struct {
	ID          uuid.UUID `json:"id" db:"id"`
	EventID     uuid.UUID `json:"-" db:"event_id"`
	Name        string    `json:"tierName" db:"name"`
	Description *string   `json:"description" db:"description"`
	PriceKobo   int32     `json:"price" db:"price_kobo"`
	Capacity    int32     `json:"quantity" db:"capacity"`
	Sold        int32     `json:"sold" db:"sold"`
	Available   int32     `json:"available" db:"available"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}