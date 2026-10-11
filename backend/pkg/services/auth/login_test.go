// backend/pkg/services/auth/login_test.go
//
// Unit tests for authWriteService.Login.
// Covers: lockout enforcement, credential validation, side-effect ordering,
// and the returned profile/token shape.
//
// Run:
//   go test ./pkg/services/auth/ -v -run TestLogin

package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// hashPassword is a test helper that bcrypt-hashes a password.
// Uses MinCost to keep tests fast.
func hashPassword(t *testing.T, password string) string {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hashPassword: %v", err)
	}
	return string(hash)
}

// TestLogin_LockedAccount_ReturnsErrAccountLocked verifies that a locked
// account is rejected immediately, before any password comparison occurs.
func TestLogin_LockedAccount_ReturnsErrAccountLocked(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	authRepo.isLockedResult = true
	authRepo.isLockedUntil = time.Now().Add(15 * time.Minute)

	_, _, err := svc.Login(context.Background(), "user@example.com", "any-password", "127.0.0.1", "TestAgent/1.0", false)

	if !errors.Is(err, ErrAccountLocked) {
		t.Errorf("locked account: expected ErrAccountLocked, got %v", err)
	}
}

// TestLogin_UnknownEmail_ReturnsErrInvalidCredentials verifies that a lookup
// failure returns ErrInvalidCredentials (not a DB error), preventing email enumeration.
func TestLogin_UnknownEmail_ReturnsErrInvalidCredentials(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	authRepo.user = nil
	authRepo.getUserByEmailErr = errors.New("not found")

	_, _, err := svc.Login(context.Background(), "nobody@example.com", "password", "127.0.0.1", "TestAgent/1.0", false)

	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("unknown email: expected ErrInvalidCredentials, got %v", err)
	}
}

// TestLogin_UnknownEmail_RecordsFailedAttempt verifies that a failed user lookup
// still records a failed login attempt for rate-limiting purposes.
func TestLogin_UnknownEmail_RecordsFailedAttempt(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	authRepo.user = nil
	authRepo.getUserByEmailErr = errors.New("not found")

	svc.Login(context.Background(), "nobody@example.com", "password", "127.0.0.1", "TestAgent/1.0", false) //nolint:errcheck

	if !authRepo.recordLoginAttemptCalled {
		t.Error("failed user lookup must still record a failed login attempt")
	}
	if authRepo.recordLoginAttemptSuccess {
		t.Error("login attempt for unknown email must be recorded as failure (success=false)")
	}
}

// TestLogin_WrongPassword_ReturnsErrInvalidCredentials verifies that a wrong
// password returns ErrInvalidCredentials.
func TestLogin_WrongPassword_ReturnsErrInvalidCredentials(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	authRepo.user = &models.User{
		ID:           uuid.New(),
		Email:        "user@example.com",
		PasswordHash: hashPassword(t, "correct-password"),
	}

	_, _, err := svc.Login(context.Background(), "user@example.com", "wrong-password", "127.0.0.1", "TestAgent/1.0", false)

	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("wrong password: expected ErrInvalidCredentials, got %v", err)
	}
}

// TestLogin_WrongPassword_RecordsFailedAttempt verifies the failed attempt
// counter increments on wrong password (feeds into lockout logic).
func TestLogin_WrongPassword_RecordsFailedAttempt(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	authRepo.user = &models.User{
		ID:           uuid.New(),
		Email:        "user@example.com",
		PasswordHash: hashPassword(t, "correct-password"),
	}

	svc.Login(context.Background(), "user@example.com", "wrong-password", "127.0.0.1", "TestAgent/1.0", false) //nolint:errcheck

	if !authRepo.recordLoginAttemptCalled {
		t.Error("wrong password must record a failed login attempt")
	}
	if authRepo.recordLoginAttemptSuccess {
		t.Error("wrong password attempt must be recorded as failure (success=false)")
	}
}

