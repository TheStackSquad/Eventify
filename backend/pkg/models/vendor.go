// backend/pkg/models/vendor.go
package models

import (
    "database/sql"
    "time"

    "github.com/google/uuid"
)

type VendorStatus string

const (
    VendorStatusActive    VendorStatus = "active"
    VendorStatusSuspended VendorStatus = "suspended"
    VendorStatusDeleted   VendorStatus = "deleted"
)

type Vendor struct {
    ID                   uuid.UUID        `json:"id" db:"id"`
    OwnerID              uuid.UUID        `json:"ownerId" db:"owner_id"`
    Name                 string           `json:"name" db:"name"`
    Category             string           `json:"category" db:"category"`
    ImageURL             string           `json:"imageURL" db:"image_url"`
    Status               VendorStatus     `json:"status" db:"status"`
    IsIdentityVerified   bool             `json:"isIdentityVerified" db:"is_identity_verified"`
    IsBusinessRegistered bool             `json:"isBusinessRegistered" db:"is_business_registered"`
    State                string           `json:"state" db:"state"`
    City                 string           `json:"city" db:"city"`
    PhoneNumber          string           `json:"phoneNumber" db:"phone_number"`
    MinPrice             sql.NullInt32    `json:"minPrice" db:"min_price"`
    PVSScore             int32            `json:"pvsScore" db:"pvs_score"`
    ReviewCount          int32            `json:"reviewCount" db:"review_count"`
    ProfileCompletion    float32          `json:"-" db:"profile_completion"`
    InquiryCount         int32            `json:"-" db:"inquiry_count"`
    RespondedCount       int32            `json:"-" db:"responded_count"`
    CreatedAt            time.Time        `json:"createdAt" db:"created_at"`
    UpdatedAt            time.Time        `json:"updatedAt" db:"updated_at"`
    DeletedAt            sql.NullTime     `json:"-" db:"deleted_at"`
    VNIN                 string           `json:"-" db:"vnin"`   // never serialized directly
    FirstName            string           `json:"firstName" db:"first_name"`
    MiddleName           sql.NullString   `json:"middleName" db:"middle_name"`
    LastName             string           `json:"lastName" db:"last_name"`
    Description          string           `json:"description" db:"description"`
    Email                string           `json:"email" db:"email"`
    CACNumber            sql.NullString   `json:"cacNumber" db:"cac_number"`
    IsBusinessVerified   sql.NullBool     `json:"isBusinessVerified" db:"is_business_verified"`
    SubscriptionTier     SubscriptionTier `json:"subscriptionTier" db:"subscription_tier"`
}


func CalculatePVS(v *Vendor) int32 {
	var score int32 = 0

	if v.IsIdentityVerified {
		score += 30
		if v.IsBusinessVerified.Valid && v.IsBusinessVerified.Bool {
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
// PublicVendorResponse is safe for unauthenticated consumers.
// VNIN and other PII are intentionally absent.
type PublicVendorResponse struct {
    ID                   uuid.UUID    `json:"id"`
    Name                 string       `json:"name"`
    Category             string       `json:"category"`
    ImageURL             interface{}  `json:"imageURL"`
    Status               VendorStatus `json:"status"`
    IsIdentityVerified   bool         `json:"isIdentityVerified"`
    IsBusinessRegistered bool         `json:"isBusinessRegistered"`
    IsBusinessVerified   interface{}  `json:"isBusinessVerified"`
    State                string       `json:"state"`
    City                 interface{}  `json:"city"`
    PhoneNumber          interface{}  `json:"phoneNumber"`
    MinPrice             interface{}  `json:"minPrice"`
    PVSScore             int32        `json:"pvsScore"`
    ReviewCount          int32        `json:"reviewCount"`
    Description          interface{}  `json:"description"`
    Email                interface{}  `json:"email"`
    CACNumber            interface{}  `json:"cacNumber"`
    FirstName            interface{}  `json:"firstName"`
    MiddleName           interface{}  `json:"middleName"`
    LastName             interface{}  `json:"lastName"`
    SubscriptionTier     SubscriptionTier `json:"subscriptionTier"`
    CreatedAt            time.Time    `json:"createdAt"`
    UpdatedAt            time.Time    `json:"updatedAt"`
}

// OwnerVendorResponse is returned only to the authenticated owner.
// Includes full unredacted VNIN — channel is auth + CSRF protected.
type OwnerVendorResponse struct {
    PublicVendorResponse
    VNIN      string `json:"vnin"`
    CACNumber interface{} `json:"cacNumber"`
}

// nullStr returns nil for empty/invalid NullString, otherwise the string value
func nullStr(ns sql.NullString) interface{} {
    if ns.Valid && ns.String != "" {
        return ns.String
    }
    return nil
}

// nullInt32 returns nil for invalid NullInt32, otherwise the int32 value
func nullInt32(ni sql.NullInt32) interface{} {
    if ni.Valid {
        return ni.Int32
    }
    return nil
}

// nullBool returns nil for invalid NullBool, otherwise the bool value
func nullBool(nb sql.NullBool) interface{} {
    if nb.Valid {
        return nb.Bool
    }
    return nil
}

// plainStr returns nil for empty strings, otherwise the string value
func plainStr(s string) interface{} {
    if s == "" {
        return nil
    }
    return s
}

// ToPublicResponse builds a PublicVendorResponse from a Vendor — no VNIN, no PII leak
func (v *Vendor) ToPublicResponse() PublicVendorResponse {
    return PublicVendorResponse{
        ID:                   v.ID,
        Name:                 v.Name,
        Category:             v.Category,
        ImageURL:             plainStr(v.ImageURL),
        Status:               v.Status,
        IsIdentityVerified:   v.IsIdentityVerified,
        IsBusinessRegistered: v.IsBusinessRegistered,
        IsBusinessVerified:   nullBool(v.IsBusinessVerified),
        State:                v.State,
        City:                 plainStr(v.City),
        PhoneNumber:          plainStr(v.PhoneNumber),
        MinPrice:             nullInt32(v.MinPrice),
        PVSScore:             v.PVSScore,
        ReviewCount:          v.ReviewCount,
        Description:          plainStr(v.Description),
        Email:                plainStr(v.Email),
        CACNumber:            nullStr(v.CACNumber),
        FirstName:            plainStr(v.FirstName),
        MiddleName:           nullStr(v.MiddleName),
        LastName:             plainStr(v.LastName),
        SubscriptionTier:     v.SubscriptionTier,
        CreatedAt:            v.CreatedAt,
        UpdatedAt:            v.UpdatedAt,
    }
}

// ToOwnerResponse builds an OwnerVendorResponse — full VNIN included, owner-only
func (v *Vendor) ToOwnerResponse() OwnerVendorResponse {
    return OwnerVendorResponse{
        PublicVendorResponse: v.ToPublicResponse(),
        VNIN:                 v.VNIN,
        CACNumber:            nullStr(v.CACNumber),
    }
}