// backend/pkg/models/refresh_token.go
package models

import (
	"time"

	"github.com/google/uuid"
)

type RefreshToken struct {
	ID        uuid.UUID `json:"id" db:"id"`
	UserID    uuid.UUID `json:"userId" db:"user_id" binding:"required"`
	TokenHash string    `json:"-" db:"token_hash"`
	Revoked   bool      `json:"revoked" db:"revoked"`
	ExpiresAt time.Time `json:"expiresAt" db:"expires_at"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}