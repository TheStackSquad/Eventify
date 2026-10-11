// backend/pkg/services/auth/auth_write_service.go

package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"

	"github.com/eventify/backend/pkg/models"
	repoauth "github.com/eventify/backend/pkg/repository/auth"
	repoevent "github.com/eventify/backend/pkg/repository/event"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	servicejwt "github.com/eventify/backend/pkg/services/jwt"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

const (
	RotationGracePeriod = 30 * time.Second
	TokenCacheTTL       = 35 * time.Second
	shortRefreshTTL = 3600 * 24
	persistentRefreshTTL = 3600 * 24 * 30
)

type authWriteService struct {
	authReadService
	authRepo         repoauth.AuthRepository
	refreshTokenRepo repoauth.RefreshTokenRepository
	jwtService       *servicejwt.JWTService
	vendorRepo       repovendor.VendorRepository
	eventRepo        repoevent.EventRepository

	tokenCache      map[string]*cachedTokenPair
	tokenCacheMutex sync.RWMutex
}

type cachedTokenPair struct {
	Tokens    *TokenPair
	UserID    uuid.UUID
	CreatedAt time.Time
}

func NewAuthService(
	auth repoauth.AuthRepository,
	token repoauth.RefreshTokenRepository,
	vendor repovendor.VendorRepository,
	event repoevent.EventRepository,
	jwt *servicejwt.JWTService,
) AuthService {
	readService := authReadService{
		authRepo:         auth,
		vendorRepo:       vendor,
		eventRepo:        event,
		jwtService:       jwt,
		refreshTokenRepo: token,
	}

	service := &authWriteService{
		authReadService:  readService,
		authRepo:         auth,
		refreshTokenRepo: token,
		vendorRepo:       vendor,
		eventRepo:        event,
		jwtService:       jwt,
		tokenCache:       make(map[string]*cachedTokenPair),
	}

	go service.cleanupTokenCache()
	return service
}

func (s *authWriteService) evictExpiredCacheEntries() {
    s.tokenCacheMutex.Lock()
    defer s.tokenCacheMutex.Unlock()
    now := time.Now()
    for key, cached := range s.tokenCache {
        if now.Sub(cached.CreatedAt) >= TokenCacheTTL {
            delete(s.tokenCache, key)
        }
    }
}

func (s *authWriteService) cleanupTokenCache() {
    ticker := time.NewTicker(1 * time.Minute)
    defer ticker.Stop()
    for range ticker.C {
        s.evictExpiredCacheEntries()
    }
}

func sha256Hash(s string) []byte {
	h := sha256.New()
	h.Write([]byte(s))
	return h.Sum(nil)
}

func (s *authWriteService) Signup(ctx context.Context, user *models.User) (uuid.UUID, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return uuid.Nil, err
	}
	user.PasswordHash = string(hashedPassword)
	user.Role = models.RoleCustomer
	return s.authRepo.CreateUser(ctx, user)
}

func (s *authWriteService) Login(
	ctx context.Context,
	email, password, ipAddress, userAgent string,
	rememberMe bool,
) (*models.UserProfile, *TokenPair, error) {

	log.Debug().
		Str("email", email).
		Bool("rememberMe", rememberMe).
		Msg("Login attempt")

	// Account lock check
	locked, _, err := s.authRepo.IsAccountLocked(ctx, email)
	if err != nil {
		return nil, nil, err
	}
	if locked {
		return nil, nil, ErrAccountLocked
	}

	// Fetch user
	user, err := s.authRepo.GetUserByEmail(ctx, email)
	if err != nil {
		s.authRepo.RecordLoginAttempt(ctx, email, false)
		return nil, nil, ErrInvalidCredentials
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		s.authRepo.RecordLoginAttempt(ctx, email, false)
		return nil, nil, ErrInvalidCredentials
	}

	s.authRepo.RecordLoginAttempt(ctx, email, true)
	s.authRepo.UpdateLastLogin(ctx, user.ID)

	refreshTTL := shortRefreshTTL
	if rememberMe {
		refreshTTL = persistentRefreshTTL
	}

	tokens, err := s.generateTokenPair(ctx, user.ID.String(), refreshTTL, nil, ipAddress, userAgent)
	if err != nil {
		return nil, nil, err
	}

	// Fetch vendor/event data concurrently
	var vendorID *uuid.UUID
	var hasEvents bool
	var wg sync.WaitGroup

	wg.Add(2)
	go func() {
		defer wg.Done()
		vendorID, _ = s.authRepo.GetVendorIDByOwnerID(ctx, user.ID)
	}()
	go func() {
		defer wg.Done()
		if s.eventRepo != nil {
			hasEvents, _ = s.eventRepo.HasEventsByOrganizer(ctx, user.ID)
		}
	}()
	wg.Wait()

	return user.ToUserProfile(vendorID, hasEvents), tokens, nil
}

func (s *authWriteService) Logout(ctx context.Context, userID uuid.UUID, refreshToken string, accessToken string) error {
	if refreshToken != "" {
		if err := s.refreshTokenRepo.RevokeRefreshToken(ctx, userID, refreshToken); err != nil {
			log.Warn().Err(err).Msg("Failed to revoke refresh token on logout")
		}
	}

	if accessToken != "" {
		claims, err := s.jwtService.ValidateAccessToken(accessToken)
		if err == nil {
			if err := s.authRepo.BlacklistToken(ctx, accessToken, claims.ExpiresAt.Time); err != nil {
				log.Error().Err(err).Msg("Failed to blacklist access token")
			}
		}
	}
	return nil
}

