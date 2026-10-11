// backend/pkg/middleware/context_helpers.go
package middleware

import (
    "errors"
    "github.com/eventify/backend/pkg/repository/vendor"
    "github.com/google/uuid"
    "github.com/gin-gonic/gin"
)

func ExtractVendorID(c *gin.Context, repo vendor.VendorRepository) (uuid.UUID, error) {
    // 1. Efficiency Check: See if it's already in the context from a previous call
    if val, exists := c.Get("vendor_id"); exists {
        if id, ok := val.(uuid.UUID); ok {
            return id, nil
        }
    }

    // 2. Get the User ID (provided by your AuthMiddleware)
    // Adjust "user_id" string if your middleware uses a different key
    uIDVal, exists := c.Get("user_id")
    if !exists {
        return uuid.Nil, errors.New("authentication required")
    }

    ownerID, ok := uIDVal.(uuid.UUID)
    if !ok {
        // Handle cases where ID might be a string that needs parsing
        if strID, ok := uIDVal.(string); ok {
            parsedID, err := uuid.Parse(strID)
            if err != nil {
                return uuid.Nil, errors.New("invalid user identity format")
            }
            ownerID = parsedID
        } else {
            return uuid.Nil, errors.New("identity type mismatch")
        }
    }

    // 3. Database Lookup: Use your existing Repository
    // This bridges the gap for "just registered" vendors
    vendorProfile, err := repo.GetByOwnerID(c.Request.Context(), ownerID)
    if err != nil {
        return uuid.Nil, errors.New("vendor identity not found — authentication required")
    }

    // 4. Cache it in the Gin context for the remainder of this specific request
    c.Set("vendor_id", vendorProfile.ID)

    return vendorProfile.ID, nil
}