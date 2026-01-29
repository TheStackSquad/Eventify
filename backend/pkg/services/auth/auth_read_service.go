// backend/pkg/services/auth/auth_read_service.go

package auth

import (
	"context"

	"github.com/eventify/backend/pkg/models"
	servicejwt "github.com/eventify/backend/pkg/services/jwt"
	repoauth "github.com/eventify/backend/pkg/repository/auth"
	"github.com/google/uuid"
)

// authReadService provides read-only identity and verification logic
type authReadService struct {
	authRepo repoauth.AuthRepository
	jwtService *servicejwt.JWTService
}


func (s *authReadService) GetUserProfile(ctx context.Context, userID uuid.UUID) (*models.UserProfile, error) {
	user, err := s.authRepo.GetUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, ErrUserNotFound
	}
	// Return profile without vendor/event flags for now
	return user.ToUserProfile(false, false), nil
}

// VerifyResetToken checks if a password reset token is valid and unexpired
func (s *authReadService) VerifyResetToken(ctx context.Context, token string) (bool, error) {
	_, err := s.authRepo.GetUserByResetToken(ctx, token)
	if err != nil {
		return false, nil
	}
	return true, nil
}

// backend/pkg/services/auth/auth_read_service.go

func (s *authReadService) ParseAccessToken(ctx context.Context, token string) (*servicejwt.Claims, error) {
    // 1. Use the JWT service to validate the string and parse claims
    claims, err := s.jwtService.ValidateAccessToken(token)
    if err != nil {
        // Log the error for internal debugging if needed
        return nil, ErrSessionExpired
    }

    // 2. Return the typed claims (this now matches your AuthService interface)
    return claims, nil
}