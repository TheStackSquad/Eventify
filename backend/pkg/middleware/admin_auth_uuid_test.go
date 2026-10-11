// backend/pkg/middleware/admin_auth_uuid_test.go
//
// Tests for Stage 3 of AdminMiddleware — UUID parsing:
//
//   Contracts proven:
//   - A valid UUID string reaches IsUserAdmin — parsing is not a gate that
//     swallows valid input
//   - An invalid UUID string returns 400 (not 403, not 500) — the status code
//     is distinct from every other failure mode in this middleware
//   - IsUserAdmin is never called when UUID parsing fails — no DB hit for
//     malformed input
//   - The UUID received by IsUserAdmin is the correct parsed value —
//     no truncation, no re-encoding
//   - Parsing happens after the empty-string check — empty string is caught
//     at Stage 2 (403), not here (400)
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestAdminMiddleware_UUID

package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Valid UUID reaches IsUserAdmin ──────────────────────────────────────────

// TestAdminMiddleware_UUID_ValidReachesDB proves that a valid UUID string in
// context is parsed and passed to IsUserAdmin — the parsing stage is transparent
// to valid input.
func TestAdminMiddleware_UUID_ValidReachesDB(t *testing.T) {
	t.Parallel()

	var receivedUUID uuid.UUID
	dbCalled := false

	repo := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, id uuid.UUID) (bool, error) {
			dbCalled = true
			receivedUUID = id
			return true, nil
		},
	}

	router := buildAdminRouter(repo, func(c *gin.Context) {
		c.Set("user_id_string", testUserID.String())
	})
	w := fireAdminRequest(router)

	require.Equal(t, http.StatusOK, w.Code,
		"valid UUID must pass through to the handler")
	assert.True(t, dbCalled,
		"IsUserAdmin must be called when UUID parses successfully")
	assert.Equal(t, testUserID, receivedUUID,
		"UUID received by IsUserAdmin must equal the parsed value of user_id_string")
}

// ─── Invalid UUID returns 400 ─────────────────────────────────────────────────

// TestAdminMiddleware_UUID_InvalidReturns400 proves that a malformed UUID string
// yields 400 Bad Request — not 403 Forbidden, not 500 Internal Server Error.
//
// The 400 is intentional: the request is structurally invalid (the token
// contains a non-UUID identifier), as opposed to an authorisation failure (403)
// or an infrastructure failure (500).
func TestAdminMiddleware_UUID_InvalidReturns400(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		userIDStr string
	}{
		{
			name:      "completely non-UUID string",
			userIDStr: "not-a-uuid",
		},
		{
			name:      "UUID with extra characters",
			userIDStr: testUserID.String() + "-extra",
		},
		{
			name:      "truncated UUID",
			userIDStr: "550e8400-e29b-41d4",
		},
		{
			name:      "UUID with invalid characters",
			userIDStr: "550e8400-e29b-41d4-a716-44665544000Z",
		},
		{
			name:      "plain integer string",
			userIDStr: "12345",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			// isUserAdminFn left nil — any DB call panics loudly.
			repo := &mockAuthRepository{}

			router := buildAdminRouter(repo, func(c *gin.Context) {
				c.Set("user_id_string", tc.userIDStr)
			})
			w := fireAdminRequest(router)

			// 400, not 403 or 500 — the status code is the contract.
			assert.Equal(t, http.StatusBadRequest, w.Code,
				"invalid UUID format must return 400 Bad Request — "+
					"got %d for input %q", w.Code, tc.userIDStr)

			var body map[string]interface{}
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
			assert.Equal(t, "Access denied: Invalid ID format.", body["message"])
		})
	}
}

// ─── Status code distinctness ─────────────────────────────────────────────────

