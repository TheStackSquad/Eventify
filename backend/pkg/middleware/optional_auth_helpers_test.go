// backend/pkg/middleware/optional_auth_helpers_test.go
//
// Tests for the three exported context readers and one private classifier
// defined in optional_auth.go:
//
//   GetUserID(c)        — reads "user_id" from context as (uuid.UUID, bool)
//   GetUserIDString(c)  — reads "user_id_string" from context as (string, bool)
//   IsAuthenticated(c)  — reads "authenticated" from context as bool
//   categorizeJWTError  — classifies a JWT error string into a metric category
//
// These functions are called directly by handlers — they are the public API
// that consumes what OptionalAuth sets. A wrong zero value or a missed type
// assertion here propagates silently into every authenticated handler.
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestGetUserID|TestGetUserIDString|TestIsAuthenticated|TestCategorizeJWTError

package middleware

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// ─── GetUserID ────────────────────────────────────────────────────────────────

// TestGetUserID_KeyAbsent proves GetUserID returns (uuid.Nil, false) when
// "user_id" is not in context — not a panic, not a zero UUID with true.
func TestGetUserID_KeyAbsent(t *testing.T) {
	t.Parallel()

	c := newGinContext()

	result, ok := GetUserID(c)

	assert.False(t, ok,
		"ok must be false when user_id is not in context")
	assert.Equal(t, uuid.Nil, result,
		"result must be uuid.Nil when user_id is absent")
}

// TestGetUserID_CorrectType proves GetUserID returns (uuid.UUID, true) when
// "user_id" is stored as a uuid.UUID — the happy path set by OptionalAuth.
func TestGetUserID_CorrectType(t *testing.T) {
	t.Parallel()

	c := newGinContext()
	c.Set("user_id", testUserID)

	result, ok := GetUserID(c)

	assert.True(t, ok, "ok must be true when user_id is a uuid.UUID")
	assert.Equal(t, testUserID, result,
		"result must equal the stored uuid.UUID")
}

// TestGetUserID_WrongType proves GetUserID returns (uuid.Nil, false) when
// "user_id" is stored as the wrong type — no panic, graceful degradation.
func TestGetUserID_WrongType(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value interface{}
	}{
		{name: "string UUID", value: testUserID.String()},
		{name: "integer", value: 12345},
		{name: "bool", value: true},
		{name: "nil", value: nil},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			c := newGinContext()
			c.Set("user_id", tc.value)

			result, ok := GetUserID(c)

			assert.False(t, ok,
				"ok must be false when user_id is type %T, not uuid.UUID", tc.value)
			assert.Equal(t, uuid.Nil, result,
				"result must be uuid.Nil on type mismatch — not a partial value")
		})
	}
}

// TestGetUserID_DistinctUsers proves GetUserID returns the exact UUID stored,
// not a fixed value — rules out hardcoding.
func TestGetUserID_DistinctUsers(t *testing.T) {
	t.Parallel()

	otherUserID := uuid.MustParse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")

	c := newGinContext()
	c.Set("user_id", otherUserID)

	result, ok := GetUserID(c)

	assert.True(t, ok)
	assert.Equal(t, otherUserID, result,
		"GetUserID must return the exact UUID stored — not testUserID, not uuid.Nil")
	assert.NotEqual(t, testUserID, result,
		"result must be the stored UUID, not the test fixture UUID")
}

// ─── GetUserIDString ──────────────────────────────────────────────────────────

// TestGetUserIDString_KeyAbsent proves GetUserIDString returns ("", false) when
// "user_id_string" is not in context.
func TestGetUserIDString_KeyAbsent(t *testing.T) {
	t.Parallel()

	c := newGinContext()

	result, ok := GetUserIDString(c)

	assert.False(t, ok)
	assert.Equal(t, "", result,
		"result must be empty string when user_id_string is absent")
}

// TestGetUserIDString_CorrectType proves GetUserIDString returns (string, true)
// when "user_id_string" is stored as a string — the happy path.
func TestGetUserIDString_CorrectType(t *testing.T) {
	t.Parallel()

	c := newGinContext()
	c.Set("user_id_string", testUserID.String())

	result, ok := GetUserIDString(c)

	assert.True(t, ok)
	assert.Equal(t, testUserID.String(), result)
}

// TestGetUserIDString_WrongType proves GetUserIDString returns ("", false) when
// the value is not a string — no panic.
func TestGetUserIDString_WrongType(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value interface{}
	}{
		{name: "uuid.UUID", value: testUserID},
		{name: "integer", value: 42},
		{name: "bool", value: false},
		{name: "nil", value: nil},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			c := newGinContext()
			c.Set("user_id_string", tc.value)

			result, ok := GetUserIDString(c)

			assert.False(t, ok,
				"ok must be false when user_id_string is type %T", tc.value)
			assert.Equal(t, "", result,
				"result must be empty string on type mismatch")
		})
	}
}

// TestGetUserIDString_ConsistentWithGetUserID proves that when OptionalAuth sets
// both keys correctly, GetUserID and GetUserIDString return consistent values —
// userID.String() == userIDString.
func TestGetUserIDString_ConsistentWithGetUserID(t *testing.T) {
	t.Parallel()

	c := newGinContext()
	c.Set("user_id", testUserID)
	c.Set("user_id_string", testUserID.String())

	userID, okUUID := GetUserID(c)
	userIDString, okString := GetUserIDString(c)

	assert.True(t, okUUID)
	assert.True(t, okString)
	assert.Equal(t, userID.String(), userIDString,
		"GetUserID().String() must equal GetUserIDString() — "+
			"inconsistency here causes silent mismatches in handlers")
}

// ─── IsAuthenticated ──────────────────────────────────────────────────────────

