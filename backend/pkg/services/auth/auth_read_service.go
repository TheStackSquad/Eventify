// backend/pkg/services/auth/auth_read_service.go

package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"

	"github.com/eventify/backend/pkg/models"
	servicejwt "github.com/eventify/backend/pkg/services/jwt"
	repoauth "github.com/eventify/backend/pkg/repository/auth"
	repovendor "github.com/eventify/backend/pkg/repository/vendor"
	repoevent "github.com/eventify/backend/pkg/repository/event"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// authReadService provides read-only identity and verification logic
type authReadService struct {
	authRepo         repoauth.AuthRepository
	jwtService       *servicejwt.JWTService
	vendorRepo       repovendor.VendorRepository
	eventRepo        repoevent.EventRepository
	refreshTokenRepo repoauth.RefreshTokenRepository
}

// GetUserProfile fetches and enriches user profile with vendor/event data
func (s *authReadService) GetUserProfile(ctx context.Context, userID uuid.UUID) (*models.UserProfile, error) {
    user, err := s.authRepo.GetUserByID(ctx, userID)
    if err != nil {
        return nil, ErrUserNotFound
    }

    // Check vendor ID and event status concurrently
    type vendorResult struct {
        vendorID *uuid.UUID
        err      error
    }

    type eventResult struct {
        hasEvents bool
        err       error
    }

    vendorChan := make(chan vendorResult, 1)
    eventChan := make(chan eventResult, 1)

    go func() {
        vendorID, err := s.authRepo.GetVendorIDByOwnerID(ctx, userID)
        vendorChan <- vendorResult{vendorID: vendorID, err: err}
    }()

    // Check events concurrently (unchanged)
    go func() {
        hasEvents, err := s.eventRepo.HasEventsByOrganizer(ctx, userID)
        eventChan <- eventResult{hasEvents: hasEvents, err: err}
    }()

    // Collect results
    vendorRes := <-vendorChan
    eventRes := <-eventChan

    // Log errors but use safe defaults
    if vendorRes.err != nil {
        log.Warn().
            Err(vendorRes.err).
            Str("user_id", userID.String()).
            Msg("Auth: Failed to check vendor status - defaulting to nil")
        vendorRes.vendorID = nil
    }

    if eventRes.err != nil {
        log.Warn().
            Err(eventRes.err).
            Str("user_id", userID.String()).
            Msg("Auth: Failed to check event ownership - defaulting to false")
        eventRes.hasEvents = false
    }

    // ✅ CHANGED: Pass vendorID instead of isVendor boolean
    return user.ToUserProfile(vendorRes.vendorID, eventRes.hasEvents), nil
}

// VerifyResetToken checks if a password reset token is valid and unexpired
func (s *authReadService) VerifyResetToken(ctx context.Context, token string) (bool, error) {
	_, err := s.authRepo.GetUserByResetToken(ctx, token)
	if err != nil {
		return false, nil
	}
	return true, nil
}

// ParseAccessToken validates and parses an access token
func (s *authReadService) ParseAccessToken(ctx context.Context, token string) (*servicejwt.Claims, error) {
	// Use the JWT service to validate the string and parse claims
	claims, err := s.jwtService.ValidateAccessToken(token)
	if err != nil {
		// Don't expose internal JWT errors to clients
		return nil, ErrSessionExpired
	}

	return claims, nil
}

// ✅ IMPLEMENTED: ValidateTokenMetadata checks for suspicious session changes
func (s *authReadService) ValidateTokenMetadata(
	ctx context.Context,
	userID uuid.UUID,
	currentIP string,
	currentUserAgent string,
	originalIP string,
	originalUserAgent string,
) (suspicious bool, reason string) {

	// If no original metadata exists, nothing to validate
	if originalIP == "" || originalUserAgent == "" {
		return false, ""
	}

	// ✅ Check IP address change
	if currentIP != originalIP {
		log.Warn().
			Str("user_id", userID.String()).
			Str("original_ip", originalIP).
			Str("current_ip", currentIP).
			Msg("🔍 Security: IP address changed during session")

		// Phase 3: Just log and flag as suspicious
		// Phase 4: Can add stricter enforcement (require step-up auth, etc.)
		return true, "IP_CHANGE_DETECTED"
	}

	// ✅ Check User-Agent change (device/browser switch)
	if currentUserAgent != originalUserAgent {
		log.Warn().
			Str("user_id", userID.String()).
			Str("original_ua", originalUserAgent).
			Str("current_ua", currentUserAgent).
			Msg("🔍 Security: User-Agent changed during session")

		// Phase 3: Just log and flag as suspicious
		// Phase 4: Can add device fingerprinting and stricter rules
		return true, "USER_AGENT_CHANGE_DETECTED"
	}

	return false, ""
}

// ✅ IMPLEMENTED: GetRefreshTokenMetadata extracts metadata from token hash
func (s *authReadService) GetRefreshTokenMetadata(
	ctx context.Context,
	tokenHash string,
) (ipAddress string, userAgent string, err error) {
	// Query the refresh_tokens table for stored metadata
	ip, ua, err := s.refreshTokenRepo.GetMetadataByHash(ctx, tokenHash)
	if err != nil {
		log.Debug().
			Err(err).
			Str("token_hash_preview", tokenHash[:8]+"...").
			Msg("Auth: Could not retrieve token metadata")
		return "", "", err
	}

	return ip, ua, nil
}

// ✅ NEW: Helper to hash token for metadata lookup
func (s *authReadService) hashTokenForMetadata(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}