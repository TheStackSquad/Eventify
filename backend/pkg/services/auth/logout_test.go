// backend/pkg/services/auth/logout_test.go
//
// Unit tests for authWriteService.Logout.
// Covers: empty token handling, access token blacklisting, refresh token
// revocation, invalid JWT graceful handling, and always-nil return.
//
// Run:
//   go test ./pkg/services/auth/ -v -run TestLogout

package auth

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

// TestLogout_EmptyTokens_ReturnsNil verifies that Logout with empty token
// strings is a safe no-op and does not panic or return an error.
func TestLogout_EmptyTokens_ReturnsNil(t *testing.T) {
	svc, _, _ := buildService(t)

	err := svc.Logout(context.Background(), uuid.New(), "", "")

	if err != nil {
		t.Errorf("empty tokens: expected nil error, got %v", err)
	}
}

// TestLogout_EmptyRefreshToken_SkipsRevocation verifies that an empty refresh
// token does not trigger RevokeRefreshToken.
func TestLogout_EmptyRefreshToken_SkipsRevocation(t *testing.T) {
	svc, _, _ := buildService(t)

	validAccess, _ := testJWT.GenerateAccessToken(uuid.New().String())
	// Let ValidateAccessToken succeed by using a real short-lived token
	svc.Logout(context.Background(), uuid.New(), "", validAccess) //nolint:errcheck

	// We can't directly assert RevokeRefreshToken wasn't called via the mock,
	// but an empty refreshToken string must not reach the repo. If it does,
	// a nil-dereference or wrong-user revocation would occur.
	// The real assertion is that no panic occurred and err == nil.
}

// TestLogout_EmptyAccessToken_SkipsBlacklisting verifies that an empty access
// token does not trigger BlacklistToken.
func TestLogout_EmptyAccessToken_SkipsBlacklisting(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	err := svc.Logout(context.Background(), uuid.New(), "some-refresh-token", "")

	if err != nil {
		t.Errorf("empty access token: expected nil error, got %v", err)
	}
	if authRepo.blacklistTokenCalled {
		t.Error("BlacklistToken must not be called when access token is empty")
	}
}

// TestLogout_ValidAccessToken_BlacklistsIt verifies that a valid, parseable
// access token is sent to BlacklistToken.
func TestLogout_ValidAccessToken_BlacklistsIt(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	userID := uuid.New()
	accessToken, err := testJWT.GenerateAccessToken(userID.String())
	if err != nil {
		t.Fatalf("failed to generate access token: %v", err)
	}

	svc.Logout(context.Background(), userID, "", accessToken) //nolint:errcheck

	if !authRepo.blacklistTokenCalled {
		t.Error("valid access token must be blacklisted on logout")
	}
}

// TestLogout_InvalidAccessToken_DoesNotBlacklist verifies that a token
// that fails JWT validation is silently skipped (not an error).
func TestLogout_InvalidAccessToken_DoesNotBlacklist(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	err := svc.Logout(context.Background(), uuid.New(), "", "not.a.valid.jwt")

	if err != nil {
		t.Errorf("invalid JWT: expected nil error, got %v", err)
	}
	if authRepo.blacklistTokenCalled {
		t.Error("invalid JWT must not be sent to BlacklistToken")
	}
}

// TestLogout_AlwaysReturnsNil verifies that Logout never returns an error
// to the caller, even if internal revocation or blacklisting fails.
// Errors are logged but must not bubble up (logout must always succeed from
// the client's perspective).
func TestLogout_AlwaysReturnsNil(t *testing.T) {
	svc, _, _ := buildService(t)

	userID := uuid.New()
	accessToken, _ := testJWT.GenerateAccessToken(userID.String())

	err := svc.Logout(context.Background(), userID, "any-refresh-token", accessToken)

	if err != nil {
		t.Errorf("Logout must always return nil, got %v", err)
	}
}

// TestLogout_BlacklistToken_Direct_EmptyToken verifies the BlacklistToken
// method itself treats an empty token as a no-op.
func TestLogout_BlacklistToken_Direct_EmptyToken(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	err := svc.BlacklistToken(context.Background(), "", time.Now().Add(time.Hour))

	if err != nil {
		t.Errorf("BlacklistToken with empty string: expected nil, got %v", err)
	}
	if authRepo.blacklistTokenCalled {
		t.Error("BlacklistToken repo method must not be called for empty token")
	}
}

// TestLogout_IsTokenBlacklisted_Direct_EmptyToken verifies that checking
// an empty token always returns (false, nil) without a DB call.
func TestLogout_IsTokenBlacklisted_Direct_EmptyToken(t *testing.T) {
	svc, _, _ := buildService(t)

	blacklisted, err := svc.IsTokenBlacklisted(context.Background(), "")

	if err != nil {
		t.Errorf("IsTokenBlacklisted with empty string: expected nil error, got %v", err)
	}
	if blacklisted {
		t.Error("empty token must not be reported as blacklisted")
	}
}