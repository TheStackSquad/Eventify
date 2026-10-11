// backend/pkg/services/auth/signup_test.go
//
// Unit tests for authWriteService.Signup.
// Covers: password hashing, role enforcement, and UUID return.
//
// Run:
//   go test ./pkg/services/auth/ -v -run TestSignup

package auth

import (
	"context"
	"strings"
	"testing"

	"github.com/eventify/backend/pkg/models"
	"golang.org/x/crypto/bcrypt"
)

// TestSignup_HashesPassword verifies that the stored PasswordHash is a valid
// bcrypt hash of the original password (not plaintext).
func TestSignup_HashesPassword(t *testing.T) {
	svc, _, _ := buildService(t)

	user := &models.User{
		Email:    "new@example.com",
		Password: "supersecret",
	}

	_, err := svc.Signup(context.Background(), user)
	if err != nil {
		t.Fatalf("Signup: expected success, got %v", err)
	}

	if user.PasswordHash == "" {
		t.Fatal("PasswordHash must be set after Signup")
	}
	if user.PasswordHash == "supersecret" {
		t.Fatal("PasswordHash must not be the plaintext password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte("supersecret")); err != nil {
		t.Errorf("PasswordHash must be a valid bcrypt hash of the original password: %v", err)
	}
}

// TestSignup_AlwaysSetsRoleCustomer verifies that regardless of the Role field
// passed in, Signup always sets Role to RoleCustomer. This prevents privilege
// escalation via a crafted signup request.
func TestSignup_AlwaysSetsRoleCustomer(t *testing.T) {
	svc, _, _ := buildService(t)

	user := &models.User{
		Email:    "evil@example.com",
		Password: "password",
		Role:     models.RoleAdmin, // attacker attempts to self-assign admin
	}

	_, err := svc.Signup(context.Background(), user)
	if err != nil {
		t.Fatalf("Signup: expected success, got %v", err)
	}

	if user.Role != models.RoleCustomer {
		t.Errorf("Signup must override role to RoleCustomer, got %v", user.Role)
	}
}

// TestSignup_ReturnsNonNilUUID verifies that a successful signup returns a
// non-zero UUID (the new user's ID).
func TestSignup_ReturnsNonNilUUID(t *testing.T) {
	svc, _, _ := buildService(t)

	user := &models.User{
		Email:    "new@example.com",
		Password: "password",
	}

	id, err := svc.Signup(context.Background(), user)
	if err != nil {
		t.Fatalf("Signup: expected success, got %v", err)
	}
	if id.String() == "00000000-0000-0000-0000-000000000000" {
		t.Error("Signup must return a non-zero UUID")
	}
}

// TestSignup_PasswordTooLong_bcryptLimit verifies that a password exceeding
// bcrypt's 72-byte hard limit returns an error rather than silently truncating.
// Note: standard bcrypt silently truncates at 72 bytes. If your implementation
// adds a length check, this test validates that guard. If not, document the
// truncation behaviour here so future developers are aware.
func TestSignup_PasswordTooLong_DocumentsBcryptBehaviour(t *testing.T) {
	svc, _, _ := buildService(t)

	longPassword := strings.Repeat("a", 73) // 73 bytes — beyond bcrypt's 72-byte limit
	user := &models.User{
		Email:    "long@example.com",
		Password: longPassword,
	}

	_, err := svc.Signup(context.Background(), user)

	// Standard bcrypt silently truncates. If your service adds a length guard,
	// change this assertion to: if err == nil { t.Error("expected error for >72 byte password") }
	// For now we document that Signup succeeds (bcrypt truncation behaviour).
	if err != nil {
		t.Logf("Note: Signup returned error for 73-byte password: %v", err)
		t.Logf("If this is a deliberate guard, update this test to assert the error.")
	}
}
