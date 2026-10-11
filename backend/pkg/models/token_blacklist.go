//backend/pkg/models/token_blacklist.go
package models

import "time"

// TokenBlacklist represents a revoked access token
type TokenBlacklist struct {
    TokenHash string    `json:"token_hash" db:"token_hash"`
    ExpiresAt time.Time `json:"expires_at" db:"expires_at"`
    CreatedAt time.Time `json:"created_at" db:"created_at"`
}