// TestLogin_ValidCredentials_ReturnsTokenPair verifies that the happy path
// returns a non-nil token pair with non-empty tokens.
func TestLogin_ValidCredentials_ReturnsTokenPair(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	authRepo.user = &models.User{
		ID:           uuid.New(),
		Email:        "user@example.com",
		PasswordHash: hashPassword(t, "correct-password"),
	}

	_, tokens, err := svc.Login(context.Background(), "user@example.com", "correct-password", "127.0.0.1", "TestAgent/1.0", false)

	if err != nil {
		t.Fatalf("valid credentials: expected success, got %v", err)
	}
	if tokens == nil {
		t.Fatal("valid credentials: expected token pair, got nil")
	}
	if tokens.AccessToken == "" {
		t.Error("access token must not be empty on successful login")
	}
	if tokens.RefreshToken == "" {
		t.Error("refresh token must not be empty on successful login")
	}
}

// TestLogin_ValidCredentials_RecordsSuccessfulAttempt verifies that a
// successful login records success=true (which clears the failed attempt counter
// in real implementations).
func TestLogin_ValidCredentials_RecordsSuccessfulAttempt(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	authRepo.user = &models.User{
		ID:           uuid.New(),
		Email:        "user@example.com",
		PasswordHash: hashPassword(t, "correct-password"),
	}

	svc.Login(context.Background(), "user@example.com", "correct-password", "127.0.0.1", "TestAgent/1.0", false) //nolint:errcheck

	if !authRepo.recordLoginAttemptCalled {
		t.Error("successful login must call RecordLoginAttempt")
	}
	if !authRepo.recordLoginAttemptSuccess {
		t.Error("successful login must record success=true")
	}
}

// TestLogin_ValidCredentials_UpdatesLastLogin verifies that UpdateLastLogin is
// called after a successful authentication.
func TestLogin_ValidCredentials_UpdatesLastLogin(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	authRepo.user = &models.User{
		ID:           uuid.New(),
		Email:        "user@example.com",
		PasswordHash: hashPassword(t, "correct-password"),
	}

	svc.Login(context.Background(), "user@example.com", "correct-password", "127.0.0.1", "TestAgent/1.0", false) //nolint:errcheck

	if !authRepo.updateLastLoginCalled {
		t.Error("successful login must call UpdateLastLogin")
	}
}

// TestLogin_ValidCredentials_ReturnsUserProfile verifies that the returned
// UserProfile is non-nil and carries the correct user ID.
func TestLogin_ValidCredentials_ReturnsUserProfile(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	userID := uuid.New()
	authRepo.user = &models.User{
		ID:           userID,
		Email:        "user@example.com",
		PasswordHash: hashPassword(t, "correct-password"),
	}

	profile, _, err := svc.Login(context.Background(), "user@example.com", "correct-password", "127.0.0.1", "TestAgent/1.0", false)

	if err != nil {
		t.Fatalf("valid credentials: expected success, got %v", err)
	}
	if profile == nil {
		t.Fatal("expected user profile, got nil")
	}
	if profile.ID != userID {
		t.Errorf("profile ID mismatch: got %v, want %v", profile.ID, userID)
	}
}

// TestLogin_IsAccountLocked_CheckError_Propagates verifies that a DB error
// from IsAccountLocked is propagated and does not silently succeed.
func TestLogin_IsAccountLocked_Error_Propagates(t *testing.T) {
	svc, authRepo, _ := buildService(t)

	authRepo.isLockedErr = errors.New("db: connection refused")

	_, _, err := svc.Login(context.Background(), "user@example.com", "password", "127.0.0.1", "TestAgent/1.0", false)

	if err == nil {
		t.Error("IsAccountLocked DB error must propagate and not silently succeed")
	}
	// Must NOT be ErrInvalidCredentials — that would mask the real error
	if errors.Is(err, ErrInvalidCredentials) {
		t.Error("IsAccountLocked DB error must not be masked as ErrInvalidCredentials")
	}
}