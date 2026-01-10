// backend/pkg/models/user.go

package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleCustomer Role = "customer"
	RoleVendor   Role = "vendor"
	RoleAdmin    Role = "admin"
)

type User struct {
	ID               uuid.UUID    `json:"id" db:"id"`
	Name             string       `json:"name" db:"name" binding:"required"`
	Email            string       `json:"email" db:"email" binding:"required,email"`
	Password         string       `json:"password,omitempty" binding:"required,min=6"` // Only for input
	PasswordHash     string       `json:"-" db:"password_hash"`
	Role             Role         `json:"role" db:"role"`
	ResetToken       sql.NullString `json:"-" db:"reset_token"`
	ResetTokenExpiry sql.NullTime `json:"-" db:"reset_token_expiry"`
	LastLogin        sql.NullTime `json:"-" db:"last_login"`
	CreatedAt        time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at" db:"updated_at"`
}

type UserProfile struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      Role      `json:"role"`
	IsVendor  bool      `json:"isVendor"`
	HasEvents bool      `json:"hasEvents"`
}

func (u *User) ToUserProfile(isVendor bool, hasEvents bool) *UserProfile {
	if u == nil {
		return nil
	}

	isVendorFlag := isVendor || u.Role == RoleAdmin
	hasEventsFlag := hasEvents || u.Role == RoleAdmin

	return &UserProfile{
		ID:        u.ID,
		Name:      u.Name,
		Email:     u.Email,
		Role:      u.Role,
		IsVendor:  isVendorFlag,
		HasEvents: hasEventsFlag,
	}
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Message string       `json:"message"`
	User    *UserProfile `json:"user,omitempty"`
	Token   string       `json:"token,omitempty"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required,min=6"`
}

type PasswordResetResponse struct {
	Message string `json:"message"`
	Valid   bool   `json:"valid,omitempty"`
}