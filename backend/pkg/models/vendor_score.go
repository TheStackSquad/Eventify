//backend/pkg/models/vendor_score.go

package models

import (
	"time"

	"github.com/google/uuid"
)

type VendorTrustScore struct {
	VendorID         uuid.UUID `json:"vendorId" db:"vendor_id"`
	// TotalTrustWeight represents the Proprietary Vendor Score (PVS): (inquiries + reviews * 5)
	TotalTrustWeight float64   `json:"pvsScore" db:"total_trust_weight"`
	// ReviewCount tracks total successful unique reviews
	ReviewCount      int32     `json:"reviewCount" db:"review_count"`
	CreatedAt        time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt        time.Time `json:"updatedAt" db:"updated_at"`
}
