// backend/pkg/models/ticket.go

package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type TicketStatus string

const (
	TicketStatusActive   TicketStatus = "active"
	TicketStatusUsed     TicketStatus = "used"
	TicketStatusCanceled TicketStatus = "canceled"
)

type Ticket struct {
	ID           uuid.UUID           `json:"id" db:"id"`
	Code         string              `json:"code" db:"code"`
	OrderID      uuid.UUID           `json:"orderId" db:"order_id"`
	EventID      uuid.UUID           `json:"eventId" db:"event_id"`
	TicketTierID uuid.UUID           `json:"ticketTierId" db:"ticket_tier_id"`
	//UserID       NullUUID `json:"userId,omitempty" db:"user_id"`
	UserID 	  *uuid.UUID 		  `json:"userId,omitempty" db:"user_id"`
	Status       TicketStatus        `json:"status" db:"status"`
	IsUsed       bool                `json:"isUsed" db:"is_used"`
	UsedAt       sql.NullTime        `json:"usedAt,omitempty" db:"used_at"`
	CreatedAt    time.Time           `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time           `json:"updatedAt" db:"updated_at"`
}