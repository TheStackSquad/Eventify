// backend/pkg/middleware/authentication_context_test.go
//
// Tests for Stage 5 of AuthMiddleware — context injection:
//
//   What gets set:
//   - "user_id"        → uuid.UUID parsed from claims.UserID
//   - "user_id_string" → claims.UserID as the original string
//
//   Contracts proven:
//   - Both keys are present after a successful auth
//   - user_id is the correct Go type (uuid.UUID, not string)
//   - user_id_string is the exact string from claims — no transformation
//   - user_id and user_id_string are consistent with each other
//   - Neither key is set when the request is rejected (401 path)
//   - UUID parsing handles valid UUIDs of different canonical forms
//   - An unparseable UserID in claims is rejected with a clean 401 —
//     the middleware explicitly guards against this rather than silently
//     injecting uuid.Nil into the context
//
// Why context injection matters:
//   Every downstream handler calls c.MustGet("user_id").(uuid.UUID).
//   If the middleware sets the wrong type, every handler panics at runtime
//   under load — not at startup, not in unit tests that don't check types.
//   These tests are the only place that catches the type contract.
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestAuthMiddleware_Context

package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	servicejwt "github.com/eventify/backend/pkg/services/jwt"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Happy path: both keys present and correctly typed ───────────────────────

// TestAuthMiddleware_Context_KeysPresent proves that after a successful auth,
// both context keys exist and carry the correct Go types.
func TestAuthMiddleware_Context_KeysPresent(t *testing.T) {
	t.Parallel()

	svc := validSvc()
	router, capturedCtx := newTestRouter(svc)

	w := makeRequest(t, router, requestOpts{bearerToken: "valid.token"})
	require.Equal(t, http.StatusOK, w.Code)

	ctx := *capturedCtx

	// ── Both keys must exist ──────────────────────────────────────────────────
	_, userIDExists := ctx["user_id"]
	_, userIDStringExists := ctx["user_id_string"]

	assert.True(t, userIDExists,
		`"user_id" must be set in the Gin context after successful auth — `+
			`downstream handlers call c.MustGet("user_id") and panic if it is absent`)
	assert.True(t, userIDStringExists,
		`"user_id_string" must be set in the Gin context after successful auth`)
}

// TestAuthMiddleware_Context_CorrectTypes proves the exact Go types of both
// context values. This is the test that prevents runtime panics in handlers
// that do c.MustGet("user_id").(uuid.UUID).
func TestAuthMiddleware_Context_CorrectTypes(t *testing.T) {
	t.Parallel()

	svc := validSvc()
	router, capturedCtx := newTestRouter(svc)

	w := makeRequest(t, router, requestOpts{bearerToken: "valid.token"})
	require.Equal(t, http.StatusOK, w.Code)

	ctx := *capturedCtx

	// ── user_id must be uuid.UUID, not string ─────────────────────────────────
	userIDVal, exists := ctx["user_id"]
	require.True(t, exists, `"user_id" key must exist`)

	_, isUUID := userIDVal.(uuid.UUID)
	assert.True(t, isUUID,
		`"user_id" must be uuid.UUID — got %T. `+
			`Handlers call c.MustGet("user_id").(uuid.UUID); wrong type = runtime panic`,
		userIDVal,
	)

	// ── user_id_string must be string ─────────────────────────────────────────
	userIDStringVal, exists := ctx["user_id_string"]
	require.True(t, exists, `"user_id_string" key must exist`)

	_, isString := userIDStringVal.(string)
	assert.True(t, isString,
		`"user_id_string" must be a string — got %T`,
		userIDStringVal,
	)
}

// ─── Values are correct ───────────────────────────────────────────────────────

