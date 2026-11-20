// backend/pkg/handlers/vendor/vendor_contact.go
package vendor

import (
	"net/http"
	"sync"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

const (
	revealLimit  = 20
	revealWindow = time.Hour
)

var revealHits = struct {
	sync.Mutex
	byUser map[uuid.UUID][]time.Time
}{byUser: map[uuid.UUID][]time.Time{}}

func allowReveal(userID uuid.UUID) bool {
	now := time.Now()
	cutoff := now.Add(-revealWindow)

	revealHits.Lock()
	defer revealHits.Unlock()

	kept := make([]time.Time, 0, len(revealHits.byUser[userID])+1)
	for _, t := range revealHits.byUser[userID] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= revealLimit {
		revealHits.byUser[userID] = kept
		return false
	}
	revealHits.byUser[userID] = append(kept, now)
	return true
}

// RevealPhone returns a vendor's phone number to a signed-in user. It is rate limited and
// logged, so the number cannot be scraped by walking the public listing.
// Register behind AuthMiddleware: GET /vendors/:id/contact
func (h *VendorHandler) RevealPhone(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	userID, ok := userIDVal.(uuid.UUID)
	if !exists || !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if !allowReveal(userID) {
		c.Header("Retry-After", "3600")
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many contact requests. Please try again later."})
		return
	}

	vendorID := c.Param("id")
	vendor, err := h.VendorService.GetVendorByID(c.Request.Context(), vendorID)
	if err != nil || vendor == nil || vendor.Status != models.VendorStatusActive || vendor.PhoneNumber == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contact details not available"})
		return
	}

	log.Info().Str("user_id", userID.String()).Str("vendor_id", vendorID).Msg("Vendor phone revealed")
	c.JSON(http.StatusOK, gin.H{"phoneNumber": vendor.PhoneNumber})
}

// GetMyVendor returns the signed-in owner's own profile, including owner-only fields.
// Owner data never travels on the public GET /vendors/:id endpoint.
func (h *VendorHandler) GetMyVendor(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	ownerID, ok := userIDVal.(uuid.UUID)
	if !exists || !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	vendor, err := h.VendorService.GetVendorByOwnerID(c.Request.Context(), ownerID)
	if err != nil || vendor == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No vendor profile found"})
		return
	}
	c.JSON(http.StatusOK, vendor.ToOwnerResponse())
}