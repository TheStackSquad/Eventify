// backend/pkg/middleware/optional_auth_guest_test.go
//
// Tests for all guest-mode exit paths of OptionalAuth.
//
// Core contract: OptionalAuth NEVER aborts. Every path calls c.Next().
// A handler registered after OptionalAuth must always be reached —
// the only difference between paths is whether context keys are set.
//
// Guest paths covered:
//   1. OPTIONS request           → c.Next(), no token check, no context keys
//   2. No cookie                 → c.Next(), guest, no context keys
//   3. Empty cookie value        → c.Next(), guest, no context keys
//   4. ValidateAccessToken error → c.Next(), guest, no context keys
//   5. Nil claims (no error)     → c.Next(), guest, no context keys
//   6. Empty UserID in claims    → c.Next(), guest, no context keys
//   7. Invalid UUID in UserID    → c.Next(), guest, no context keys
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestOptionalAuth_Guest

package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	servicejwt "github.com/eventify/backend/pkg/services/jwt"
)

// ─── Router builder for OptionalAuth tests ───────────────────────────────────

// buildOptionalAuthRouter wires OptionalAuth and a probe handler that records
// whether it was reached and captures any context keys set by the middleware.
func buildOptionalAuthRouter(svc jwtValidator) (*gin.Engine, *map[string]interface{}) {
	captured := make(map[string]interface{})
	router := gin.New()
	router.Use(OptionalAuth(svc))
	router.GET("/test", func(c *gin.Context) {
		if v, exists := c.Get("user_id"); exists {
			captured["user_id"] = v
		}
		if v, exists := c.Get("user_id_string"); exists {
			captured["user_id_string"] = v
		}
		if v, exists := c.Get("authenticated"); exists {
			captured["authenticated"] = v
		}
		if v, exists := c.Get("token_type"); exists {
			captured["token_type"] = v
		}
		captured["handler_reached"] = true
		c.Status(http.StatusOK)
	})
	return router, &captured
}

// fireOptionalRequest fires a GET /test request, optionally setting a cookie.
func fireOptionalRequest(router *gin.Engine, cookieValue string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	if cookieValue != "" {
		req.AddCookie(&http.Cookie{Name: "access_token", Value: cookieValue})
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// assertGuestContext proves none of the four auth context keys were set,
// but the handler was still reached.
func assertGuestContext(t *testing.T, captured *map[string]interface{}, scenario string) {
	t.Helper()
	ctx := *captured

	assert.True(t, ctx["handler_reached"] == true,
		"%s: handler must always be reached — OptionalAuth must never abort", scenario)
	assert.NotContains(t, ctx, "user_id",
		"%s: user_id must not be set in guest mode", scenario)
	assert.NotContains(t, ctx, "user_id_string",
		"%s: user_id_string must not be set in guest mode", scenario)
	assert.NotContains(t, ctx, "authenticated",
		"%s: authenticated must not be set in guest mode", scenario)
	assert.NotContains(t, ctx, "token_type",
		"%s: token_type must not be set in guest mode", scenario)
}

// ─── Path 1: OPTIONS passthrough ─────────────────────────────────────────────

// TestOptionalAuth_Guest_OPTIONS proves OPTIONS requests skip token validation
// entirely and always reach the handler.
func TestOptionalAuth_Guest_OPTIONS(t *testing.T) {
	t.Parallel()

	// No validateAccessTokenFn set — any call panics.
	svc := &mockJWTValidator{}

	captured := make(map[string]interface{})
	router := gin.New()
	router.Use(OptionalAuth(svc))
	router.OPTIONS("/test", func(c *gin.Context) {
		captured["handler_reached"] = true
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusUnauthorized, w.Code,
		"OPTIONS must never be rejected by OptionalAuth")
	assert.True(t, captured["handler_reached"] == true,
		"OPTIONS handler must always be reached")
}

// ─── Path 2 & 3: No token / empty token ──────────────────────────────────────

// TestOptionalAuth_Guest_NoCookie proves that when no access_token cookie is
// present, the request continues as guest with no context keys set.
func TestOptionalAuth_Guest_NoCookie(t *testing.T) {
	t.Parallel()

	// No validateAccessTokenFn — any JWT call panics.
	svc := &mockJWTValidator{}
	router, captured := buildOptionalAuthRouter(svc)

	w := fireOptionalRequest(router, "") // no cookie

	assert.Equal(t, http.StatusOK, w.Code)
	assertGuestContext(t, captured, "no cookie")
}

// TestOptionalAuth_Guest_EmptyCookie proves an empty access_token cookie value
// is treated identically to no cookie — guest mode, no JWT call.
func TestOptionalAuth_Guest_EmptyCookie(t *testing.T) {
	t.Parallel()

	svc := &mockJWTValidator{}
	router, captured := buildOptionalAuthRouter(svc)

	// Set the cookie name but with empty value.
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: ""})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assertGuestContext(t, captured, "empty cookie")
}

// ─── Path 4: ValidateAccessToken error ───────────────────────────────────────

// TestOptionalAuth_Guest_ValidationError proves that when ValidateAccessToken
// returns an error, the request continues as guest — never aborted.
func TestOptionalAuth_Guest_ValidationError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		err  error
	}{
		{name: "expired token", err: errors.New("token is expired")},
		{name: "invalid signature", err: errors.New("signature is invalid")},
		{name: "malformed token", err: errors.New("token is malformed")},
		{name: "wrong token type", err: errors.New("not an access token")},
		{name: "generic error", err: errors.New("some internal jwt error")},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			svc := &mockJWTValidator{
				validateAccessTokenFn: func(_ string) (*servicejwt.Claims, error) {
					return nil, tc.err
				},
			}
			router, captured := buildOptionalAuthRouter(svc)
			w := fireOptionalRequest(router, "some.token.value")

			assert.Equal(t, http.StatusOK, w.Code,
				"%s: validation error must not abort — guest mode", tc.name)
			assertGuestContext(t, captured, tc.name)
		})
	}
}

