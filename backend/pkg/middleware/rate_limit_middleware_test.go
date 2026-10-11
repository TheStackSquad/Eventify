// backend/pkg/middleware/rate_limit_middleware_test.go
//
// Tests for the RateLimit middleware using real IPRateLimiter instances.
//
// Strategy: no mocking — IPRateLimiter is pure in-memory with no external deps.
//   - rate.Inf  + large burst → never rate-limits (happy path)
//   - rate.Limit(0) + burst=0 → denies every request immediately (rejection path)
//
// Contracts proven:
//   - Allowed requests reach the handler
//   - Denied requests return 429 with correct body shape
//   - Localhost is bypassed when SkipLocalhostRateLimit=true
//   - Localhost is NOT bypassed when SkipLocalhostRateLimit=false
//   - IP extraction from headers is used as the rate-limit identifier
//
// Note on SkipLocalhostRateLimit: it is a package-level var in utils,
// set by init(). Tests that modify it use t.Cleanup to restore the original
// value — t.Setenv cannot be used since the var is not read from env at
// test time. These tests cannot run in parallel.
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestRateLimit

package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"golang.org/x/time/rate"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/eventify/backend/pkg/utils"
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

// neverLimiter returns an IPRateLimiter that never denies requests.
func neverLimiter() *utils.IPRateLimiter {
	return utils.NewIPRateLimiter(rate.Inf, 1000)
}

// alwaysLimiter returns an IPRateLimiter that denies every request immediately.
// burst=0 means the token bucket starts empty — Allow() always returns false.
func alwaysLimiter() *utils.IPRateLimiter {
	return utils.NewIPRateLimiter(rate.Limit(0), 0)
}

// buildRateLimitRouter wires RateLimit and a probe handler.
func buildRateLimitRouter(limiter *utils.IPRateLimiter) (*gin.Engine, *bool) {
	handlerReached := false
	router := gin.New()
	router.Use(RateLimit(limiter))
	router.GET("/test", func(c *gin.Context) {
		handlerReached = true
		c.Status(http.StatusOK)
	})
	return router, &handlerReached
}

// fireRateLimitRequest fires a GET /test with optional IP headers.
func fireRateLimitRequest(router *gin.Engine, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// setSkipLocalhost sets utils.SkipLocalhostRateLimit and registers a cleanup
// to restore the original value. Must not be called from parallel tests.
func setSkipLocalhost(t *testing.T, val bool) {
	t.Helper()
	original := utils.SkipLocalhostRateLimit
	utils.SkipLocalhostRateLimit = val
	t.Cleanup(func() {
		utils.SkipLocalhostRateLimit = original
	})
}

// ─── Happy path ───────────────────────────────────────────────────────────────

// TestRateLimit_Allowed proves a request within the rate limit reaches the handler.
func TestRateLimit_Allowed(t *testing.T) {
	t.Parallel()

	router, handlerReached := buildRateLimitRouter(neverLimiter())
	w := fireRateLimitRequest(router, nil)

	assert.Equal(t, http.StatusOK, w.Code,
		"request within rate limit must return 200")
	assert.True(t, *handlerReached,
		"handler must be reached when request is allowed")
}

// ─── Rejection path ───────────────────────────────────────────────────────────

// TestRateLimit_Denied proves a request that exceeds the rate limit returns 429.
func TestRateLimit_Denied(t *testing.T) {
	t.Parallel()

	router, handlerReached := buildRateLimitRouter(alwaysLimiter())
	w := fireRateLimitRequest(router, nil)

	assert.Equal(t, http.StatusTooManyRequests, w.Code,
		"request exceeding rate limit must return 429")
	assert.False(t, *handlerReached,
		"handler must NOT be reached when request is rate-limited")
}

// TestRateLimit_DeniedBodyShape proves the 429 body contains the exact fields
// and values the API contract specifies.
func TestRateLimit_DeniedBodyShape(t *testing.T) {
	t.Parallel()

	router, _ := buildRateLimitRouter(alwaysLimiter())
	w := fireRateLimitRequest(router, nil)

	require.Equal(t, http.StatusTooManyRequests, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	assert.Equal(t, "too_many_requests", body["error"],
		"error field must be 'too_many_requests'")
	assert.Equal(t, "Rate limit exceeded. Please try again later.", body["message"],
		"message field must match the contract exactly")
	assert.Len(t, body, 2,
		"429 body must contain exactly two fields — no internal detail leaked")
}

// TestRateLimit_HandlerNotReachedOnDenial proves c.Abort() is called —
// no handler after RateLimit executes when rate limited.
func TestRateLimit_HandlerNotReachedOnDenial(t *testing.T) {
	t.Parallel()

	secondHandlerReached := false

	router := gin.New()
	router.Use(RateLimit(alwaysLimiter()))
	router.Use(func(c *gin.Context) {
		secondHandlerReached = true
		c.Next()
	})
	router.GET("/test", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusTooManyRequests, w.Code)
	assert.False(t, secondHandlerReached,
		"no subsequent middleware or handler must execute after rate limit denial — c.Abort() must stop the chain")
}

// ─── Localhost bypass ─────────────────────────────────────────────────────────

// TestRateLimit_LocalhostSkipped proves that when SkipLocalhostRateLimit=true,
// requests from localhost bypass even a zero-burst limiter.
func TestRateLimit_LocalhostSkipped(t *testing.T) {
	// Cannot use t.Parallel() — modifies package-level var.
	setSkipLocalhost(t, true)

	router, handlerReached := buildRateLimitRouter(alwaysLimiter())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "127.0.0.1:1234"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code,
		"localhost must bypass rate limiting when SkipLocalhostRateLimit=true")
	assert.True(t, *handlerReached,
		"handler must be reached for localhost when skip is enabled")
}

// TestRateLimit_LocalhostNotSkipped proves that when SkipLocalhostRateLimit=false,
// localhost is subject to rate limiting like any other IP.
func TestRateLimit_LocalhostNotSkipped(t *testing.T) {
	// Cannot use t.Parallel() — modifies package-level var.
	setSkipLocalhost(t, false)

	router, handlerReached := buildRateLimitRouter(alwaysLimiter())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "127.0.0.1:1234"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusTooManyRequests, w.Code,
		"localhost must be rate-limited when SkipLocalhostRateLimit=false")
	assert.False(t, *handlerReached,
		"handler must NOT be reached for localhost when skip is disabled")
}

