// backend/pkg/models/like.go

package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type Like struct {
	ID        uuid.UUID           `json:"id" db:"id"`
	EventID   uuid.UUID           `json:"eventId" db:"event_id" binding:"required"`
	UserID    NullUUID 			   `json:"userId,omitempty" db:"user_id"`
	GuestID   sql.NullString      `json:"guestId,omitempty" db:"guest_id"`
	CreatedAt time.Time           `json:"createdAt" db:"created_at"`
}