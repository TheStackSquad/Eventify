// backend/pkg/services/auth/auth_write_service.go

package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"crypto/sha256"
	"time"

	"github.com/eventify/backend/pkg/models"
	repoauth "github.com/eventify/backend/pkg/repository/auth"
	servicejwt "github.com/eventify/backend/pkg/services/jwt"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

type authWriteService struct {
	authReadService
	authRepo         repoauth.AuthRepository
	refreshTokenRepo repoauth.RefreshTokenRepository
	jwtService       *servicejwt.JWTService
}

const (
	// RotationGracePeriod allows concurrent requests to succeed if they happen within 30s
	RotationGracePeriod = 30 * time.Second
)

// NewAuthService initializes the complete auth service
func NewAuthService(auth repoauth.AuthRepository, token repoauth.RefreshTokenRepository, jwt *servicejwt.JWTService) AuthService {
	return &authWriteService{
		authReadService: authReadService{
			authRepo:   auth,
			jwtService: jwt,
		},
		authRepo:         auth,
		refreshTokenRepo: token,
		jwtService:       jwt,
	}
}


// sha256Hash helper for internal consistency
func sha256Hash(s string) []byte {
	h := sha256.New()
	h.Write([]byte(s))
	return h.Sum(nil)
}

// Signup hashes password and creates new user
func (s *authWriteService) Signup(ctx context.Context, user *models.User) (uuid.UUID, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return uuid.Nil, err
	}
	user.PasswordHash = string(hashedPassword)
	user.Role = models.RoleCustomer
	return s.authRepo.CreateUser(ctx, user)
}

// Login validates credentials and issues token pair
func (s *authWriteService) Login(ctx context.Context, email, password, ipAddress, userAgent string) (*models.UserProfile, *TokenPair, error) {
    locked, _, err := s.authRepo.IsAccountLocked(ctx, email)
    if locked {
        return nil, nil, ErrAccountLocked
    }

    user, err := s.authRepo.GetUserByEmail(ctx, email)
    if err != nil || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
        s.authRepo.RecordLoginAttempt(ctx, email, false)
        return nil, nil, ErrInvalidCredentials
    }

    s.authRepo.RecordLoginAttempt(ctx, email, true)
    s.authRepo.UpdateLastLogin(ctx, user.ID)

    // FIXED: Now using real metadata instead of hardcoded strings
    tokens, err := s.generateTokenPair(ctx, user.ID.String(), 3600*24*30, nil, ipAddress, userAgent)
    if err != nil {
        return nil, nil, err
    }

    return user.ToUserProfile(false, false), tokens, nil
}

// Logout revokes refresh token and blacklists access token
func (s *authWriteService) Logout(ctx context.Context, userID uuid.UUID, refreshToken string, accessToken string) error {
	if refreshToken != "" {
		if err := s.refreshTokenRepo.RevokeRefreshToken(ctx, userID, refreshToken); err != nil {
			log.Warn().Err(err).Msg("Auth: Failed to revoke refresh token on logout")
		}
	}

	if accessToken != "" {
		claims, err := s.jwtService.ValidateAccessToken(accessToken)
		if err == nil {
			if err := s.authRepo.BlacklistToken(ctx, accessToken, claims.ExpiresAt.Time); err != nil {
				log.Error().Err(err).Msg("Auth: Failed to blacklist access token")
			}
		}
	}

	return nil
}

