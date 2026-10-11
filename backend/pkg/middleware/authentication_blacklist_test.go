// backend/pkg/middleware/authentication_blacklist_test.go
//
// Tests for Stage 4 of AuthMiddleware — the blacklist check:
//
//   Happy path:
//   - Valid, non-blacklisted token is allowed through
//
//   Revocation:
//   - Blacklisted token yields 401 with TOKEN_REVOKED code
//   - Response body shape is exact (message + code, nothing extra)
//
//   The fail-safe gap (documented bug):
//   - IsTokenBlacklisted returning an error currently does NOT abort
//   - The middleware logs the error but falls through to c.Next()
//   - This means a token whose blacklist status cannot be verified is
//     treated as valid — a security gap under DB/Redis failure
//   - These tests document current behaviour AND signal what the
//     correct fail-safe behaviour should be
//
//   Sequencing invariant:
//   - IsTokenBlacklisted is never called before ParseAccessToken succeeds
//   - ParseAccessToken is called exactly once per non-OPTIONS request
//     that carries a token
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestAuthMiddleware_Blacklist

package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sync/atomic"
	"testing"

	servicejwt "github.com/eventify/backend/pkg/services/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Happy path ───────────────────────────────────────────────────────────────

// TestAuthMiddleware_Blacklist_NotBlacklisted proves the baseline: a valid
// token that is not blacklisted must pass through to the handler.
func TestAuthMiddleware_Blacklist_NotBlacklisted(t *testing.T) {
	t.Parallel()

	svc := validSvc() // parseOK=true, blacklisted=false
	router, _ := newTestRouter(svc)

	w := makeRequest(t, router, requestOpts{bearerToken: "valid.token"})

	assert.Equal(t, http.StatusOK, w.Code)
}

// ─── Revoked token ────────────────────────────────────────────────────────────

// TestAuthMiddleware_Blacklist_Revoked proves that a token which is present in
// the blacklist yields a 401 with the TOKEN_REVOKED code and the exact message
// the frontend contract expects.
func TestAuthMiddleware_Blacklist_Revoked(t *testing.T) {
	t.Parallel()

	svc := &mockAuthService{
		parseAccessTokenFn: func(_ context.Context, _ string) (*servicejwt.Claims, error) {
			return fakeClaims(), nil
		},
		isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) {
			return true, nil // token is in the blacklist
		},
	}

	router, _ := newTestRouter(svc)
	w := makeRequest(t, router, requestOpts{bearerToken: "revoked.token"})

	// ── Status ────────────────────────────────────────────────────────────────
	assert.Equal(t, http.StatusUnauthorized, w.Code)

	// ── Body shape ────────────────────────────────────────────────────────────
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body),
		"response body must be valid JSON")

	assert.Equal(t,
		"Session has been terminated. Please login again.",
		body["message"],
		"revoked token message must match the frontend contract exactly",
	)
	assert.Equal(t,
		"TOKEN_REVOKED",
		body["code"],
		"revoked token response must carry TOKEN_REVOKED code so the "+
			"client can distinguish this 401 from an expired-token 401",
	)

	// ── No extra fields leaked ────────────────────────────────────────────────
	// The response must contain exactly "message" and "code" — nothing else.
	// Extra fields (e.g. internal user_id, token hash) would be an info leak.
	assert.Len(t, body, 2,
		"revoked token response body must contain exactly {message, code}")
}

// TestAuthMiddleware_Blacklist_RevokedBodyContract is a companion to the above.
// It re-asserts the body contract using raw string matching so that any
// accidental field addition shows up in both assertion styles.
func TestAuthMiddleware_Blacklist_RevokedBodyContract(t *testing.T) {
	t.Parallel()

	svc := &mockAuthService{
		parseAccessTokenFn:   func(_ context.Context, _ string) (*servicejwt.Claims, error) { return fakeClaims(), nil },
		isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) { return true, nil },
	}

	router, _ := newTestRouter(svc)
	w := makeRequest(t, router, requestOpts{bearerToken: "revoked.token"})

	body := w.Body.String()

	assert.Contains(t, body, "TOKEN_REVOKED")
	assert.Contains(t, body, "Session has been terminated")
	assert.NotContains(t, body, "user_id",
		"user identifier must never appear in a rejection response")
	assert.NotContains(t, body, "token",
		"token value must never be echoed back in a rejection response")
}

// ─── Blacklist fail-safe (fail-closed) ───────────────────────────────────────
//
// Fixed middleware code:
//
//   blacklisted, err := svc.IsTokenBlacklisted(c.Request.Context(), accessToken)
//   if err != nil {
//       utils.LogError(...)
//       c.JSON(http.StatusUnauthorized, ...)
//       c.Abort()
//       return                          // ← fail-closed
//   }
//
// When the blacklist store is unavailable, we cannot verify whether this token
// has been revoked. The only safe response is to deny the request. Failing open
// would allow a logged-out session to remain active during a Redis outage.

// TestAuthMiddleware_Blacklist_DBError_FailSafe proves the fail-closed contract:
// a blacklist DB/Redis error must deny the request, not allow it through.
func TestAuthMiddleware_Blacklist_DBError_FailSafe(t *testing.T) {
	t.Parallel()

	svc := &mockAuthService{
		parseAccessTokenFn: func(_ context.Context, _ string) (*servicejwt.Claims, error) {
			return fakeClaims(), nil
		},
		isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) {
			// Simulate Redis/DB being down.
			return false, errors.New("redis: connection refused")
		},
	}

	router, _ := newTestRouter(svc)
	w := makeRequest(t, router, requestOpts{bearerToken: "unverifiable.token"})

	// Fail-closed: unverifiable blacklist status must deny the request.
	assert.Equal(t, http.StatusUnauthorized, w.Code,
		"blacklist DB error must deny the request — fail-closed is the only safe behaviour")

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	// The client must not know the DB is down — same generic session message.
	assert.Equal(t, "Session expired or invalid.", body["message"],
		"DB error must not leak infrastructure detail to the client")

	// Must not carry TOKEN_REVOKED — this is an infrastructure error, not a revocation.
	_, hasCode := body["code"]
	assert.False(t, hasCode,
		"transient infrastructure errors must not carry TOKEN_REVOKED code")
}

