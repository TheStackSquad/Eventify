// backend/pkg/models/vendor.go

package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type VendorStatus string

const (
	StatusActive    VendorStatus = "active"
	StatusSuspended VendorStatus = "suspended"
)

type Vendor struct {
	ID                   uuid.UUID     `json:"id" db:"id"`
	OwnerID              uuid.UUID     `json:"ownerId" db:"owner_id" binding:"required"`
	Name                 string        `json:"name" db:"name" binding:"required"`
	Category             string        `json:"category" db:"category" binding:"required"`
	ImageURL             string        `json:"imageURL" db:"image_url"`
	Status               VendorStatus  `json:"status" db:"status"`
	IsIdentityVerified   bool          `json:"isIdentityVerified" db:"is_identity_verified"`
	IsBusinessRegistered bool          `json:"isBusinessRegistered" db:"is_business_registered"`
	State                string        `json:"state" db:"state" binding:"required"`
	City                 string        `json:"city" db:"city"`
	PhoneNumber          string        `json:"phoneNumber" db:"phone_number"`
	MinPrice             sql.NullInt32 `json:"minPrice" db:"min_price"`
	PVSScore             int32         `json:"pvsScore" db:"pvs_score"`
	ReviewCount          int32         `json:"reviewCount" db:"review_count"`
	ProfileCompletion    float32       `json:"-" db:"profile_completion"`
	InquiryCount         int32         `json:"-" db:"inquiry_count"`
	RespondedCount       int32         `json:"-" db:"responded_count"`
	BookingsCompleted    int32         `json:"bookingsCompleted" db:"bookings_completed"`
	CreatedAt            time.Time     `json:"createdAt" db:"created_at"`
	UpdatedAt            time.Time     `json:"updatedAt" db:"updated_at"`
}

func CalculatePVS(v *Vendor) int32 {
	const MaxCompletionScore = 30
	const MaxVerificationScore = 30
	const MaxReviewScore = 20
	const MaxInquiryScore = 20

	completionScore := int32(float32(MaxCompletionScore) * (v.ProfileCompletion / 100.0))

	verificationScore := int32(0)
	if v.IsIdentityVerified {
		verificationScore += 10
	}
	if v.IsBusinessRegistered {
		verificationScore += 20
	}

	reviewScore := int32(0)
	if v.ReviewCount >= 10 {
		reviewScore = MaxReviewScore
	} else if v.ReviewCount >= 5 {
		reviewScore = 15
	} else if v.ReviewCount > 0 {
		reviewScore = 5
	}

	responseScore := int32(0)
	if v.InquiryCount > 0 {
		responseRate := float32(v.RespondedCount) / float32(v.InquiryCount)
		responseScore = int32(float32(MaxInquiryScore) * responseRate)
	}

	pvs := completionScore + verificationScore + reviewScore + responseScore
	if pvs > 100 {
		pvs = 100
	}

	return pvs
}

func ToNullInt32(value int32) sql.NullInt32 {
	if value == 0 {
		return sql.NullInt32{}
	}
	return sql.NullInt32{Int32: value, Valid: true}
}