// RefreshToken implements token rotation with reuse detection and concurrency grace periods
func (s *authWriteService) RefreshToken(ctx context.Context, oldTokenStr string, absoluteTimeout time.Duration, ipAddress string, userAgent string) (*TokenPair, error) {
	// 1. Validate JWT Structure (Check signature and basic claims)
	_, err := s.jwtService.ValidateRefreshToken(oldTokenStr)
	if err != nil {
		return nil, ErrSessionExpired
	}

	// 2. Fetch Token State from DB via Hash
	// We hash the incoming token to look it up in the database
	tokenHash := hex.EncodeToString(sha256Hash(oldTokenStr)) 
	storedToken, err := s.refreshTokenRepo.GetByHash(ctx, tokenHash)
	if err != nil || storedToken == nil {
		return nil, ErrSessionExpired
	}

	userID := storedToken.UserID

	// 3. REUSE DETECTION: Check if already explicitly revoked
	if storedToken.ConsumedAt != nil {
    if time.Since(*storedToken.ConsumedAt) > RotationGracePeriod {
        log.Warn().Msg("🚨 Token used outside grace period")
        _ = s.refreshTokenRepo.RevokeFamily(ctx, storedToken.ID)
        return nil, ErrSessionExpired
    }
    log.Debug().Msg("Request within grace period - allowing rotation")
}

	// 4. CONCURRENCY CHECK: Grace Period Logic (The "401 Fix")
	if storedToken.ConsumedAt != nil {
		if time.Since(*storedToken.ConsumedAt) > RotationGracePeriod {
			log.Warn().
				Str("user_id", userID.String()).
				Time("consumed_at", *storedToken.ConsumedAt).
				Msg("🚨 Token used after grace period. Revoking family.")
			
			_ = s.refreshTokenRepo.RevokeFamily(ctx, storedToken.ID)
			return nil, ErrSessionExpired
		}

		// Within grace period (30s)! 
		// We SHORT-CIRCUIT here. We don't call ConsumeToken again.
		// This handles the race condition where multiple client requests arrive at once.
		log.Debug().Msg("Request within grace period. Allowing rotation.")
		return s.generateTokenPair(ctx, userID.String(), 0, &storedToken.ID, ipAddress, userAgent)
	}

	// 5. Absolute Timeout Check
	// Prevents a session from being extended infinitely via rotation
	if time.Since(storedToken.CreatedAt) > absoluteTimeout {
		log.Info().Str("user_id", userID.String()).Msg("Session reached absolute timeout.")
		_ = s.refreshTokenRepo.RevokeRefreshToken(ctx, userID, oldTokenStr)
		return nil, ErrSessionExpired
	}

	// 6. ATOMIC ROTATION
	// This path is only reached if ConsumedAt was nil (first time use).
	// We mark current as consumed to prevent future use (outside the grace period).
	if err := s.refreshTokenRepo.ConsumeToken(ctx, storedToken.ID); err != nil {
		log.Error().Err(err).Msg("Failed to mark token as consumed")
		return nil, err
	}

	// Generate new pair linked to this parent ID to maintain the "Family" chain
	return s.generateTokenPair(ctx, userID.String(), 0, &storedToken.ID, ipAddress, userAgent)
}

// ForgotPassword generates reset token for email delivery
func (s *authWriteService) ForgotPassword(ctx context.Context, email string) (string, error) {
	user, err := s.authRepo.GetUserByEmail(ctx, email)
	if err != nil {
		return "", nil // Anti-enumeration
	}

	token, err := s.generateSecureToken()
	if err != nil {
		return "", err
	}

	expiry := time.Now().Add(15 * time.Minute)
	if err := s.authRepo.SavePasswordResetToken(ctx, user.Email, token, expiry); err != nil {
		return "", err
	}

	return token, nil
}

// ResetPassword updates password and revokes all sessions
func (s *authWriteService) ResetPassword(ctx context.Context, token, newPassword string) error {
	user, err := s.authRepo.GetUserByResetToken(ctx, token)
	if err != nil {
		return err
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	if err := s.authRepo.UpdatePassword(ctx, user.ID, string(hashedPassword)); err != nil {
		return err
	}

	_ = s.authRepo.ClearPasswordResetToken(ctx, user.ID)
	return s.refreshTokenRepo.RevokeAllUserTokens(ctx, user.ID)
}

// BlacklistToken stores token in blacklist until expiry
func (s *authWriteService) BlacklistToken(ctx context.Context, token string, expiry time.Time) error {
	if token == "" {
		return nil
	}
	return s.authRepo.BlacklistToken(ctx, token, expiry)
}

// IsTokenBlacklisted checks if token exists in blacklist
func (s *authWriteService) IsTokenBlacklisted(ctx context.Context, token string) (bool, error) {
	if token == "" {
		return false, nil
	}
	return s.authRepo.IsTokenBlacklisted(ctx, token)
}

// generateTokenPair creates new access/refresh token pair
func (s *authWriteService) generateTokenPair(
	ctx context.Context, 
	userID string, 
	refreshExpiry int, 
	parentID *uuid.UUID,
	ipAddress string,
	userAgent string,
)(*TokenPair, error) {
	uID, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}

	accessToken, err := s.jwtService.GenerateAccessToken(userID)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.jwtService.GenerateRefreshToken(userID)
	if err != nil {
		return nil, err
	}

	if refreshExpiry <= 0 {
		refreshExpiry = 3600 * 24 * 30 // 30 days
	}

	// FIXED: Added ipAddress and userAgent to satisfy the Repository Interface
	_, err = s.refreshTokenRepo.SaveRefreshToken(
		ctx, 
		uID, 
		refreshToken, 
		refreshExpiry, 
		parentID, 
		ipAddress, 
		userAgent,
	)
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}


// generateSecureToken creates cryptographically secure hex string
func (s *authWriteService) generateSecureToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
