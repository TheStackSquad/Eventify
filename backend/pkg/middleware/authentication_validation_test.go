// backend/pkg/middleware/authentication_validation_test.go
//
// Tests for Stage 3 of AuthMiddleware:
//   - ParseAccessToken returning an error yields 401 with correct message
//   - ParseAccessToken is never called when extraction already failed
//   - IsTokenBlacklisted is never called when ParseAccessToken fails
//   - All known error variants from the auth service produce the same
//     opaque 401 (no internal error detail leaked to the client)
//
// The single invariant this file proves:
//
//	A token that fails signature or expiry validation must never reach the
//	blacklist check — hitting the DB for a fake/expired token is wasteful
//	and potentially a vector for timing attacks.
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestAuthMiddleware_Validation

package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	authErrors "github.com/eventify/backend/pkg/services/auth"
	servicejwt "github.com/eventify/backend/pkg/services/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── ParseAccessToken failure → 401, blacklist never called ──────────────────

// TestAuthMiddleware_Validation_ParseFailure is the core contract:
// any error from ParseAccessToken must yield a 401, and IsTokenBlacklisted
// must never be called — proved by leaving isTokenBlacklistedFn nil so that
// any call to it panics immediately.
func TestAuthMiddleware_Validation_ParseFailure(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		parseErr    error
		wantStatus  int
		wantMessage string
		wantCode    string // optional JSON "code" field in response body
	}{
		{
			name:        "expired token returns 401 with opaque message",
			parseErr:    authErrors.ErrSessionExpired,
			wantStatus:  http.StatusUnauthorized,
			wantMessage: "Session expired or invalid.",
		},
		{
			name:        "completely invalid token returns 401",
			parseErr:    errors.New("crypto/rsa: verification error"),
			wantStatus:  http.StatusUnauthorized,
			wantMessage: "Session expired or invalid.",
		},
		{
			name:        "malformed JWT structure returns 401",
			parseErr:    errors.New("token contains an invalid number of segments"),
			wantStatus:  http.StatusUnauthorized,
			wantMessage: "Session expired or invalid.",
		},
		{
			name:        "wrong signing algorithm returns 401",
			parseErr:    errors.New("signing method mismatch"),
			wantStatus:  http.StatusUnauthorized,
			wantMessage: "Session expired or invalid.",
		},
		{
			name:        "token issued in future (nbf) returns 401",
			parseErr:    errors.New("token is not valid yet"),
			wantStatus:  http.StatusUnauthorized,
			wantMessage: "Session expired or invalid.",
		},
		{
			name:        "refresh token used as access token returns 401",
			parseErr:    errors.New("invalid token type"),
			wantStatus:  http.StatusUnauthorized,
			wantMessage: "Session expired or invalid.",
		},
		{
			name:        "empty string token returns 401",
			parseErr:    errors.New("token is empty"),
			wantStatus:  http.StatusUnauthorized,
			wantMessage: "Session expired or invalid.",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			blacklistCalled := false

			svc := &mockAuthService{
				parseAccessTokenFn: func(_ context.Context, _ string) (*servicejwt.Claims, error) {
					return nil, tc.parseErr
				},
				// isTokenBlacklistedFn intentionally left nil.
				// If the middleware calls it anyway, the nil-guard panics —
				// making the violation immediately visible.
			}

			// Wire a sentinel onto isTokenBlacklisted so we can also assert
			// it was never called without relying solely on the panic.
			svc.isTokenBlacklistedFn = func(_ context.Context, _ string) (bool, error) {
				blacklistCalled = true
				return false, nil
			}

			router, _ := newTestRouter(svc)
			w := makeRequest(t, router, requestOpts{bearerToken: "any.token.value"})

			// ── Status ────────────────────────────────────────────────────────
			assert.Equal(t, tc.wantStatus, w.Code)

			// ── Response body ─────────────────────────────────────────────────
			var body map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &body)
			require.NoError(t, err, "response body should be valid JSON")
			assert.Equal(t, tc.wantMessage, body["message"],
				"client-facing message must be opaque — no internal error detail")

			// ── Blacklist was never reached ───────────────────────────────────
			assert.False(t, blacklistCalled,
				"IsTokenBlacklisted must not be called when ParseAccessToken fails — "+
					"no point hitting the DB for a fake or expired token")
		})
	}
}

// ─── Error message opacity ────────────────────────────────────────────────────

