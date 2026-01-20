// backend/pkg/models/vendor.go
package models

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// MarshalJSON ensures MinPrice and NullStrings return simple values or null to the frontend
func (v Vendor) MarshalJSON() ([]byte, error) {
	type Alias Vendor

	// Utility to extract value or return nil
	cleanStr := func(ns sql.NullString) interface{} {
		if ns.Valid { return ns.String }
		return nil
	}
	cleanInt32 := func(ni sql.NullInt32) interface{} {
		if ni.Valid { return ni.Int32 }
		return nil
	}
	cleanTime := func(nt sql.NullTime) interface{} {
		if nt.Valid { return nt.Time.Format("2006-01-02") }
		return nil
	}
	cleanBool := func(nb sql.NullBool) interface{} {
		if nb.Valid { return nb.Bool }
		return nil
	}

	return json.Marshal(&struct {
		ImageURL           interface{} `json:"imageURL"`
		City               interface{} `json:"city"`
		PhoneNumber        interface{} `json:"phoneNumber"`
		MinPrice           interface{} `json:"minPrice"`
		VNIN               interface{} `json:"vnin"`
		FirstName          interface{} `json:"firstName"`
		MiddleName         interface{} `json:"middleName"`
		LastName           interface{} `json:"lastName"`
		DateOfBirth        interface{} `json:"dateOfBirth"`
		Gender             interface{} `json:"gender"`
		Description        interface{} `json:"description"`
		Email              interface{} `json:"email"`
		CACNumber          interface{} `json:"cacNumber"`
		IsBusinessVerified interface{} `json:"isBusinessVerified"`
		Alias
	}{
		ImageURL:           cleanStr(v.ImageURL),
		City:               cleanStr(v.City),
		PhoneNumber:        cleanStr(v.PhoneNumber),
		MinPrice:           cleanInt32(v.MinPrice),
		VNIN:               cleanStr(v.VNIN),
		FirstName:          cleanStr(v.FirstName),
		MiddleName:         cleanStr(v.MiddleName),
		LastName:           cleanStr(v.LastName),
		DateOfBirth:        cleanTime(v.DateOfBirth),
		Gender:             cleanStr(v.Gender),
		Description:        cleanStr(v.Description),
		Email:              cleanStr(v.Email),
		CACNumber:          cleanStr(v.CACNumber),
		IsBusinessVerified: cleanBool(v.IsBusinessVerified),
		Alias:              (Alias)(v),
	})
}

type VendorStatus string

const (
	StatusActive    VendorStatus = "active"
	StatusSuspended VendorStatus = "suspended"
)

type Vendor struct {
	ID                   uuid.UUID      `json:"id" db:"id"`
	OwnerID              uuid.UUID      `json:"ownerId" db:"owner_id"`
	Name                 string         `json:"name" db:"name"`
	Category             string         `json:"category" db:"category"`
	ImageURL             sql.NullString `json:"imageURL" db:"image_url"` // Fixed
	Status               VendorStatus   `json:"status" db:"status"`
	IsIdentityVerified   bool           `json:"isIdentityVerified" db:"is_identity_verified"`
	IsBusinessRegistered bool           `json:"isBusinessRegistered" db:"is_business_registered"`
	State                string         `json:"state" db:"state"`
	City                 sql.NullString `json:"city" db:"city"`                 // Fixed
	PhoneNumber          sql.NullString `json:"phoneNumber" db:"phone_number"`   // Fixed
	MinPrice             sql.NullInt32  `json:"minPrice" db:"min_price"`         // Fixed
	PVSScore             int32          `json:"pvsScore" db:"pvs_score"`
	ReviewCount          int32          `json:"reviewCount" db:"review_count"`
	ProfileCompletion    float32        `json:"-" db:"profile_completion"`
	InquiryCount         int32          `json:"-" db:"inquiry_count"`
	RespondedCount       int32          `json:"-" db:"responded_count"`
	CreatedAt            time.Time      `json:"createdAt" db:"created_at"`
	UpdatedAt            time.Time      `json:"updatedAt" db:"updated_at"`
	VNIN                 sql.NullString `json:"vnin" db:"vnin"`                 // Fixed
	FirstName            sql.NullString `json:"firstName" db:"first_name"`       // Fixed
	MiddleName           sql.NullString `json:"middleName" db:"middle_name"`     // Fixed
	LastName             sql.NullString `json:"lastName" db:"last_name"`         // Fixed
	DateOfBirth          sql.NullTime   `json:"dateOfBirth" db:"date_of_birth"` // Fixed
	Gender               sql.NullString `json:"gender" db:"gender"`             // Fixed
	Description          sql.NullString `json:"description" db:"description"`   // Fixed
	Email                sql.NullString `json:"email" db:"email"`               // Fixed
	CACNumber            sql.NullString `json:"cacNumber" db:"cac_number"`       // Fixed
	IsBusinessVerified sql.NullBool `json:"isBusinessVerified" db:"is_business_verified"`
}

func CalculatePVS(v *Vendor) int32 {
	var score int32 = 0

	// Identity verification (IsIdentityVerified is a standard bool)
	if v.IsIdentityVerified {
		score += 30
		// IsBusinessVerified is now a sql.NullBool
		if v.IsBusinessVerified.Valid && v.IsBusinessVerified.Bool {
			score += 40
		}
	}

	// Profile completion
	score += int32(15.0 * (v.ProfileCompletion / 100.0))

	// Review count (int32 is a standard type)
	if v.ReviewCount >= 20 {
		score += 10
	} else if v.ReviewCount >= 10 {
		score += 7
	} else if v.ReviewCount >= 1 {
		score += 3
	}

	// Response rate
	if v.InquiryCount > 0 {
		responseRate := float32(v.RespondedCount) / float32(v.InquiryCount)
		score += int32(5.0 * responseRate)
	}

	// Cap at 100
	if score > 100 {
		score = 100
	}
	return score
}