func (s *authWriteService) RefreshToken(
	ctx context.Context,
	oldTokenStr string,
	absoluteTimeout time.Duration,
	ipAddress string,
	userAgent string,
) (uuid.UUID, *TokenPair, error) {
	_, err := s.jwtService.ValidateRefreshToken(oldTokenStr)
	if err != nil {
		return uuid.Nil, nil, ErrSessionExpired
	}

	tokenHash := hex.EncodeToString(sha256Hash(oldTokenStr))
	storedToken, err := s.refreshTokenRepo.GetByHash(ctx, tokenHash)
	if err != nil || storedToken == nil {
		return uuid.Nil, nil, ErrSessionExpired
	}

	if storedToken.Revoked {
		return uuid.Nil, nil, ErrSessionExpired
	}

	userID := storedToken.UserID

	// FIX: >= ensures session is rejected at exactly the timeout boundary,
	// not one nanosecond past it. A session at exactly absoluteTimeout is
	// expired — allowing it through is a security gap.
	if time.Since(storedToken.CreatedAt) >= absoluteTimeout {
		log.Info().Str("user_id", userID.String()).Msg("Session reached absolute timeout")
		_ = s.refreshTokenRepo.RevokeRefreshToken(ctx, userID, oldTokenStr)
		return uuid.Nil, nil, ErrSessionExpired
	}

	originalIP, originalUA, metaErr := s.GetRefreshTokenMetadata(ctx, tokenHash)
	if metaErr == nil && originalIP != "" && originalUA != "" {
		suspicious, reason := s.ValidateTokenMetadata(
			ctx, userID, ipAddress, userAgent, originalIP, originalUA,
		)
		if suspicious {
			log.Warn().
				Str("user_id", userID.String()).
				Str("reason", reason).
				Msg("Suspicious activity detected during token refresh")
		}
	}

	if storedToken.ConsumedAt != nil {
		timeSinceConsumed := time.Since(*storedToken.ConsumedAt)

		// FIX: >= ensures a token presented at exactly the grace period
		// boundary is treated as reuse, not a legitimate concurrent request.
		// With >, a token consumed at exactly t=30s would pass through —
		// that is the theft detection window and must be closed.
		if timeSinceConsumed >= RotationGracePeriod {
			log.Warn().
				Str("user_id", userID.String()).
				Msg("Token used after grace period, revoking family")
			_ = s.refreshTokenRepo.RevokeFamily(ctx, storedToken.ID)
			return uuid.Nil, nil, ErrTokenReused
		}

		cacheKey := tokenHash
		s.tokenCacheMutex.RLock()
		cached, exists := s.tokenCache[cacheKey]
		s.tokenCacheMutex.RUnlock()

		if exists && time.Since(cached.CreatedAt) < TokenCacheTTL {
			log.Debug().Msg("Returning cached tokens within grace period")
			return cached.UserID, cached.Tokens, nil
		}

		log.Debug().Msg("Cache miss within grace period, generating new tokens")
		tokens, err := s.generateTokenPair(ctx, userID.String(), 0, &storedToken.ID, ipAddress, userAgent)
		if err != nil {
			return uuid.Nil, nil, err
		}

		s.tokenCacheMutex.Lock()
		s.tokenCache[cacheKey] = &cachedTokenPair{
			Tokens:    tokens,
			UserID:    userID,
			CreatedAt: time.Now(),
		}
		s.tokenCacheMutex.Unlock()
		return userID, tokens, nil
	}

	if err := s.refreshTokenRepo.ConsumeToken(ctx, storedToken.ID); err != nil {
		log.Error().Err(err).Msg("Failed to mark token as consumed")
		return uuid.Nil, nil, err
	}

	tokens, err := s.generateTokenPair(ctx, userID.String(), 0, &storedToken.ID, ipAddress, userAgent)
	if err != nil {
		return uuid.Nil, nil, err
	}

	cacheKey := tokenHash
	s.tokenCacheMutex.Lock()
	s.tokenCache[cacheKey] = &cachedTokenPair{
		Tokens:    tokens,
		UserID:    userID,
		CreatedAt: time.Now(),
	}
	s.tokenCacheMutex.Unlock()

	log.Debug().Str("user_id", userID.String()).Msg("Token rotated successfully")
	return userID, tokens, nil
}

func (s *authWriteService) ForgotPassword(ctx context.Context, email string) (string, error) {
	user, err := s.authRepo.GetUserByEmail(ctx, email)
	if err != nil {
		return "", nil
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

func (s *authWriteService) BlacklistToken(ctx context.Context, token string, expiry time.Time) error {
	if token == "" {
		return nil
	}
	return s.authRepo.BlacklistToken(ctx, token, expiry)
}

func (s *authWriteService) IsTokenBlacklisted(ctx context.Context, token string) (bool, error) {
	if token == "" {
		return false, nil
	}
	return s.authRepo.IsTokenBlacklisted(ctx, token)
}

func (s *authWriteService) generateTokenPair(
	ctx context.Context,
	userID string,
	refreshExpiry int,
	parentID *uuid.UUID,
	ipAddress string,
	userAgent string,
) (*TokenPair, error) {
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
		refreshExpiry = 3600 * 24 * 30
	}

	_, err = s.refreshTokenRepo.SaveRefreshToken(
		ctx, uID, refreshToken, refreshExpiry, parentID, ipAddress, userAgent,
	)
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *authWriteService) generateSecureToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}