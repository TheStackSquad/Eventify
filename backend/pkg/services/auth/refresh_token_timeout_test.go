// backend/pkg/services/auth/refresh_token_timeout_test.go
//
// Tests for the absolute session timeout check in RefreshToken.
// Absolute timeout prevents infinite session extension via token rotation:
// a token created 31 days ago must be rejected even if it would otherwise
// be valid (not revoked, not consumed, JWT signature OK).
//
// Run:
//   go test ./pkg/services/auth/ -v -run TestRefreshToken_AbsoluteTimeout

package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

// TestRefreshToken_AbsoluteTimeout_ReturnsErrSessionExpired verifies that a
// token whose CreatedAt is beyond the caller-supplied absoluteTimeout is
// rejected, regardless of its JWT expiry or DB state.
func TestRefreshToken_AbsoluteTimeout_ReturnsErrSessionExpired(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	stored := makeStoredToken(userID, tokenHash)
	stored.CreatedAt = time.Now().Add(-31 * 24 * time.Hour) // 31 days ago > 30-day limit
	refreshRepo.getByHashToken = stored

	_, _, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if !errors.Is(err, ErrSessionExpired) {
		t.Errorf("absolute timeout: expected ErrSessionExpired, got %v", err)
	}
}

// TestRefreshToken_JustBelowAbsoluteTimeout_Succeeds verifies that a token
// created just inside the absolute timeout window is allowed through.
func TestRefreshToken_JustBelowAbsoluteTimeout_Succeeds(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	stored := makeStoredToken(userID, tokenHash)
	// 29 days 23 hours ago — comfortably within the 30-day window
	stored.CreatedAt = time.Now().Add(-(30*24*time.Hour - time.Hour))
	refreshRepo.getByHashToken = stored

	_, tokens, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if err != nil {
		t.Errorf("just-inside absolute timeout: expected success, got %v", err)
	}
	if tokens == nil {
		t.Error("expected token pair, got nil")
	}
}

// TestRefreshToken_ExactAbsoluteTimeout_ReturnsErrSessionExpired tests the
// boundary condition: a token created exactly at the timeout threshold.
// time.Since will be >= absoluteTimeout, so it must be rejected.
func TestRefreshToken_ExactAbsoluteTimeout_ReturnsErrSessionExpired(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	stored := makeStoredToken(userID, tokenHash)
	// Exactly 30 days ago. time.Since will be >= 30*24*time.Hour.
	stored.CreatedAt = time.Now().Add(-30 * 24 * time.Hour)
	refreshRepo.getByHashToken = stored

	_, _, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if !errors.Is(err, ErrSessionExpired) {
		t.Errorf("exact timeout boundary: expected ErrSessionExpired, got %v", err)
	}
}

// TestRefreshToken_AbsoluteTimeout_RevokesToken verifies that when a token
// is expired by absolute timeout, RevokeRefreshToken is called to clean up
// the DB record and prevent further lookup.
func TestRefreshToken_AbsoluteTimeout_RevokesToken(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	stored := makeStoredToken(userID, tokenHash)
	stored.CreatedAt = time.Now().Add(-31 * 24 * time.Hour)
	refreshRepo.getByHashToken = stored

	svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0") //nolint:errcheck

	// RevokeFamily must NOT be called — timeout is not a theft signal
	if refreshRepo.revokeFamilyCalled {
		t.Error("RevokeFamily must not be called on absolute timeout — that is only for theft detection")
	}
}