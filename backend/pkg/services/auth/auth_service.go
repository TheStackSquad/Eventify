// backend/pkg/services/auth/auth_service.go

package auth

import (
	"context"
	"errors"
	"time"

	"github.com/eventify/backend/pkg/models"
	servicejwt "github.com/eventify/backend/pkg/services/jwt" // Fixed import path
	"github.com/google/uuid"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrAccountLocked      = errors.New("account is temporarily locked")
	ErrSessionExpired     = errors.New("session expired or invalid")
	ErrUserNotFound       = errors.New("user not found")
	ErrTokenReused        = errors.New("token reuse detected")
)

// TokenPair holds the set of tokens returned on successful auth or refresh
type TokenPair struct {
	AccessToken  string
	RefreshToken string
}

type AuthService interface {
	// Read Operations
	GetUserProfile(ctx context.Context, userID uuid.UUID) (*models.UserProfile, error)
	VerifyResetToken(ctx context.Context, token string) (bool, error)
	// Updated to use the Claims struct from the servicejwt package
	ParseAccessToken(ctx context.Context, token string) (*servicejwt.Claims, error)

	// Write Operations
	Login(ctx context.Context, email, password, ipAddress, userAgent string) (*models.UserProfile, *TokenPair, error)
	Signup(ctx context.Context, user *models.User) (uuid.UUID, error)
	
	RefreshToken(ctx context.Context, oldToken string, absoluteTimeout time.Duration, ipAddress string, userAgent string) (*TokenPair, error)
	Logout(ctx context.Context, userID uuid.UUID, refreshToken string, accessToken string) error
	ForgotPassword(ctx context.Context, email string) (string, error)
	ResetPassword(ctx context.Context, token, newPassword string) error

	// Token Blacklist Operations (for logout)
	BlacklistToken(ctx context.Context, token string, expiry time.Time) error
	IsTokenBlacklisted(ctx context.Context, token string) (bool, error)
}