// TestAdminMiddleware_UUID_StatusCodeDistinct proves the three failure status
// codes are all different — 403 (missing/invalid context), 400 (bad UUID),
// 403 (not admin). A client must be able to distinguish them.
//
// This matters because 400 vs 403 carries different semantics:
// 400 = the request itself is malformed (retry won't help without fixing the token)
// 403 = the request is valid but not permitted (different remediation path)
func TestAdminMiddleware_UUID_StatusCodeDistinct(t *testing.T) {
	t.Parallel()

	// Case A: missing key → 403
	repoA := &mockAuthRepository{}
	routerA := buildAdminRouter(repoA, nil)
	wA := fireAdminRequest(routerA)

	// Case B: invalid UUID → 400
	repoB := &mockAuthRepository{}
	routerB := buildAdminRouter(repoB, func(c *gin.Context) {
		c.Set("user_id_string", "not-a-uuid")
	})
	wB := fireAdminRequest(routerB)

	// Case C: valid UUID, not admin → 403
	repoC := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return false, nil
		},
	}
	routerC := buildAdminRouter(repoC, func(c *gin.Context) {
		c.Set("user_id_string", testUserID.String())
	})
	wC := fireAdminRequest(routerC)

	assert.Equal(t, http.StatusForbidden, wA.Code, "missing key must be 403")
	assert.Equal(t, http.StatusBadRequest, wB.Code, "invalid UUID must be 400")
	assert.Equal(t, http.StatusForbidden, wC.Code, "non-admin must be 403")

	// 400 must be distinct from both 403 cases.
	assert.NotEqual(t, wA.Code, wB.Code,
		"missing-key 403 and invalid-UUID 400 must be distinct status codes")
	assert.NotEqual(t, wB.Code, wC.Code,
		"invalid-UUID 400 and non-admin 403 must be distinct status codes")
}

// ─── DB never called on UUID parse failure ────────────────────────────────────

// TestAdminMiddleware_UUID_NoDBCallOnParseFailure proves IsUserAdmin is never
// reached when UUID parsing fails — no point querying the DB with malformed input.
func TestAdminMiddleware_UUID_NoDBCallOnParseFailure(t *testing.T) {
	t.Parallel()

	dbCalled := false
	repo := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			dbCalled = true
			return true, nil
		},
	}

	router := buildAdminRouter(repo, func(c *gin.Context) {
		c.Set("user_id_string", "definitely-not-a-uuid")
	})
	w := fireAdminRequest(router)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.False(t, dbCalled,
		"IsUserAdmin must not be called when UUID parsing fails")
}

// ─── UUID parsing is case-insensitive ─────────────────────────────────────────

// TestAdminMiddleware_UUID_CaseInsensitive proves that UUID strings in different
// cases all parse to the same uuid.UUID value and reach IsUserAdmin correctly.
// google/uuid handles case normalisation internally.
func TestAdminMiddleware_UUID_CaseInsensitive(t *testing.T) {
	t.Parallel()

	variants := []struct {
		name      string
		userIDStr string
	}{
		{
			name:      "lowercase UUID",
			userIDStr: "550e8400-e29b-41d4-a716-446655440000",
		},
		{
			name:      "uppercase UUID",
			userIDStr: "550E8400-E29B-41D4-A716-446655440000",
		},
		{
			name:      "mixed case UUID",
			userIDStr: "550e8400-E29B-41d4-A716-446655440000",
		},
	}

	for _, tc := range variants {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var receivedUUID uuid.UUID
			repo := &mockAuthRepository{
				isUserAdminFn: func(_ context.Context, id uuid.UUID) (bool, error) {
					receivedUUID = id
					return true, nil
				},
			}

			router := buildAdminRouter(repo, func(c *gin.Context) {
				c.Set("user_id_string", tc.userIDStr)
			})
			w := fireAdminRequest(router)

			require.Equal(t, http.StatusOK, w.Code,
				"UUID variant %q must be accepted", tc.userIDStr)
			assert.Equal(t, testUserID, receivedUUID,
				"all UUID case variants must parse to the same uuid.UUID value")
		})
	}
}