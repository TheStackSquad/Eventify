// backend/pkg/middleware/guest_middleware_test.go
//
// Tests for GuestMiddleware — assigns and tracks a guest session ID via cookie.
//
// Three exit paths, all call c.Next():
//   Path 1 — Existing guest_id cookie → set in context, no new cookie written
//   Path 2 — access_token present, no guest_id → dead code branch, falls to Path 3
//   Path 3 — No guest_id cookie → generate UUID, write cookie, set context
//
// Contracts proven:
//   - Existing guest_id is preserved — never overwritten
//   - New guest_id is a valid UUID
//   - Cookie attributes: 1-year max-age, HttpOnly=true, Secure=isProd
//   - Each request without a cookie gets a unique ID
//   - Handler is always reached — middleware never aborts
//   - Dead code: access_token cookie does not suppress guest ID generation
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestGuestMiddleware

package middleware

import (
	"net/http"
	"net/http/httptest"
	//"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Router builder ───────────────────────────────────────────────────────────

// buildGuestRouter wires GuestMiddleware and a probe handler that captures
// the guest_id from context.
func buildGuestRouter() (*gin.Engine, *string) {
	capturedGuestID := ""
	router := gin.New()
	router.Use(GuestMiddleware())
	router.GET("/test", func(c *gin.Context) {
		if v, exists := c.Get("guest_id"); exists {
			if s, ok := v.(string); ok {
				capturedGuestID = s
			}
		}
		c.Status(http.StatusOK)
	})
	return router, &capturedGuestID
}

// fireGuestRequest fires a GET /test request with optional cookies.
func fireGuestRequest(router *gin.Engine, cookies map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	for name, value := range cookies {
		req.AddCookie(&http.Cookie{Name: name, Value: value})
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// getResponseCookie finds a named cookie in the response Set-Cookie headers.
func getResponseCookie(w *httptest.ResponseRecorder, name string) *http.Cookie {
	resp := &http.Response{Header: w.Header()}
	for _, cookie := range resp.Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}
	return nil
}

// ─── Path 1: Existing guest_id cookie ────────────────────────────────────────

// TestGuestMiddleware_ExistingCookie_PreservedInContext proves that when a
// guest_id cookie is already present, its value is set in context unchanged.
func TestGuestMiddleware_ExistingCookie_PreservedInContext(t *testing.T) {
	t.Parallel()

	const existingGuestID = "existing-guest-session-id"

	router, captured := buildGuestRouter()
	w := fireGuestRequest(router, map[string]string{"guest_id": existingGuestID})

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, existingGuestID, *captured,
		"existing guest_id cookie must be set in context verbatim — not regenerated")
}

// TestGuestMiddleware_ExistingCookie_NoNewCookieWritten proves that when a
// guest_id already exists, no new Set-Cookie header is written — the existing
// cookie's expiry is not reset.
func TestGuestMiddleware_ExistingCookie_NoNewCookieWritten(t *testing.T) {
	t.Parallel()

	router, _ := buildGuestRouter()
	w := fireGuestRequest(router, map[string]string{"guest_id": "existing-id"})

	cookie := getResponseCookie(w, "guest_id")
	assert.Nil(t, cookie,
		"no Set-Cookie header must be written when guest_id already exists — "+
			"existing cookie expiry must not be reset on every request")
}

// TestGuestMiddleware_ExistingCookie_HandlerReached proves c.Next() is called
// on the existing-cookie path.
func TestGuestMiddleware_ExistingCookie_HandlerReached(t *testing.T) {
	t.Parallel()

	handlerReached := false
	router := gin.New()
	router.Use(GuestMiddleware())
	router.GET("/test", func(c *gin.Context) {
		handlerReached = true
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "guest_id", Value: "some-id"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, handlerReached,
		"handler must be reached when guest_id cookie already exists")
}

// ─── Path 3: New guest ID generation ─────────────────────────────────────────

// TestGuestMiddleware_NewID_SetInContext proves that when no guest_id cookie
// exists, a new ID is generated and stored in context.
func TestGuestMiddleware_NewID_SetInContext(t *testing.T) {
	t.Parallel()

	router, captured := buildGuestRouter()
	w := fireGuestRequest(router, nil)

	require.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, *captured,
		"guest_id must be set in context when no cookie exists")
}

// TestGuestMiddleware_NewID_IsValidUUID proves the generated guest ID is a
// valid UUID — handlers and DB queries depend on this format.
func TestGuestMiddleware_NewID_IsValidUUID(t *testing.T) {
	t.Parallel()

	router, captured := buildGuestRouter()
	w := fireGuestRequest(router, nil)

	require.Equal(t, http.StatusOK, w.Code)
	require.NotEmpty(t, *captured)

	_, err := uuid.Parse(*captured)
	assert.NoError(t, err,
		"generated guest_id %q must be a valid UUID — "+
			"handlers pass it directly to DB queries", *captured)
}

// TestGuestMiddleware_NewID_CookieWritten proves a Set-Cookie header is written
// when no guest_id exists.
func TestGuestMiddleware_NewID_CookieWritten(t *testing.T) {
	t.Parallel()

	router, _ := buildGuestRouter()
	w := fireGuestRequest(router, nil)

	cookie := getResponseCookie(w, "guest_id")
	require.NotNil(t, cookie,
		"Set-Cookie for guest_id must be written when no cookie exists")
	assert.NotEmpty(t, cookie.Value,
		"cookie value must not be empty")
}

// TestGuestMiddleware_NewID_CookieMatchesContext proves the cookie value written
// in Set-Cookie matches the value set in context — handlers reading from context
// and handlers reading from cookie must get the same ID.
func TestGuestMiddleware_NewID_CookieMatchesContext(t *testing.T) {
	t.Parallel()

	router, captured := buildGuestRouter()
	w := fireGuestRequest(router, nil)

	cookie := getResponseCookie(w, "guest_id")
	require.NotNil(t, cookie)
	require.NotEmpty(t, *captured)

	assert.Equal(t, cookie.Value, *captured,
		"Set-Cookie value must match the guest_id set in context — "+
			"handlers using c.Get('guest_id') and c.Cookie('guest_id') must agree")
}

// TestGuestMiddleware_NewID_CookieMaxAge proves the cookie has a 1-year max-age.
func TestGuestMiddleware_NewID_CookieMaxAge(t *testing.T) {
	t.Parallel()

	router, _ := buildGuestRouter()
	w := fireGuestRequest(router, nil)

	cookie := getResponseCookie(w, "guest_id")
	require.NotNil(t, cookie)

	const oneYearSeconds = 3600 * 24 * 365
	assert.Equal(t, oneYearSeconds, cookie.MaxAge,
		"guest_id cookie must have a 1-year max-age — "+
			"shorter expiry would disrupt long-term guest tracking")
}

// TestGuestMiddleware_NewID_CookieHttpOnly proves the cookie has HttpOnly=true —
// JavaScript cannot read the guest session ID.
func TestGuestMiddleware_NewID_CookieHttpOnly(t *testing.T) {
	t.Parallel()

	router, _ := buildGuestRouter()
	w := fireGuestRequest(router, nil)

	cookie := getResponseCookie(w, "guest_id")
	require.NotNil(t, cookie)

	assert.True(t, cookie.HttpOnly,
		"guest_id cookie must be HttpOnly — prevents XSS access to session ID")
}

// TestGuestMiddleware_NewID_CookieNotSecureOutsideProd proves Secure=false when
// NODE_ENV is not "production" — allows HTTP in development.
func TestGuestMiddleware_NewID_CookieNotSecureOutsideProd(t *testing.T) {
	// Cannot use t.Parallel() — t.Setenv modifies process-wide environment.
	t.Setenv("NODE_ENV", "development")

	router, _ := buildGuestRouter()
	w := fireGuestRequest(router, nil)

	cookie := getResponseCookie(w, "guest_id")
	require.NotNil(t, cookie)

	assert.False(t, cookie.Secure,
		"guest_id cookie must not be Secure outside production — "+
			"Secure=true on HTTP would block the cookie entirely")
}

// TestGuestMiddleware_NewID_CookieSecureInProd proves Secure=true when
// NODE_ENV == "production".
func TestGuestMiddleware_NewID_CookieSecureInProd(t *testing.T) {
	// Cannot use t.Parallel() — t.Setenv modifies process-wide environment.
	t.Setenv("NODE_ENV", "production")

	router, _ := buildGuestRouter()
	w := fireGuestRequest(router, nil)

	cookie := getResponseCookie(w, "guest_id")
	require.NotNil(t, cookie)

	assert.True(t, cookie.Secure,
		"guest_id cookie must be Secure in production — "+
			"protects session ID from network interception")
}

// TestGuestMiddleware_NewID_CookiePath proves the cookie path is "/" — the
// guest ID must be sent on every request, not just a specific path.
func TestGuestMiddleware_NewID_CookiePath(t *testing.T) {
	t.Parallel()

	router, _ := buildGuestRouter()
	w := fireGuestRequest(router, nil)

	cookie := getResponseCookie(w, "guest_id")
	require.NotNil(t, cookie)

	assert.Equal(t, "/", cookie.Path,
		"guest_id cookie path must be '/' — restricting it would break "+
			"guest tracking on non-root routes")
}

// ─── Uniqueness ───────────────────────────────────────────────────────────────

// TestGuestMiddleware_UniqueIDsPerRequest proves two requests without a guest_id
// cookie each receive a different UUID — no shared state between requests.
func TestGuestMiddleware_UniqueIDsPerRequest(t *testing.T) {
	t.Parallel()

	router, _ := buildGuestRouter()

	w1 := fireGuestRequest(router, nil)
	w2 := fireGuestRequest(router, nil)

	cookie1 := getResponseCookie(w1, "guest_id")
	cookie2 := getResponseCookie(w2, "guest_id")

	require.NotNil(t, cookie1)
	require.NotNil(t, cookie2)

	assert.NotEqual(t, cookie1.Value, cookie2.Value,
		"each request without a guest_id must get a unique UUID — "+
			"shared IDs would merge distinct guest sessions")
}

// ─── Dead code documentation ──────────────────────────────────────────────────

// TestGuestMiddleware_AccessTokenPresent_StillGeneratesGuestID documents the
// dead code in GuestMiddleware: the if-block checking for access_token is empty,
// so its presence has no effect — a new guest ID is always generated when
// guest_id cookie is absent, regardless of whether access_token is present.
//
// The comment in the source suggests the intent was to skip guest ID generation
// for authenticated users, but the implementation does not do this.
// This test documents current behaviour — if the intent is ever implemented,
// this test should be updated accordingly.
func TestGuestMiddleware_AccessTokenPresent_StillGeneratesGuestID(t *testing.T) {
	t.Parallel()

	router, captured := buildGuestRouter()

	// access_token present, but no guest_id.
	w := fireGuestRequest(router, map[string]string{
		"access_token": "some.valid.looking.token",
	})

	require.Equal(t, http.StatusOK, w.Code)

	// CURRENT BEHAVIOUR: guest_id is still generated despite access_token.
	// The if-block checking access_token in GuestMiddleware is empty — it
	// does nothing and execution falls through to guest ID generation.
	assert.NotEmpty(t, *captured,
		"CURRENT BEHAVIOUR (dead code): guest_id is generated even when "+
			"access_token is present — the access_token check is an empty if-block")

	cookie := getResponseCookie(w, "guest_id")
	assert.NotNil(t, cookie,
		"Set-Cookie for guest_id must still be written when access_token is present")
}

// ─── Handler always reached ───────────────────────────────────────────────────

// TestGuestMiddleware_NeverAborts proves GuestMiddleware never calls c.Abort()
// on any path — both the existing-cookie and new-ID paths must reach the handler.
func TestGuestMiddleware_NeverAborts(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		cookies map[string]string
	}{
		{name: "no cookies", cookies: nil},
		{name: "existing guest_id", cookies: map[string]string{"guest_id": "existing"}},
		{name: "access_token only", cookies: map[string]string{"access_token": "token"}},
		{name: "both cookies", cookies: map[string]string{
			"guest_id":     "existing",
			"access_token": "token",
		}},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			handlerReached := false
			router := gin.New()
			router.Use(GuestMiddleware())
			router.GET("/test", func(c *gin.Context) {
				handlerReached = true
				c.Status(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			for name, value := range tc.cookies {
				req.AddCookie(&http.Cookie{Name: name, Value: value})
			}
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code)
			assert.True(t, handlerReached,
				"%s: GuestMiddleware must never abort — handler must always be reached",
				tc.name)
		})
	}
}

// ─── Cookie value integrity ───────────────────────────────────────────────────

// TestGuestMiddleware_ExistingCookie_ValueIntegrity proves arbitrary cookie
// values (including those that aren't UUIDs) are preserved unchanged — the
// middleware stores whatever is in the cookie without validation.
func TestGuestMiddleware_ExistingCookie_ValueIntegrity(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value string
	}{
		{name: "UUID format", value: "550e8400-e29b-41d4-a716-446655440000"},
		{name: "legacy format", value: "guest_legacy_12345"},
		{name: "short string", value: "abc"},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			router, captured := buildGuestRouter()
			w := fireGuestRequest(router, map[string]string{"guest_id": tc.value})

			require.Equal(t, http.StatusOK, w.Code)
			assert.Equal(t, tc.value, *captured,
				"existing guest_id value %q must be stored in context unchanged", tc.value)

			// Confirm no new cookie overwrites the existing one.
			setCookieHeader := w.Header().Get("Set-Cookie")
			assert.False(t, strings.Contains(setCookieHeader, "guest_id"),
				"no Set-Cookie must be written when guest_id cookie already exists")
		})
	}
}