// TestAuthMiddleware_Context_CorrectValues proves that the injected values
// match what was in the claims — no transformation, no truncation.
func TestAuthMiddleware_Context_CorrectValues(t *testing.T) {
	t.Parallel()

	svc := validSvc() // fakeClaims() uses testUserID
	router, capturedCtx := newTestRouter(svc)

	w := makeRequest(t, router, requestOpts{bearerToken: "valid.token"})
	require.Equal(t, http.StatusOK, w.Code)

	ctx := *capturedCtx

	// ── user_id must equal testUserID ─────────────────────────────────────────
	userID, ok := ctx["user_id"].(uuid.UUID)
	require.True(t, ok, "user_id must be uuid.UUID")
	assert.Equal(t, testUserID, userID,
		"user_id in context must equal the UUID parsed from claims.UserID")

	// ── user_id_string must equal the original string from claims ─────────────
	userIDString, ok := ctx["user_id_string"].(string)
	require.True(t, ok, "user_id_string must be string")
	assert.Equal(t, testUserID.String(), userIDString,
		"user_id_string must be the exact string from claims.UserID — no transformation")
}

// TestAuthMiddleware_Context_Consistency proves that user_id and user_id_string
// refer to the same identity — uuid.UUID.String() of user_id equals user_id_string.
//
// If they diverge (e.g. due to case normalisation, hyphen removal, or a
// different UUID being parsed), authorisation checks that compare them will
// silently fail for some users.
func TestAuthMiddleware_Context_Consistency(t *testing.T) {
	t.Parallel()

	svc := validSvc()
	router, capturedCtx := newTestRouter(svc)

	w := makeRequest(t, router, requestOpts{bearerToken: "valid.token"})
	require.Equal(t, http.StatusOK, w.Code)

	ctx := *capturedCtx

	userID, ok := ctx["user_id"].(uuid.UUID)
	require.True(t, ok)

	userIDString, ok := ctx["user_id_string"].(string)
	require.True(t, ok)

	assert.Equal(t, userID.String(), userIDString,
		"user_id.String() must equal user_id_string — they must refer to the same identity. "+
			"Divergence breaks any downstream code that compares the two representations.")
}

// ─── UUID parsing variants ────────────────────────────────────────────────────

// TestAuthMiddleware_Context_UUIDVariants proves that uuid.Parse correctly
// handles the different canonical forms a UserID string might arrive in.
// All standard UUID formats must parse to the same uuid.UUID value.
func TestAuthMiddleware_Context_UUIDVariants(t *testing.T) {
	t.Parallel()

	// All of these are the same UUID in different textual representations.
	const canonical = "550e8400-e29b-41d4-a716-446655440000"
	expectedUUID := uuid.MustParse(canonical)

	tests := []struct {
		name      string
		userIDStr string
	}{
		{
			name:      "standard hyphenated UUID",
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

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			svc := &mockAuthService{
				parseAccessTokenFn: func(_ context.Context, _ string) (*servicejwt.Claims, error) {
					return &servicejwt.Claims{
						UserID:    tc.userIDStr,
						TokenType: "access",
					}, nil
				},
				isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) {
					return false, nil
				},
			}

			capturedCtx := make(map[string]interface{})
			router := buildCapturingRouter(svc, capturedCtx)

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			req.Header.Set("Authorization", "Bearer valid.token")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			require.Equal(t, http.StatusOK, w.Code)

			userID, ok := capturedCtx["user_id"].(uuid.UUID)
			require.True(t, ok, "user_id must be uuid.UUID")
			assert.Equal(t, expectedUUID, userID,
				"UUID variant %q must parse to the same uuid.UUID as the canonical form",
				tc.userIDStr,
			)
		})
	}
}

// ─── Unparseable UserID in claims ─────────────────────────────────────────────