// TestOptionalAuth_Guest_ValidationError_NeverAborts proves the never-abort
// contract explicitly — no matter what error ValidateAccessToken returns,
// the status is never 401 or 403.
func TestOptionalAuth_Guest_ValidationError_NeverAborts(t *testing.T) {
	t.Parallel()

	svc := &mockJWTValidator{
		validateAccessTokenFn: func(_ string) (*servicejwt.Claims, error) {
			return nil, errors.New("catastrophic jwt failure")
		},
	}
	router, _ := buildOptionalAuthRouter(svc)
	w := fireOptionalRequest(router, "token")

	assert.NotEqual(t, http.StatusUnauthorized, w.Code,
		"OptionalAuth must never return 401 — it is fail-open by design")
	assert.NotEqual(t, http.StatusForbidden, w.Code,
		"OptionalAuth must never return 403 — it is fail-open by design")
}

// ─── Path 5: Nil claims with no error ────────────────────────────────────────

// TestOptionalAuth_Guest_NilClaims proves that when ValidateAccessToken returns
// (nil, nil) — a JWT service bug — OptionalAuth degrades gracefully to guest
// rather than panicking.
func TestOptionalAuth_Guest_NilClaims(t *testing.T) {
	t.Parallel()

	svc := &mockJWTValidator{
		validateAccessTokenFn: func(_ string) (*servicejwt.Claims, error) {
			return nil, nil // the bug: nil claims, nil error
		},
	}
	router, captured := buildOptionalAuthRouter(svc)
	w := fireOptionalRequest(router, "some.token")

	assert.Equal(t, http.StatusOK, w.Code,
		"nil claims must not panic — OptionalAuth must degrade to guest")
	assertGuestContext(t, captured, "nil claims")
}

// ─── Path 6: Empty UserID in claims ──────────────────────────────────────────

// TestOptionalAuth_Guest_EmptyUserID proves that a token with an empty UserID
// field degrades to guest mode — not a panic, not an abort.
func TestOptionalAuth_Guest_EmptyUserID(t *testing.T) {
	t.Parallel()

	svc := &mockJWTValidator{
		validateAccessTokenFn: func(_ string) (*servicejwt.Claims, error) {
			return &servicejwt.Claims{
				UserID:    "", // empty — invalid
				TokenType: "access",
			}, nil
		},
	}
	router, captured := buildOptionalAuthRouter(svc)
	w := fireOptionalRequest(router, "some.token")

	assert.Equal(t, http.StatusOK, w.Code)
	assertGuestContext(t, captured, "empty UserID in claims")
}

// ─── Path 7: Invalid UUID in UserID ──────────────────────────────────────────

// TestOptionalAuth_Guest_InvalidUUID proves that a token whose UserID field
// is not a valid UUID degrades to guest mode.
func TestOptionalAuth_Guest_InvalidUUID(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		userID string
	}{
		{name: "non-UUID string", userID: "not-a-uuid"},
		{name: "truncated UUID", userID: "550e8400-e29b"},
		{name: "UUID with extra chars", userID: testUserID.String() + "-extra"},
		{name: "plain integer", userID: "12345"},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			svc := &mockJWTValidator{
				validateAccessTokenFn: func(_ string) (*servicejwt.Claims, error) {
					return &servicejwt.Claims{
						UserID:    tc.userID,
						TokenType: "access",
					}, nil
				},
			}
			router, captured := buildOptionalAuthRouter(svc)
			w := fireOptionalRequest(router, "some.token")

			assert.Equal(t, http.StatusOK, w.Code)
			assertGuestContext(t, captured, tc.name)
		})
	}
}

// ─── Header token is ignored ──────────────────────────────────────────────────

// TestOptionalAuth_Guest_HeaderTokenIgnored proves OptionalAuth only reads the
// access_token cookie — an Authorization header is not checked.
// This is a deliberate design difference from AuthMiddleware.
func TestOptionalAuth_Guest_HeaderTokenIgnored(t *testing.T) {
	t.Parallel()

	// No validateAccessTokenFn — any JWT call panics.
	// If OptionalAuth checked the header, this would panic.
	svc := &mockJWTValidator{}
	router, captured := buildOptionalAuthRouter(svc)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer some.header.token")
	// No cookie set.
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assertGuestContext(t, captured, "Authorization header must be ignored by OptionalAuth")
}