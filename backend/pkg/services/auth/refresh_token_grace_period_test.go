// backend/pkg/services/auth/refresh_token_grace_period_test.go
//
// Tests for the 30-second grace period in RefreshToken.
// The grace period allows concurrent requests using the same just-consumed
// token to succeed (e.g. mobile app firing two requests simultaneously).
// Outside the grace period, reuse is treated as a theft signal.
//
// Run:
//   go test ./pkg/services/auth/ -v -run TestRefreshToken_GracePeriod

package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

// TestRefreshToken_GracePeriod_29Seconds_Succeeds verifies that a token
// consumed 29 seconds ago (inside the 30s window) is allowed to rotate.
func TestRefreshToken_GracePeriod_29Seconds_Succeeds(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	consumed := time.Now().Add(-29 * time.Second)
	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = &consumed
	refreshRepo.getByHashToken = stored

	_, tokens, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if err != nil {
		t.Errorf("grace period (29s): expected success, got %v", err)
	}
	if tokens == nil {
		t.Error("expected token pair within grace period, got nil")
	}
}

// TestRefreshToken_GracePeriod_29Seconds_DoesNotRevokeFamily verifies that
// successful rotation inside the grace period does NOT trigger family revocation.
func TestRefreshToken_GracePeriod_29Seconds_DoesNotRevokeFamily(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	consumed := time.Now().Add(-29 * time.Second)
	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = &consumed
	refreshRepo.getByHashToken = stored

	svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0") //nolint:errcheck

	if refreshRepo.revokeFamilyCalled {
		t.Error("RevokeFamily must not be called within the grace period")
	}
}

// TestRefreshToken_GracePeriod_31Seconds_ReturnsErrTokenReused verifies that
// a token consumed 31 seconds ago (outside the 30s window) is treated as a
// theft signal and returns ErrTokenReused.
func TestRefreshToken_GracePeriod_31Seconds_ReturnsErrTokenReused(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	consumed := time.Now().Add(-31 * time.Second)
	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = &consumed
	refreshRepo.getByHashToken = stored

	_, _, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if !errors.Is(err, ErrTokenReused) {
		t.Errorf("after grace period: expected ErrTokenReused, got %v", err)
	}
}

// TestRefreshToken_GracePeriod_31Seconds_RevokesFamilyWithCorrectRootID verifies
// that RevokeFamily is called with the correct token ID when theft is detected.
func TestRefreshToken_GracePeriod_31Seconds_RevokesFamilyWithCorrectRootID(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	tokenID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	consumed := time.Now().Add(-31 * time.Second)
	stored := makeStoredToken(userID, tokenHash)
	stored.ID = tokenID
	stored.ConsumedAt = &consumed
	refreshRepo.getByHashToken = stored

	svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0") //nolint:errcheck

	if !refreshRepo.revokeFamilyCalled {
		t.Error("RevokeFamily must be called when token is reused after grace period")
	}
	if refreshRepo.revokeFamilyRootID != tokenID {
		t.Errorf("RevokeFamily called with wrong rootID: got %v, want %v",
			refreshRepo.revokeFamilyRootID, tokenID)
	}
}

// TestRefreshToken_GracePeriod_ExactBoundary_31s verifies the off-by-one:
// 30s is the limit, so 30s+1ns should be rejected.
func TestRefreshToken_GracePeriod_ExactBoundary_Rejected(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	// time.Since(consumed) will be >= RotationGracePeriod
	consumed := time.Now().Add(-RotationGracePeriod)
	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = &consumed
	refreshRepo.getByHashToken = stored

	_, _, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if !errors.Is(err, ErrTokenReused) {
		t.Errorf("exact grace boundary: expected ErrTokenReused, got %v", err)
	}
}