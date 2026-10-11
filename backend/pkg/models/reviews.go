// backend/pkg/models/review.go
package models

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Review struct {
	ID          uuid.UUID      `json:"id" db:"id"`
	VendorID    uuid.UUID      `json:"vendor_id" db:"vendor_id" binding:"required"`
	UserID      *uuid.UUID     `json:"userId,omitempty" db:"user_id"`
	UserName    sql.NullString `json:"userName" db:"user_name"`
	Email       sql.NullString `json:"email" db:"email"`
	Rating      int32          `json:"rating" db:"rating" binding:"required,min=1,max=5"`
	Comment     string         `json:"comment" db:"comment" binding:"required"`
	IPAddress   sql.NullString `json:"-" db:"ip_address"`
	IsVerified  bool           `json:"isVerified" db:"is_verified"`
	TrustWeight float64        `json:"trustWeight" db:"trust_weight"`
	CreatedAt   time.Time      `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time      `json:"updatedAt" db:"updated_at"`
}

func (r Review) MarshalJSON() ([]byte, error) {
	type Alias Review
	
	cleanStr := func(ns sql.NullString) interface{} {
		if ns.Valid { return ns.String }
		return nil
	}

	return json.Marshal(&struct {
		UserName interface{} `json:"userName"`
		Email    interface{} `json:"email"`
		Alias
	}{
		UserName: cleanStr(r.UserName),
		Email:    cleanStr(r.Email),
		Alias:    (Alias)(r),
	})
}
