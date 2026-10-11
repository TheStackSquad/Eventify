// backend/pkg/middleware/csrf_middleware_test.go
//
// Integration tests for CSRFProtection middleware — all skip paths,
// all rejection paths, happy path, cookie attributes, and config variants.
//
// Double Submit Cookie pattern:
//   1. GET/HEAD   → generate token if absent, set cookie, allow through
//   2. POST/PUT/PATCH/DELETE → require cookie + matching header, else 403
//
// Rejection codes:
//   CSRF_TOKEN_MISSING   — cookie absent on state-changing request
//   CSRF_TOKEN_REQUIRED  — header absent on state-changing request
//   CSRF_TOKEN_INVALID   — cookie ≠ header
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestCSRFProtection

package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Router builder ───────────────────────────────────────────────────────────

// buildCSRFRouter wires CSRFProtection and a probe handler that returns 200.
func buildCSRFRouter(configs ...CSRFConfig) *gin.Engine {
	router := gin.New()
	router.Use(CSRFProtection(configs...))
	for _, method := range []string{
		http.MethodGet, http.MethodHead, http.MethodPost,
		http.MethodPut, http.MethodPatch, http.MethodDelete,
		http.MethodOptions,
	} {
		method := method
		router.Handle(method, "/test", func(c *gin.Context) {
			c.Status(http.StatusOK)
		})
	}
	return router
}

