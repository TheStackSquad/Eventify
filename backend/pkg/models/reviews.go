// backend/pkg/models/review.go

package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type Review struct {
	ID          uuid.UUID           `json:"id" db:"id"`
	VendorID    uuid.UUID   		`json:"vendor_id" db:"vendor_id" binding:"required"`
	//VendorID    uuid.UUID    `json:"vendor_id" db:"vendor_id"`
	UserID 	  *uuid.UUID 		  `json:"userId,omitempty" db:"user_id"`
	UserName    string              `json:"user_name" db:"user_name"`
	Email       string              `json:"email" db:"email"`
	Rating      int32               `json:"rating" db:"rating" binding:"required,min=1,max=5"`
	Comment     string              `json:"comment" db:"comment" binding:"required"`
	
	// --- Trust Refactor Fields ---
	IPAddress    sql.NullString `json:"-" db:"ip_address"`
	IsVerified   bool           `json:"isVerified" db:"is_verified"`
	TrustWeight  float64        `json:"trustWeight" db:"trust_weight"`
	// ----------------------------
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt  time.Time `json:"updatedAt" db:"updated_at"`
}