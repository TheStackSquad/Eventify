// backend/pkg/middleware/admin_auth_prerequisite_test.go
//
// Tests for Stage 1 & 2 of AdminMiddleware:
//
//   Stage 1 — Prerequisite check:
//   - "user_id_string" key absent from context → 403
//   - Proves AdminMiddleware must always run after AuthMiddleware
//
//   Stage 2 — Type + empty check:
//   - "user_id_string" present but wrong type → 403
//   - "user_id_string" present but empty string → 403
//   - Each produces a distinct message from Stage 1
//
// Design: AdminMiddleware reads from Gin context — it does not run AuthMiddleware
// itself. Tests use a context-seeding middleware to pre-populate (or not populate)
// "user_id_string" before AdminMiddleware runs. This isolates the prerequisite
// logic without coupling these tests to AuthMiddleware's behaviour.
//
// IsUserAdmin is never called in any test in this file — leaving isUserAdminFn
// nil means any accidental DB call panics immediately.
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestAdminMiddleware_Prerequisite

package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Router builder for AdminMiddleware tests ─────────────────────────────────

// buildAdminRouter builds a Gin engine that:
//  1. Runs a context-seeding middleware (sets whatever the test needs in context)
//  2. Runs AdminMiddleware under test
//  3. Has a probe handler at GET /admin that returns 200 if reached
//
// seedFn is called before AdminMiddleware — it pre-populates the Gin context
// exactly as AuthMiddleware would in production.
func buildAdminRouter(repo *mockAuthRepository, seedFn func(c *gin.Context)) *gin.Engine {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if seedFn != nil {
			seedFn(c)
		}
		c.Next()
	})
	router.Use(AdminMiddleware(repo))
	router.GET("/admin", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return router
}

// fireAdminRequest fires a GET /admin request through router and returns the recorder.
func fireAdminRequest(router *gin.Engine) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// ─── Stage 1: user_id_string key absent ──────────────────────────────────────

// TestAdminMiddleware_Prerequisite_KeyAbsent proves that when AuthMiddleware has
// not run (context has no "user_id_string"), AdminMiddleware returns 403 and
// never touches the DB.
func TestAdminMiddleware_Prerequisite_KeyAbsent(t *testing.T) {
	t.Parallel()

	// No isUserAdminFn set — any DB call panics loudly.
	repo := &mockAuthRepository{}

	// seedFn is nil — nothing is set in context.
	router := buildAdminRouter(repo, nil)
	w := fireAdminRequest(router)

	assert.Equal(t, http.StatusForbidden, w.Code,
		"missing user_id_string in context must yield 403 — "+
			"AdminMiddleware must always run after AuthMiddleware")

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "Access denied: Authentication failure.", body["message"])
}

// ─── Stage 2: user_id_string present but invalid ──────────────────────────────

// TestAdminMiddleware_Prerequisite_WrongType proves that a non-string value
// stored under "user_id_string" is caught and rejected with 403.
//
// This can happen if a future middleware stores a different type under the same
// key, or if AuthMiddleware is modified to store uuid.UUID instead of string.
func TestAdminMiddleware_Prerequisite_WrongType(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value interface{}
	}{
		{
			name:  "uuid.UUID stored instead of string",
			value: uuid.MustParse("550e8400-e29b-41d4-a716-446655440000"),
		},
		{
			name:  "integer stored instead of string",
			value: 12345,
		},
		{
			name:  "boolean stored instead of string",
			value: true,
		},
		{
			name:  "nil stored instead of string",
			value: nil,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			// No isUserAdminFn set — any DB call panics loudly.
			repo := &mockAuthRepository{}

			router := buildAdminRouter(repo, func(c *gin.Context) {
				c.Set("user_id_string", tc.value)
			})
			w := fireAdminRequest(router)

			assert.Equal(t, http.StatusForbidden, w.Code,
				"wrong type for user_id_string must yield 403 — got type %T", tc.value)

			var body map[string]interface{}
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
			assert.Equal(t, "Access denied: Invalid user identifier.", body["message"],
				"wrong-type message must be distinct from missing-key message")
		})
	}
}

// TestAdminMiddleware_Prerequisite_EmptyString proves that an empty string stored
// under "user_id_string" is caught and rejected with 403.
//
// An empty string passes the type assertion but fails the empty check — it must
// produce the same "Invalid user identifier" message as the wrong-type case,
// not fall through to UUID parsing where it would produce a different error.
func TestAdminMiddleware_Prerequisite_EmptyString(t *testing.T) {
	t.Parallel()

	repo := &mockAuthRepository{}

	router := buildAdminRouter(repo, func(c *gin.Context) {
		c.Set("user_id_string", "")
	})
	w := fireAdminRequest(router)

	assert.Equal(t, http.StatusForbidden, w.Code,
		"empty user_id_string must yield 403 before reaching UUID parsing")

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "Access denied: Invalid user identifier.", body["message"])
}

// ─── Message distinctness contract ───────────────────────────────────────────

// TestAdminMiddleware_Prerequisite_DistinctMessages proves that the two failure
// modes produce different messages — a client or log aggregator can distinguish
// "AuthMiddleware didn't run" from "AuthMiddleware ran but set bad data".
func TestAdminMiddleware_Prerequisite_DistinctMessages(t *testing.T) {
	t.Parallel()

	repo := &mockAuthRepository{}

	// Case A: key absent
	routerA := buildAdminRouter(repo, nil)
	wA := fireAdminRequest(routerA)

	// Case B: key present but wrong type
	routerB := buildAdminRouter(repo, func(c *gin.Context) {
		c.Set("user_id_string", 999)
	})
	wB := fireAdminRequest(routerB)

	var bodyA, bodyB map[string]interface{}
	require.NoError(t, json.Unmarshal(wA.Body.Bytes(), &bodyA))
	require.NoError(t, json.Unmarshal(wB.Body.Bytes(), &bodyB))

	assert.NotEqual(t, bodyA["message"], bodyB["message"],
		"missing-key and wrong-type failures must produce distinct messages — "+
			"merging them would hide whether AuthMiddleware ran at all")
}

// ─── DB is never called in prerequisite failures ──────────────────────────────

// TestAdminMiddleware_Prerequisite_NoDBCall proves IsUserAdmin is never reached
// when prerequisite checks fail. Covered implicitly by leaving isUserAdminFn nil
// in every test above — any call panics. This test makes that contract explicit.
func TestAdminMiddleware_Prerequisite_NoDBCall(t *testing.T) {
	t.Parallel()

	dbCalled := false
	repo := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			dbCalled = true
			return true, nil
		},
	}

	// No user_id_string in context.
	router := buildAdminRouter(repo, nil)
	w := fireAdminRequest(router)

	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.False(t, dbCalled,
		"IsUserAdmin must not be called when prerequisite checks fail — "+
			"no point hitting the DB if the auth context is missing")
}