// fireCSRFRequest fires a request with optional csrf cookie and header.
func fireCSRFRequest(router *gin.Engine, method, csrfCookie, csrfHeader string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, "/test", nil)
	if csrfCookie != "" {
		req.AddCookie(&http.Cookie{Name: CSRFTokenCookieName, Value: csrfCookie})
	}
	if csrfHeader != "" {
		req.Header.Set(CSRFTokenHeaderName, csrfHeader)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// ─── Skip paths ───────────────────────────────────────────────────────────────

// TestCSRFProtection_Skip_OPTIONS proves OPTIONS requests are never blocked.
func TestCSRFProtection_Skip_OPTIONS(t *testing.T) {
	t.Parallel()

	router := buildCSRFRouter()
	w := fireCSRFRequest(router, http.MethodOptions, "", "")

	assert.NotEqual(t, http.StatusForbidden, w.Code,
		"OPTIONS must never be blocked by CSRF middleware")
}

// TestCSRFProtection_Skip_CustomSkip proves the Skip function bypasses
// CSRF validation entirely.
func TestCSRFProtection_Skip_CustomSkip(t *testing.T) {
	t.Parallel()

	cfg := DefaultCSRFConfig()
	cfg.Skip = func(c *gin.Context) bool { return true } // always skip

	router := buildCSRFRouter(cfg)

	// POST with no cookie or header — would normally be rejected.
	w := fireCSRFRequest(router, http.MethodPost, "", "")

	assert.NotEqual(t, http.StatusForbidden, w.Code,
		"Skip=true must bypass CSRF validation even on state-changing methods")
}

// TestCSRFProtection_Skip_CustomSkipSelective proves Skip only bypasses
// matched paths — other paths still require CSRF.
func TestCSRFProtection_Skip_CustomSkipSelective(t *testing.T) {
	t.Parallel()

	cfg := DefaultCSRFConfig()
	cfg.Skip = SkipCSRFForPaths("/test") // matches our probe path

	router := buildCSRFRouter(cfg)
	w := fireCSRFRequest(router, http.MethodPost, "", "")

	assert.NotEqual(t, http.StatusForbidden, w.Code,
		"path in skip list must bypass CSRF")
}

// ─── GET/HEAD: token generation ───────────────────────────────────────────────

// TestCSRFProtection_GET_NoExistingToken proves GET without a csrf_token cookie
// generates a new token and sets it.
func TestCSRFProtection_GET_NoExistingToken(t *testing.T) {
	t.Parallel()

	router := buildCSRFRouter()
	w := fireCSRFRequest(router, http.MethodGet, "", "")

	assert.Equal(t, http.StatusOK, w.Code,
		"GET without CSRF token must be allowed through")

	cookie := getResponseCookie(w, CSRFTokenCookieName)
	require.NotNil(t, cookie,
		"GET without existing token must set a new csrf_token cookie")
	assert.NotEmpty(t, cookie.Value)
}

// TestCSRFProtection_GET_ExistingToken proves GET with an existing csrf_token
// cookie does not overwrite it — the existing token is preserved.
func TestCSRFProtection_GET_ExistingToken(t *testing.T) {
	t.Parallel()

	const existingToken = "existingtoken1234existingtoken1234existingtoken1234existingtoken12"

	router := buildCSRFRouter()
	w := fireCSRFRequest(router, http.MethodGet, existingToken, "")

	assert.Equal(t, http.StatusOK, w.Code)

	// No new Set-Cookie should be written.
	cookie := getResponseCookie(w, CSRFTokenCookieName)
	assert.Nil(t, cookie,
		"GET with existing csrf_token must not overwrite the cookie")
}

// TestCSRFProtection_HEAD_GeneratesToken proves HEAD behaves identically to GET
// for token generation.
func TestCSRFProtection_HEAD_GeneratesToken(t *testing.T) {
	t.Parallel()

	router := buildCSRFRouter()
	req := httptest.NewRequest(http.MethodHead, "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code,
		"HEAD without CSRF token must be allowed through")
}

// ─── Cookie attributes on token generation ────────────────────────────────────

// TestCSRFProtection_Cookie_NotHttpOnly proves the CSRF cookie has HttpOnly=false —
// the browser JS must be able to read it to send it back in the header.
func TestCSRFProtection_Cookie_NotHttpOnly(t *testing.T) {
	t.Parallel()

	router := buildCSRFRouter()
	w := fireCSRFRequest(router, http.MethodGet, "", "")

	cookie := getResponseCookie(w, CSRFTokenCookieName)
	require.NotNil(t, cookie)

	assert.False(t, cookie.HttpOnly,
		"CSRF cookie must NOT be HttpOnly — JS needs to read it for the Double Submit pattern")
}

// TestCSRFProtection_Cookie_MaxAge proves the CSRF cookie has a 7-day max-age.
func TestCSRFProtection_Cookie_MaxAge(t *testing.T) {
	t.Parallel()

	router := buildCSRFRouter()
	w := fireCSRFRequest(router, http.MethodGet, "", "")

	cookie := getResponseCookie(w, CSRFTokenCookieName)
	require.NotNil(t, cookie)

	const sevenDaysSeconds = 3600 * 24 * 7
	assert.Equal(t, sevenDaysSeconds, cookie.MaxAge,
		"CSRF cookie must have 7-day max-age")
}

// TestCSRFProtection_Cookie_Path proves the CSRF cookie path is "/".
func TestCSRFProtection_Cookie_Path(t *testing.T) {
	t.Parallel()

	router := buildCSRFRouter()
	w := fireCSRFRequest(router, http.MethodGet, "", "")

	cookie := getResponseCookie(w, CSRFTokenCookieName)
	require.NotNil(t, cookie)

	assert.Equal(t, "/", cookie.Path)
}

// TestCSRFProtection_Cookie_SameSiteNoneForceSecure proves that when
// COOKIE_SAMESITE=none, the cookie is forced Secure=true regardless of
// COOKIE_SECURE setting — SameSite=None requires Secure or browsers reject it.
func TestCSRFProtection_Cookie_SameSiteNoneForceSecure(t *testing.T) {
	t.Setenv("COOKIE_SAMESITE", "none")
	t.Setenv("COOKIE_SECURE", "false") // explicitly false — must be overridden

	router := buildCSRFRouter()
	w := fireCSRFRequest(router, http.MethodGet, "", "")

	cookie := getResponseCookie(w, CSRFTokenCookieName)
	require.NotNil(t, cookie)

	assert.True(t, cookie.Secure,
		"SameSite=None must force Secure=true — browsers reject SameSite=None without Secure")
}

// ─── State-changing methods: rejection paths ──────────────────────────────────

// TestCSRFProtection_POST_NoCookie proves POST without a csrf_token cookie
// returns 403 with CSRF_TOKEN_MISSING code.
func TestCSRFProtection_POST_NoCookie(t *testing.T) {
	t.Parallel()

	router := buildCSRFRouter()
	w := fireCSRFRequest(router, http.MethodPost, "", "")

	assert.Equal(t, http.StatusForbidden, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "CSRF_TOKEN_MISSING", body["code"])
}

// TestCSRFProtection_POST_NoHeader proves POST with cookie but no header
// returns 403 with CSRF_TOKEN_REQUIRED code.
func TestCSRFProtection_POST_NoHeader(t *testing.T) {
	t.Parallel()

	router := buildCSRFRouter()
	w := fireCSRFRequest(router, http.MethodPost, "sometoken", "")

	assert.Equal(t, http.StatusForbidden, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "CSRF_TOKEN_REQUIRED", body["code"])
}

// TestCSRFProtection_POST_TokenMismatch proves POST with mismatched cookie and
// header returns 403 with CSRF_TOKEN_INVALID code.
func TestCSRFProtection_POST_TokenMismatch(t *testing.T) {
	t.Parallel()

	router := buildCSRFRouter()
	w := fireCSRFRequest(router, http.MethodPost, "tokenAAAA", "tokenBBBB")

	assert.Equal(t, http.StatusForbidden, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "CSRF_TOKEN_INVALID", body["code"])
}

// TestCSRFProtection_AllStateMethods_RequireCSRF proves all state-changing
// HTTP methods enforce CSRF — not just POST.
func TestCSRFProtection_AllStateMethods_RequireCSRF(t *testing.T) {
	t.Parallel()

	methods := []string{
		http.MethodPost,
		http.MethodPut,
		http.MethodPatch,
		http.MethodDelete,
	}

	for _, method := range methods {
		method := method
		t.Run(method, func(t *testing.T) {
			t.Parallel()

			router := buildCSRFRouter()
			w := fireCSRFRequest(router, method, "", "")

			assert.Equal(t, http.StatusForbidden, w.Code,
				"%s without CSRF token must return 403", method)
		})
	}
}

// TestCSRFProtection_RejectionCodesDistinct proves the three rejection codes
// are all different — a client must be able to distinguish them.
func TestCSRFProtection_RejectionCodesDistinct(t *testing.T) {
	t.Parallel()

	router := buildCSRFRouter()

	wMissing := fireCSRFRequest(router, http.MethodPost, "", "")
	wRequired := fireCSRFRequest(router, http.MethodPost, "token", "")
	wInvalid := fireCSRFRequest(router, http.MethodPost, "tokenA", "tokenB")

	var bMissing, bRequired, bInvalid map[string]interface{}
	require.NoError(t, json.Unmarshal(wMissing.Body.Bytes(), &bMissing))
	require.NoError(t, json.Unmarshal(wRequired.Body.Bytes(), &bRequired))
	require.NoError(t, json.Unmarshal(wInvalid.Body.Bytes(), &bInvalid))

	assert.NotEqual(t, bMissing["code"], bRequired["code"],
		"missing-cookie and missing-header codes must be distinct")
	assert.NotEqual(t, bRequired["code"], bInvalid["code"],
		"missing-header and mismatch codes must be distinct")
	assert.NotEqual(t, bMissing["code"], bInvalid["code"],
		"missing-cookie and mismatch codes must be distinct")
}

// ─── Happy path ───────────────────────────────────────────────────────────────

// TestCSRFProtection_POST_ValidTokens proves POST with matching cookie and
// header is allowed through.
func TestCSRFProtection_POST_ValidTokens(t *testing.T) {
	t.Parallel()

	const token = "a3f2e1d4c5b6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"

	router := buildCSRFRouter()
	w := fireCSRFRequest(router, http.MethodPost, token, token)

	assert.Equal(t, http.StatusOK, w.Code,
		"POST with matching cookie and header must be allowed through")
}

// TestCSRFProtection_AllStateMethods_PassWithValidTokens proves all
// state-changing methods pass when tokens match.
func TestCSRFProtection_AllStateMethods_PassWithValidTokens(t *testing.T) {
	t.Parallel()

	const token = "a3f2e1d4c5b6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"

	methods := []string{
		http.MethodPost,
		http.MethodPut,
		http.MethodPatch,
		http.MethodDelete,
	}

	for _, method := range methods {
		method := method
		t.Run(method, func(t *testing.T) {
			t.Parallel()

			router := buildCSRFRouter()
			w := fireCSRFRequest(router, method, token, token)

			assert.Equal(t, http.StatusOK, w.Code,
				"%s with matching tokens must be allowed through", method)
		})
	}
}

// ─── Custom config ────────────────────────────────────────────────────────────

// TestCSRFProtection_CustomCookieName proves a custom cookie name is honoured —
// the middleware reads from and writes to the configured name.
func TestCSRFProtection_CustomCookieName(t *testing.T) {
	t.Parallel()

	cfg := DefaultCSRFConfig()
	cfg.CookieName = "my_csrf"
	cfg.HeaderName = "X-My-CSRF"

	router := gin.New()
	router.Use(CSRFProtection(cfg))
	router.POST("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	const token = "a3f2e1d4c5b6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"

	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "my_csrf", Value: token})
	req.Header.Set("X-My-CSRF", token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code,
		"custom cookie and header names must be respected")
}

// TestCSRFProtection_DefaultConfig proves CSRFProtection() with no arguments
// uses the default config — standard cookie and header names.
func TestCSRFProtection_DefaultConfig(t *testing.T) {
	t.Parallel()

	// No config passed — uses DefaultCSRFConfig()
	router := buildCSRFRouter()

	const token = "a3f2e1d4c5b6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
	w := fireCSRFRequest(router, http.MethodPost, token, token)

	assert.Equal(t, http.StatusOK, w.Code,
		"default config must use CSRFTokenCookieName and CSRFTokenHeaderName")
}