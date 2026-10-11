// backend/pkg/services/auth/refresh_token_first_use_test.go
//
// Tests for the happy-path first-time use of a refresh token.
// First use = ConsumedAt is nil. The service must: mark the token consumed,
// generate a new pair, cache it, and return the correct userID.
//
// Run:
//   go test ./pkg/services/auth/ -v -run TestRefreshToken_FirstUse
//   go test ./pkg/services/auth/ -race -run TestRefreshToken_FirstUse

package auth

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

// TestRefreshToken_FirstUse_ConsumesToken verifies ConsumeToken is called
// on first use to prevent the token from being reused outside the grace period.
func TestRefreshToken_FirstUse_ConsumesToken(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = nil
	refreshRepo.getByHashToken = stored

	svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0") //nolint:errcheck

	if !refreshRepo.consumeTokenCalled {
		t.Error("ConsumeToken must be called on first use to mark the token as consumed")
	}
}

// TestRefreshToken_FirstUse_GeneratesNewPair verifies that a non-nil token pair
// is returned on first use.
func TestRefreshToken_FirstUse_GeneratesNewPair(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = nil
	refreshRepo.getByHashToken = stored

	_, tokens, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if err != nil {
		t.Fatalf("first use: expected success, got %v", err)
	}
	if tokens == nil {
		t.Fatal("first use: expected token pair, got nil")
	}
	if tokens.AccessToken == "" {
		t.Error("access token must not be empty")
	}
	if tokens.RefreshToken == "" {
		t.Error("refresh token must not be empty")
	}
}

// TestRefreshToken_FirstUse_ReturnsCorrectUserID verifies that the returned
// userID matches the one stored in the DB token record.
func TestRefreshToken_FirstUse_ReturnsCorrectUserID(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = nil
	refreshRepo.getByHashToken = stored

	returnedUserID, _, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if err != nil {
		t.Fatalf("first use: expected success, got %v", err)
	}
	if returnedUserID != userID {
		t.Errorf("returned userID mismatch: got %v, want %v", returnedUserID, userID)
	}
}

// TestRefreshToken_FirstUse_SavesNewTokenForCorrectUser verifies that
// SaveRefreshToken is called with the correct userID so the new token
// is associated with the right account.
func TestRefreshToken_FirstUse_SavesNewTokenForCorrectUser(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = nil
	refreshRepo.getByHashToken = stored

	svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0") //nolint:errcheck

	if !refreshRepo.saveRefreshTokenCalled {
		t.Error("SaveRefreshToken must be called to persist the new token")
	}
	if refreshRepo.saveRefreshTokenUserID != userID {
		t.Errorf("SaveRefreshToken called with wrong userID: got %v, want %v",
			refreshRepo.saveRefreshTokenUserID, userID)
	}
}

func TestDebug_JWTKeyConsistency(t *testing.T) {
    // Step 1: testJWT signs and validates its own token
    token := generateValidRefreshToken(t, uuid.New().String())
    _, err := testJWT.ValidateRefreshToken(token)
    if err != nil {
        t.Fatalf("testJWT cannot validate its own token: %v", err)
    }
    t.Log("✅ testJWT validates its own token")

    // Step 2: service signs, testJWT validates — same key?
    svc, _, _ := buildService(t)
    svcToken, err := svc.jwtService.GenerateRefreshToken(uuid.New().String())
    if err != nil {
        t.Fatalf("svc.jwtService.GenerateRefreshToken failed: %v", err)
    }
    _, err = testJWT.ValidateRefreshToken(svcToken)
    if err != nil {
        t.Fatalf("DIFFERENT KEYS — svc.jwtService and testJWT do not share keys: %v", err)
    }
    t.Log("✅ svc.jwtService and testJWT share the same key")

    // Step 3: testJWT signs, service validates — reverse check
    _, err = svc.jwtService.ValidateRefreshToken(token)
    if err != nil {
        t.Fatalf("DIFFERENT KEYS — service cannot validate testJWT token: %v", err)
    }
    t.Log("✅ svc.jwtService validates testJWT token")
}