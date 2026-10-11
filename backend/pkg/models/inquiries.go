//backend/pkg/models/inquiries.go
package models

import (
	"database/sql"
	"time"
	"github.com/google/uuid"
)


type Inquiry struct {
	ID        uuid.UUID           `json:"id" db:"id"`
	VendorID  uuid.UUID           `json:"vendorId" db:"vendor_id" binding:"required"`
	UserID 	  *uuid.UUID 		  `json:"userId,omitempty" db:"user_id"`
	GuestID   string              `json:"guestId" db:"guest_id"`
	Name      string              `json:"name" db:"name" binding:"required"`
	Email     string              `json:"email" db:"email" binding:"required"`
	Message   string              `json:"message" db:"message" binding:"required"`
	TrustWeight   float64               `json:"trustWeight" db:"trust_weight"`
	IPAddress sql.NullString      `json:"ipAddress,omitempty" db:"ip_address"`
	CreatedAt time.Time           `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time           `json:"updatedAt" db:"updated_at"`
}