// TestAuthMiddleware_Context_UnparseableUserID proves that the middleware
// explicitly rejects tokens whose UserID is not a parseable UUID.
//
// Fixed middleware code:
//
//	userUUID, err := uuid.Parse(claims.UserID)
//	if err != nil {                          // ← explicit rejection
//	    utils.LogError(...)
//	    c.JSON(401, ...)
//	    c.Abort()
//	    return
//	}
//
// Previously: uuid.Parse error was silently discarded (_), uuid.Nil was injected
// into context, and the request succeeded — causing downstream DB misses instead
// of a clean 401.
func TestAuthMiddleware_Context_UnparseableUserID(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		userIDStr string
	}{
		{
			name:      "completely non-UUID string",
			userIDStr: "not-a-uuid-at-all",
		},
		{
			name:      "empty string UserID",
			userIDStr: "",
		},
		{
			// Note: "UUID missing hyphens" is intentionally absent — google/uuid
			// accepts 32-char unhyphenated hex strings as valid UUIDs.
			name:      "UUID with extra characters",
			userIDStr: "550e8400-e29b-41d4-a716-446655440000-extra",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			svc := &mockAuthService{
				parseAccessTokenFn: func(_ context.Context, _ string) (*servicejwt.Claims, error) {
					return &servicejwt.Claims{
						UserID:    tc.userIDStr,
						TokenType: "access",
					}, nil
				},
				isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) {
					return false, nil
				},
			}

			capturedCtx := make(map[string]interface{})
			router := buildCapturingRouter(svc, capturedCtx)

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			req.Header.Set("Authorization", "Bearer valid.token")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Now returns a clean 401 — no silent uuid.Nil injection.
			assert.Equal(t, http.StatusUnauthorized, w.Code,
				"unparseable UserID must be rejected with a clean 401 — not silently injected as uuid.Nil")

			// Context keys must be absent — the request was rejected.
			_, userIDSet := capturedCtx["user_id"]
			assert.False(t, userIDSet,
				"user_id must not be set in context when UserID is unparseable")
		})
	}
}

// ─── Context not set on rejected requests ────────────────────────────────────

// TestAuthMiddleware_Context_NotSetOnRejection proves that when the middleware
// aborts a request, it does NOT set user_id or user_id_string on the context.
//
// This matters because a handler that checks for context keys rather than
// relying on the middleware to gate access would find them absent — providing
// a second line of defence.
func TestAuthMiddleware_Context_NotSetOnRejection(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		svc  *mockAuthService
		opts requestOpts
	}{
		{
			name: "no token — context keys must be absent",
			svc:  &mockAuthService{},
			opts: requestOpts{},
		},
		{
			name: "invalid token — context keys must be absent",
			svc: &mockAuthService{
				parseAccessTokenFn: func(_ context.Context, _ string) (*servicejwt.Claims, error) {
					return nil, assert.AnError
				},
				isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) {
					return false, nil
				},
			},
			opts: requestOpts{bearerToken: "bad.token"},
		},
		{
			name: "blacklisted token — context keys must be absent",
			svc: &mockAuthService{
				parseAccessTokenFn: func(_ context.Context, _ string) (*servicejwt.Claims, error) {
					return fakeClaims(), nil
				},
				isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) {
					return true, nil
				},
			},
			opts: requestOpts{bearerToken: "revoked.token"},
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			capturedCtx := make(map[string]interface{})
			router := buildCapturingRouter(tc.svc, capturedCtx)

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			if tc.opts.bearerToken != "" {
				req.Header.Set("Authorization", "Bearer "+tc.opts.bearerToken)
			}
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusUnauthorized, w.Code)

			_, userIDSet := capturedCtx["user_id"]
			_, userIDStringSet := capturedCtx["user_id_string"]

			assert.False(t, userIDSet,
				`"user_id" must not be set in context when request is rejected`)
			assert.False(t, userIDStringSet,
				`"user_id_string" must not be set in context when request is rejected`)
		})
	}
}

// ─── Helpers local to this file ───────────────────────────────────────────────

// buildCapturingRouter builds a Gin router that writes Gin context values into
// capturedCtx after the middleware runs. It is used in tests that need fine
// control over the capture map (e.g. per-subtest isolation).
//
// newTestRouter in the helpers file uses a shared capturedCtx per router
// instance. buildCapturingRouter lets each sub-test own its own map so that
// parallel sub-tests do not race on a shared map.
func buildCapturingRouter(svc *mockAuthService, capturedCtx map[string]interface{}) *gin.Engine {
	router := gin.New()
	router.Use(AuthMiddleware(svc))
	router.GET("/test", func(c *gin.Context) {
		if val, exists := c.Get("user_id"); exists {
			capturedCtx["user_id"] = val
		}
		if val, exists := c.Get("user_id_string"); exists {
			capturedCtx["user_id_string"] = val
		}
		c.Status(http.StatusOK)
	})
	return router
}