// TestIsAuthenticated_KeyAbsent proves IsAuthenticated returns false when
// "authenticated" is not in context — guest requests must not appear authenticated.
func TestIsAuthenticated_KeyAbsent(t *testing.T) {
	t.Parallel()

	c := newGinContext()

	assert.False(t, IsAuthenticated(c),
		"IsAuthenticated must return false when authenticated key is absent")
}

// TestIsAuthenticated_True proves IsAuthenticated returns true when
// "authenticated" is stored as bool true — the success path set by OptionalAuth.
func TestIsAuthenticated_True(t *testing.T) {
	t.Parallel()

	c := newGinContext()
	c.Set("authenticated", true)

	assert.True(t, IsAuthenticated(c))
}

// TestIsAuthenticated_False proves IsAuthenticated returns false when
// "authenticated" is stored as bool false — explicit false is still guest.
func TestIsAuthenticated_False(t *testing.T) {
	t.Parallel()

	c := newGinContext()
	c.Set("authenticated", false)

	assert.False(t, IsAuthenticated(c),
		"IsAuthenticated must return false when authenticated=false")
}

// TestIsAuthenticated_WrongType proves IsAuthenticated returns false when
// "authenticated" holds a non-bool value — no panic, fail-safe to guest.
func TestIsAuthenticated_WrongType(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value interface{}
	}{
		{name: "string true", value: "true"},
		{name: "integer 1", value: 1},
		{name: "nil", value: nil},
		{name: "uuid", value: testUserID},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			c := newGinContext()
			c.Set("authenticated", tc.value)

			assert.False(t, IsAuthenticated(c),
				"IsAuthenticated must return false for non-bool type %T — "+
					"fail-safe to guest on type mismatch", tc.value)
		})
	}
}

// TestIsAuthenticated_GuestContextIsClean proves that a context with no keys
// (as set by guest paths in OptionalAuth) correctly returns false — not a
// partial match on some other key.
func TestIsAuthenticated_GuestContextIsClean(t *testing.T) {
	t.Parallel()

	c := newGinContext()
	// Simulate a guest context — user_id and user_id_string absent too.

	assert.False(t, IsAuthenticated(c))

	_, hasUserID := GetUserID(c)
	_, hasUserIDString := GetUserIDString(c)

	assert.False(t, hasUserID,
		"guest context must have no user_id")
	assert.False(t, hasUserIDString,
		"guest context must have no user_id_string")
}

// ─── categorizeJWTError ───────────────────────────────────────────────────────

// TestCategorizeJWTError_NilError proves nil returns "unknown" — the function
// handles a nil argument without panicking.
func TestCategorizeJWTError_NilError(t *testing.T) {
	t.Parallel()

	result := categorizeJWTError(nil)
	assert.Equal(t, "unknown", result,
		"nil error must return 'unknown' — not a panic, not an empty string")
}

// TestCategorizeJWTError_Categories proves each error string variant maps to
// the correct category string used in metrics and logs.
func TestCategorizeJWTError_Categories(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		errMsg       string
		wantCategory string
	}{
		{
			name:         "expired token",
			errMsg:       "token is expired by 1h0m0s",
			wantCategory: "token_expired",
		},
		{
			name:         "not valid yet",
			errMsg:       "token is not valid yet",
			wantCategory: "token_not_yet_valid",
		},
		{
			name:         "invalid signature",
			errMsg:       "crypto/rsa: signature verification error",
			wantCategory: "invalid_signature",
		},
		{
			name:         "malformed token",
			errMsg:       "token is malformed: could not base64 decode header",
			wantCategory: "malformed_token",
		},
		{
			name:         "RSA key error",
			errMsg:       "RSA key is nil",
			wantCategory: "rsa_key_error",
		},
		{
			name:         "invalid token type",
			errMsg:       "unexpected token type: refresh",
			wantCategory: "invalid_token_type",
		},
		{
			name:         "wrong token type — not an access token",
			errMsg:       "not an access token",
			wantCategory: "wrong_token_type",
		},
		{
			name:         "unknown error falls through to default",
			errMsg:       "some completely unrecognised error string",
			wantCategory: "validation_error",
		},
		{
			name:         "empty error string",
			errMsg:       "",
			wantCategory: "validation_error",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			result := categorizeJWTError(errors.New(tc.errMsg))
			assert.Equal(t, tc.wantCategory, result,
				"error %q must categorize as %q", tc.errMsg, tc.wantCategory)
		})
	}
}

// TestCategorizeJWTError_AllCategoriesDistinct proves all non-default category
// strings are unique — a metrics system receiving these must be able to
// distinguish each failure mode.
func TestCategorizeJWTError_AllCategoriesDistinct(t *testing.T) {
	t.Parallel()

	// One representative error per category.
	inputs := []string{
		"token is expired",
		"token is not valid yet",
		"signature is invalid",
		"token is malformed",
		"RSA key error",
		"unexpected token type",
		"not an access token",
	}

	seen := make(map[string]string)
	for _, errMsg := range inputs {
		category := categorizeJWTError(errors.New(errMsg))
		if prev, exists := seen[category]; exists {
			t.Errorf("category %q is produced by both %q and %q — categories must be distinct",
				category, prev, errMsg)
		}
		seen[category] = errMsg
	}
}

// TestCategorizeJWTError_DefaultIsNotEmpty proves the default branch returns
// a non-empty string — callers must always get a usable category, never "".
func TestCategorizeJWTError_DefaultIsNotEmpty(t *testing.T) {
	t.Parallel()

	result := categorizeJWTError(errors.New("completely unknown error"))
	assert.NotEmpty(t, result,
		"categorizeJWTError must never return an empty string — "+
			"metrics systems require a non-empty category on every error")
}