// TestRateLimit_NonLocalhostNotSkipped proves non-localhost IPs are never
// bypassed regardless of SkipLocalhostRateLimit.
func TestRateLimit_NonLocalhostNotSkipped(t *testing.T) {
	// Cannot use t.Parallel() — modifies package-level var.
	setSkipLocalhost(t, true) // skip is ON but IP is not localhost

	router, _ := buildRateLimitRouter(alwaysLimiter())

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Real-IP", "203.0.113.1") // public IP
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusTooManyRequests, w.Code,
		"non-localhost IP must not be skipped even when SkipLocalhostRateLimit=true")
}

// ─── IP header used as identifier ────────────────────────────────────────────

// TestRateLimit_XRealIP_UsedAsIdentifier proves X-Real-IP is used as the
// rate-limit key — different IPs get independent limiters.
func TestRateLimit_XRealIP_UsedAsIdentifier(t *testing.T) {
	t.Parallel()

	// Limiter allows exactly 1 request per identifier (burst=1).
	limiter := utils.NewIPRateLimiter(rate.Limit(0), 1)
	router, _ := buildRateLimitRouter(limiter)

	// First request from IP A — allowed (burst=1, consumes the token).
	w1 := fireRateLimitRequest(router, map[string]string{"X-Real-IP": "1.1.1.1"})
	assert.Equal(t, http.StatusOK, w1.Code,
		"first request from 1.1.1.1 must be allowed")

	// Second request from IP A — denied (token consumed).
	w2 := fireRateLimitRequest(router, map[string]string{"X-Real-IP": "1.1.1.1"})
	assert.Equal(t, http.StatusTooManyRequests, w2.Code,
		"second request from 1.1.1.1 must be rate-limited")

	// First request from IP B — allowed (independent bucket).
	w3 := fireRateLimitRequest(router, map[string]string{"X-Real-IP": "2.2.2.2"})
	assert.Equal(t, http.StatusOK, w3.Code,
		"first request from 2.2.2.2 must be allowed — independent limiter from 1.1.1.1")
}

// TestRateLimit_XForwardedFor_UsedAsIdentifier proves X-Forwarded-For is used
// when X-Real-IP is absent.
func TestRateLimit_XForwardedFor_UsedAsIdentifier(t *testing.T) {
	t.Parallel()

	limiter := utils.NewIPRateLimiter(rate.Limit(0), 1)
	router, _ := buildRateLimitRouter(limiter)

	// Two requests from the same forwarded IP — second must be denied.
	w1 := fireRateLimitRequest(router, map[string]string{"X-Forwarded-For": "5.5.5.5"})
	w2 := fireRateLimitRequest(router, map[string]string{"X-Forwarded-For": "5.5.5.5"})

	assert.Equal(t, http.StatusOK, w1.Code,
		"first request via X-Forwarded-For must be allowed")
	assert.Equal(t, http.StatusTooManyRequests, w2.Code,
		"second request from same X-Forwarded-For IP must be rate-limited")
}