// backend/pkg/models/vendor.go
package models

import (
	"database/sql"
	"time"
	"encoding/json"

	"github.com/google/uuid"
)

func ToNullInt32(val int32) sql.NullInt32 {
    return sql.NullInt32{
        Int32: val,
        Valid: val > 0,
    }
}

// MarshalJSON ensures MinPrice returns a simple number or null to the frontend
func (v Vendor) MarshalJSON() ([]byte, error) {
    type Alias Vendor
    var minPrice interface{}
    
    if v.MinPrice.Valid {
        minPrice = v.MinPrice.Int32
    } else {
        minPrice = nil
    }

    return json.Marshal(&struct {
        MinPrice interface{} `json:"minPrice"`
        Alias
    }{
        MinPrice: minPrice,
        Alias:    (Alias)(v),
    })
}

type VendorStatus string

const (
	StatusActive    VendorStatus = "active"
	StatusSuspended VendorStatus = "suspended"
)

type Vendor struct {
	ID                 uuid.UUID    `json:"id" db:"id"`
	OwnerID            uuid.UUID    `json:"ownerId" db:"owner_id"`
	Name               string       `json:"name" db:"name"`
	Category           string       `json:"category" db:"category"`
	Description        string       `json:"description" db:"description"`
	ImageURL           string       `json:"imageURL" db:"image_url"`
	Status             VendorStatus `json:"status" db:"status"`
	VNIN               string       `json:"vnin" db:"vnin"`
	FirstName          string       `json:"firstName" db:"first_name"`
	MiddleName         string       `json:"middleName" db:"middle_name"`
	LastName           string       `json:"lastName" db:"last_name"`
	DateOfBirth        string       `json:"dateOfBirth" db:"date_of_birth"`
	Gender             string       `json:"gender" db:"gender"`
	IsIdentityVerified bool         `json:"isIdentityVerified" db:"is_identity_verified"`
	CACNumber          string       `json:"cacNumber" db:"cac_number"`
	IsBusinessVerified bool         `json:"isBusinessVerified" db:"is_business_verified"`
	State              string       `json:"state" db:"state"`
	City               string       `json:"city" db:"city"`
	PhoneNumber        string       `json:"phoneNumber" db:"phone_number"`
	Email              string       `json:"email" db:"email"`
	MinPrice           sql.NullInt32 `json:"minPrice" db:"min_price"`
	PVSScore           int32        `json:"pvsScore" db:"pvs_score"`
	ReviewCount        int32        `json:"reviewCount" db:"review_count"`
	ProfileCompletion  float32      `json:"-" db:"profile_completion"`
	InquiryCount       int32        `json:"-" db:"inquiry_count"`
	RespondedCount     int32        `json:"-" db:"responded_count"`
	CreatedAt          time.Time    `json:"createdAt" db:"created_at"`
	UpdatedAt          time.Time    `json:"updatedAt" db:"updated_at"`
}

func CalculatePVS(v *Vendor) int32 {
	var score int32 = 0

	if v.IsIdentityVerified {
		score += 30
		if v.IsBusinessVerified {
			score += 40
		}
	}

	score += int32(15.0 * (v.ProfileCompletion / 100.0))

	if v.ReviewCount >= 20 {
		score += 10
	} else if v.ReviewCount >= 10 {
		score += 7
	} else if v.ReviewCount >= 1 {
		score += 3
	}

	if v.InquiryCount > 0 {
		responseRate := float32(v.RespondedCount) / float32(v.InquiryCount)
		score += int32(5.0 * responseRate)
	}

	if score > 100 {
		score = 100
	}
	return score
}