// backend/pkg/models/refresh_token.go
package models

import (
	"time"
	"github.com/google/uuid"
)

type RefreshToken struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	UserID      uuid.UUID  `json:"userId" db:"user_id" binding:"required"`
	TokenHash   string     `json:"-" db:"token_hash"`
	Revoked     bool       `json:"revoked" db:"revoked"`
	ExpiresAt   time.Time  `json:"expiresAt" db:"expires_at"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
	// NEW: Tracks if the token has been used already (for Grace Period)
	ConsumedAt  *time.Time `json:"consumedAt,omitempty" db:"consumed_at"`
	// NEW: Tracks the "Session Family Tree" (for Reuse Detection)
	ParentID    *uuid.UUID `json:"parentId,omitempty" db:"parent_id"`
}