// TestAuthMiddleware_Blacklist_DBError_WithBlacklistedTrue covers the edge case
// where IsTokenBlacklisted returns BOTH an error AND true. In this case the
// middleware currently still aborts (because the blacklisted == true check runs
// regardless of err). This is the one case where the current code is accidentally
// correct — we document it so a future refactor does not regress it.
func TestAuthMiddleware_Blacklist_DBError_WithBlacklistedTrue(t *testing.T) {
	t.Parallel()

	svc := &mockAuthService{
		parseAccessTokenFn: func(_ context.Context, _ string) (*servicejwt.Claims, error) {
			return fakeClaims(), nil
		},
		isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) {
			// Pathological: error AND blacklisted=true simultaneously.
			// This can happen if the DB returns partial data before failing.
			return true, errors.New("redis: read timeout")
		},
	}

	router, _ := newTestRouter(svc)
	w := makeRequest(t, router, requestOpts{bearerToken: "revoked.token"})

	// Even with the DB error, blacklisted=true must still deny the request.
	assert.Equal(t, http.StatusUnauthorized, w.Code,
		"blacklisted=true must deny the request even when err is also non-nil")
}

// ─── Call sequencing invariants ───────────────────────────────────────────────

// TestAuthMiddleware_Blacklist_Sequencing proves the ordering contract:
//   1. ParseAccessToken is called exactly once
//   2. IsTokenBlacklisted is called exactly once — and only after ParseAccessToken
//   3. IsTokenBlacklisted receives the same token string that ParseAccessToken received
func TestAuthMiddleware_Blacklist_Sequencing(t *testing.T) {
	t.Parallel()

	const token = "sequencing.test.token"

	var (
		parseCallCount     int32
		blacklistCallCount int32
		parseCalledAt      int32 // logical clock value when parse was called
		blacklistCalledAt  int32 // logical clock value when blacklist was called
		clock              int32 // monotonic counter incremented on each call

		parseReceivedToken     string
		blacklistReceivedToken string
	)

	svc := &mockAuthService{
		parseAccessTokenFn: func(_ context.Context, tok string) (*servicejwt.Claims, error) {
			atomic.AddInt32(&parseCallCount, 1)
			atomic.StoreInt32(&parseCalledAt, atomic.AddInt32(&clock, 1))
			parseReceivedToken = tok
			return fakeClaims(), nil
		},
		isTokenBlacklistedFn: func(_ context.Context, tok string) (bool, error) {
			atomic.AddInt32(&blacklistCallCount, 1)
			atomic.StoreInt32(&blacklistCalledAt, atomic.AddInt32(&clock, 1))
			blacklistReceivedToken = tok
			return false, nil
		},
	}

	router, _ := newTestRouter(svc)
	w := makeRequest(t, router, requestOpts{bearerToken: token})

	require.Equal(t, http.StatusOK, w.Code)

	// ── Each function called exactly once ─────────────────────────────────────
	assert.Equal(t, int32(1), atomic.LoadInt32(&parseCallCount),
		"ParseAccessToken must be called exactly once per request")
	assert.Equal(t, int32(1), atomic.LoadInt32(&blacklistCallCount),
		"IsTokenBlacklisted must be called exactly once per request")

	// ── ParseAccessToken happens before IsTokenBlacklisted ────────────────────
	assert.Less(t,
		atomic.LoadInt32(&parseCalledAt),
		atomic.LoadInt32(&blacklistCalledAt),
		"ParseAccessToken must be called before IsTokenBlacklisted — "+
			"validating signature before hitting the DB is the documented contract",
	)

	// ── Both receive the same token string ────────────────────────────────────
	assert.Equal(t, token, parseReceivedToken,
		"ParseAccessToken must receive the extracted token")
	assert.Equal(t, token, blacklistReceivedToken,
		"IsTokenBlacklisted must receive the same token as ParseAccessToken — "+
			"hashing a different string would break revocation lookup",
	)
}

// TestAuthMiddleware_Blacklist_NoDBCallOnParseFailure proves that when
// ParseAccessToken fails, IsTokenBlacklisted is never called — sequencing
// in the failure path.
func TestAuthMiddleware_Blacklist_NoDBCallOnParseFailure(t *testing.T) {
	t.Parallel()

	svc := &mockAuthService{
		parseAccessTokenFn: func(_ context.Context, _ string) (*servicejwt.Claims, error) {
			return nil, errors.New("token invalid")
		},
		// isTokenBlacklistedFn left nil — any call panics loudly.
	}

	// Wire a safe version so we can assert call count rather than relying
	// solely on the panic.
	blacklistCalled := false
	svc.isTokenBlacklistedFn = func(_ context.Context, _ string) (bool, error) {
		blacklistCalled = true
		return false, nil
	}

	router, _ := newTestRouter(svc)
	w := makeRequest(t, router, requestOpts{bearerToken: "invalid.token"})

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.False(t, blacklistCalled,
		"IsTokenBlacklisted must not be called when ParseAccessToken fails")
}