// TestAuthMiddleware_Validation_OpaqueErrors proves that the middleware never
// leaks internal error strings to the client. Every parse failure — regardless
// of the underlying reason — must produce the same generic message.
//
// This matters for security: different error messages for "expired" vs "invalid
// signature" let an attacker distinguish between token states.
func TestAuthMiddleware_Validation_OpaqueErrors(t *testing.T) {
	t.Parallel()

	internalErrors := []error{
		authErrors.ErrSessionExpired,
		errors.New("crypto/rsa: verification error"),
		errors.New("unexpected signing method: RS512"),
		errors.New("token contains an invalid number of segments"),
		errors.New("database connection refused"),
		errors.New("key not found"),
	}

	const expectedMessage = "Session expired or invalid."

	for _, internalErr := range internalErrors {
		internalErr := internalErr
		t.Run(internalErr.Error(), func(t *testing.T) {
			t.Parallel()

			svc := &mockAuthService{
				parseAccessTokenFn: func(_ context.Context, _ string) (*servicejwt.Claims, error) {
					return nil, internalErr
				},
				isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) {
					return false, nil
				},
			}

			router, _ := newTestRouter(svc)
			w := makeRequest(t, router, requestOpts{bearerToken: "some.token"})

			var body map[string]interface{}
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

			// The exact internal error must not appear anywhere in the response.
			bodyStr := w.Body.String()
			assert.NotContains(t, bodyStr, internalErr.Error(),
				"internal error detail must never be leaked to the client")

			// The message must always be the same generic string.
			assert.Equal(t, expectedMessage, body["message"])

			// No "code" field on parse failures (only TOKEN_REVOKED carries one).
			_, hasCode := body["code"]
			assert.False(t, hasCode,
				"parse failure responses must not include a 'code' field")
		})
	}
}

// ─── ParseAccessToken receives the exact extracted token ─────────────────────

// TestAuthMiddleware_Validation_TokenPassthrough proves that the token string
// that survives extraction is passed verbatim to ParseAccessToken — no
// mutation, no re-encoding, no truncation.
func TestAuthMiddleware_Validation_TokenPassthrough(t *testing.T) {
	t.Parallel()

	// A realistic-looking JWT (header.payload.signature).
	const realisticToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9" +
		".eyJ1c2VyX2lkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0" +
		".signature"

	tests := []struct {
		name        string
		sendToken   string
		expectToken string
	}{
		{
			name:        "realistic JWT is passed verbatim",
			sendToken:   realisticToken,
			expectToken: realisticToken,
		},
		{
			name:        "whitespace-padded JWT is trimmed before passing",
			sendToken:   "  " + realisticToken + "  ",
			expectToken: realisticToken,
		},
		{
			name:        "opaque token string is passed verbatim",
			sendToken:   "opaque-token-12345",
			expectToken: "opaque-token-12345",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var receivedToken string

			svc := &mockAuthService{
				parseAccessTokenFn: func(_ context.Context, token string) (*servicejwt.Claims, error) {
					receivedToken = token
					return fakeClaims(), nil
				},
				isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) {
					return false, nil
				},
			}

			router, _ := newTestRouter(svc)
			// Use raw header to preserve the spaces in the padded case.
			req, err := makeRawRequest(http.MethodGet, "/test", "Bearer "+tc.sendToken)
			require.NoError(t, err)

			w := recordResponse(router, req)

			require.Equal(t, http.StatusOK, w.Code,
				"happy path must succeed — check fakeClaims() setup")
			assert.Equal(t, tc.expectToken, receivedToken,
				"token passed to ParseAccessToken does not match expected value")
		})
	}
}

// ─── ParseAccessToken returning nil claims with nil error ────────────────────

// TestAuthMiddleware_Validation_NilClaimsNoError proves that the nil-guard added
// after ParseAccessToken prevents the nil pointer dereference that previously
// panicked at uuid.Parse(claims.UserID).
//
// Fixed middleware code:
//
//	claims, err := svc.ParseAccessToken(...)
//	if err != nil { ... abort ... }
//	if claims == nil {               // ← the nil guard
//	    utils.LogError(...)
//	    c.JSON(401, ...)
//	    c.Abort()
//	    return
//	}
func TestAuthMiddleware_Validation_NilClaimsNoError(t *testing.T) {
	t.Parallel()

	svc := &mockAuthService{
		parseAccessTokenFn: func(_ context.Context, _ string) (*servicejwt.Claims, error) {
			return nil, nil // pathological: no error, no claims
		},
		isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) {
			return false, nil
		},
	}

	// gin.New() is sufficient now — the nil guard aborts cleanly before the
	// nil dereference panic. No Recovery middleware needed.
	router, _ := newTestRouter(svc)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer some.token")
	router.ServeHTTP(w, req)

	// Now returns a clean 401 — no panic, no 500.
	assert.Equal(t, http.StatusUnauthorized, w.Code,
		"nil claims with nil error must produce a clean 401 via the nil guard — not a panic")

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "Session expired or invalid.", body["message"],
		"nil claims response must use the same opaque message as all other auth failures")
}