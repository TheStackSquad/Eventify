// backend/pkg/services/auth/refresh_token_revoked_test.go
//
// Tests for the revoked-token guard in RefreshToken.
// These verify that Revoked=true is checked before any other logic:
// before ConsumedAt, before absolute timeout, before family revocation.
//
// Run:
//   go test ./pkg/services/auth/ -v -run TestRefreshToken_Revoked

package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

// TestRefreshToken_RevokedToken_ReturnsErrSessionExpired verifies that a token
// with Revoked=true is rejected immediately, even if it also has a ConsumedAt
// timestamp (which would otherwise trigger the grace-period or family-revoke path).
func TestRefreshToken_RevokedToken_ReturnsErrSessionExpired(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	consumed := time.Now().Add(-5 * time.Second)
	stored := makeStoredToken(userID, tokenHash)
	stored.Revoked = true
	stored.ConsumedAt = &consumed // has ConsumedAt, but Revoked check must fire first
	refreshRepo.getByHashToken = stored

	_, _, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if !errors.Is(err, ErrSessionExpired) {
		t.Errorf("expected ErrSessionExpired, got %v", err)
	}
}

// TestRefreshToken_RevokedToken_DoesNotTriggerFamilyRevocation ensures that
// RevokeFamily is NOT called for a cleanly-revoked token. Family revocation
// is a response to theft (reuse after grace period), not routine revocation.
func TestRefreshToken_RevokedToken_DoesNotTriggerFamilyRevocation(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	stored := makeStoredToken(userID, tokenHash)
	stored.Revoked = true
	refreshRepo.getByHashToken = stored

	svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0") //nolint:errcheck

	if refreshRepo.revokeFamilyCalled {
		t.Error("RevokeFamily must not be called for a simply-revoked token")
	}
}

// TestRefreshToken_RevokedTokenWithNilConsumedAt_StillRejected ensures the
// revoked guard fires even when ConsumedAt is nil. This covers the
// RevokeAllUserTokens scenario: tokens are marked revoked but never consumed.
func TestRefreshToken_RevokedTokenWithNilConsumedAt_StillRejected(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	stored := makeStoredToken(userID, tokenHash)
	stored.Revoked = true
	stored.ConsumedAt = nil // unconsumed but revoked — RevokeAllUserTokens scenario
	refreshRepo.getByHashToken = stored

	_, _, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if !errors.Is(err, ErrSessionExpired) {
		t.Errorf("expected ErrSessionExpired, got %v", err)
	}
	if refreshRepo.revokeFamilyCalled {
		t.Error("RevokeFamily must not be called for a token that is revoked but unconsumed")
	}
}

// TestRefreshToken_GetByHashError_ReturnsErrSessionExpired verifies that a
// database failure on GetByHash surfaces as ErrSessionExpired (not a panic
// or internal error leak).
func TestRefreshToken_GetByHashError_ReturnsErrSessionExpired(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	token := generateValidRefreshToken(t, uuid.New().String())
	refreshRepo.getByHashToken = nil
	refreshRepo.getByHashErr = errors.New("connection timeout")

	_, _, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if !errors.Is(err, ErrSessionExpired) {
		t.Errorf("DB error: expected ErrSessionExpired, got %v", err)
	}
}

// TestRefreshToken_InvalidJWT_ReturnsErrSessionExpired verifies that a token
// with a bad signature is rejected at the JWT validation step, before any
// database lookup occurs.
func TestRefreshToken_InvalidJWT_ReturnsErrSessionExpired(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	refreshRepo.getByHashToken = makeStoredToken(uuid.New(), "any-hash")

	_, _, err := svc.RefreshToken(context.Background(), "not.a.valid.jwt", 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if !errors.Is(err, ErrSessionExpired) {
		t.Errorf("invalid JWT: expected ErrSessionExpired, got %v", err)
	}
}