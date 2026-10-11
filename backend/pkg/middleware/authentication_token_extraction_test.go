// backend/pkg/middleware/authentication_token_extraction_test.go
//
// Tests for Stage 1 & 2 of AuthMiddleware:
//   - OPTIONS requests pass through without any auth check
//   - Token extraction from Authorization header (happy + malformed variants)
//   - Token extraction fallback to access_token cookie
//   - Whitespace trimming on both sources (the SHA-256 hash symmetry contract)
//   - Priority: header wins when both header and cookie are present
//   - Complete absence of token yields 401
//
// Every test in this file is purely about extraction — whether the middleware
// can get a token string into the validation stage. ParseAccessToken is always
// configured to succeed so that a 401 unambiguously means extraction failed,
// not validation.
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestAuthMiddleware_Extraction
//	go test ./pkg/middleware/ -v -run TestAuthMiddleware_OPTIONS

package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	servicejwt "github.com/eventify/backend/pkg/services/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── OPTIONS Passthrough ──────────────────────────────────────────────────────

// TestAuthMiddleware_OPTIONS proves that preflight requests are never touched
// by auth logic. The mock has no functions set — any call to ParseAccessToken
// or IsTokenBlacklisted would panic, making an unintended auth check
// immediately visible.
func TestAuthMiddleware_OPTIONS(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		path string
	}{
		{
			name: "OPTIONS on protected route passes through",
			path: "/test",
		},
		{
			name: "OPTIONS with no token passes through",
			path: "/test",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			// No functions set — any auth call panics loudly.
			svc := &mockAuthService{}
			router, _ := newTestRouter(svc)

			w := makeRequest(t, router, requestOpts{
				method: http.MethodOptions,
				path:   tc.path,
			})

			// Gin itself returns 200 for OPTIONS when no explicit handler is
			// registered; what matters is that the middleware did not abort
			// with a 401.
			assert.NotEqual(t, http.StatusUnauthorized, w.Code,
				"OPTIONS request must never be rejected by auth middleware")
		})
	}
}

// ─── Token Extraction ─────────────────────────────────────────────────────────

func TestAuthMiddleware_Extraction(t *testing.T) {
	t.Parallel()

	const validToken = "valid.jwt.token"

	tests := []struct {
		name            string
		opts            requestOpts
		rawHeader       string // when set, overrides opts and sends this exact Authorization header
		wantStatus      int
		wantToken       string // what ParseAccessToken should receive; "" means not called
		wantTokenCalled bool   // whether ParseAccessToken should be called at all
	}{
		// ── No token present ─────────────────────────────────────────────────

		{
			name:            "no header and no cookie yields 401",
			opts:            requestOpts{},
			wantStatus:      http.StatusUnauthorized,
			wantTokenCalled: false,
		},

		// ── Authorization header — well-formed ───────────────────────────────

		{
			name:            "valid Bearer header is extracted and passed to ParseAccessToken",
			opts:            requestOpts{bearerToken: validToken},
			wantStatus:      http.StatusOK,
			wantToken:       validToken,
			wantTokenCalled: true,
		},

		// ── Authorization header — malformed variants ─────────────────────────
		// Each of these must fall through to the cookie check, find nothing,
		// and return 401. None should reach ParseAccessToken.
		// rawHeader is used here because requestOpts.bearerToken auto-prepends "Bearer ".

		{
			name:            "Authorization header with no Bearer prefix is rejected",
			rawHeader:       "Token " + validToken,
			wantStatus:      http.StatusUnauthorized,
			wantTokenCalled: false,
		},
		{
			name:            "Authorization header missing token part is rejected",
			rawHeader:       "Bearer",
			wantStatus:      http.StatusUnauthorized,
			wantTokenCalled: false,
		},
		{
			name:            "Authorization header with extra parts is rejected",
			rawHeader:       "Bearer " + validToken + " extra",
			wantStatus:      http.StatusUnauthorized,
			wantTokenCalled: false,
		},

		// ── Whitespace trimming — header ──────────────────────────────────────

		{
			// strings.Fields collapses multiple spaces so "Bearer   token  "
			// splits into exactly ["Bearer", "token"] — TrimSpace then cleans
			// any residual whitespace, ensuring SHA-256 hash symmetry.
			name:            "leading and trailing whitespace in Bearer token is trimmed",
			opts:            requestOpts{bearerToken: "  " + validToken + "  "},
			wantStatus:      http.StatusOK,
			wantToken:       validToken,
			wantTokenCalled: true,
		},

		// ── Cookie fallback ───────────────────────────────────────────────────

		{
			name:            "valid access_token cookie is used when header is absent",
			opts:            requestOpts{cookieToken: validToken},
			wantStatus:      http.StatusOK,
			wantToken:       validToken,
			wantTokenCalled: true,
		},

		// ── Whitespace trimming — cookie ──────────────────────────────────────

		{
			name:            "leading and trailing whitespace in cookie token is trimmed",
			opts:            requestOpts{cookieToken: "  " + validToken + "  "},
			wantStatus:      http.StatusOK,
			wantToken:       validToken,
			wantTokenCalled: true,
		},

		// ── Header priority over cookie ───────────────────────────────────────

		{
			// When both sources are present, the Authorization header wins.
			// The cookie value must never reach ParseAccessToken.
			name: "Authorization header takes priority over cookie when both are present",
			opts: requestOpts{
				bearerToken: validToken,
				cookieToken: "cookie.token.must.not.win",
			},
			wantStatus:      http.StatusOK,
			wantToken:       validToken,
			wantTokenCalled: true,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			// Each sub-test owns its own capturedToken — no shared mutable state
			// between parallel sub-tests. The previous implementation shared one
			// variable at the parent scope, causing a data race when a sub-test
			// that doesn't call ParseAccessToken read a value written by another.
			var capturedToken string

			svc := &mockAuthService{
				parseAccessTokenFn: func(_ context.Context, token string) (*servicejwt.Claims, error) {
					capturedToken = token
					return fakeClaims(), nil
				},
				isTokenBlacklistedFn: func(_ context.Context, _ string) (bool, error) {
					return false, nil
				},
			}

			router, _ := newTestRouter(svc)

			var w *httptest.ResponseRecorder
			if tc.rawHeader != "" {
				// Send the exact Authorization header without any auto-prefix.
				req, err := makeRawRequest(http.MethodGet, "/test", tc.rawHeader)
				require.NoError(t, err)
				w = recordResponse(router, req)
			} else {
				w = makeRequest(t, router, tc.opts)
			}

			assert.Equal(t, tc.wantStatus, w.Code)

			if tc.wantTokenCalled {
				require.NotEmpty(t, capturedToken,
					"ParseAccessToken should have been called but capturedToken is empty")
				assert.Equal(t, tc.wantToken, capturedToken,
					"token received by ParseAccessToken does not match expected value (check trimming)")
			} else {
				assert.Empty(t, capturedToken,
					"ParseAccessToken should NOT have been called — token extraction should have failed")
			}
		})
	}
}

// ─── Malformed Header Edge Cases (raw header control) ─────────────────────────
//
// These cases require setting the Authorization header to exact raw strings
// that requestOpts.bearerToken cannot express (since it auto-prepends "Bearer ").

func TestAuthMiddleware_Extraction_MalformedHeaders(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		authHeader  string
		wantStatus  int
	}{
		{
			name:       "header with scheme only and no token falls through to 401",
			authHeader: "Bearer",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "header with wrong scheme is rejected",
			authHeader: "Token valid.jwt.token",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "header with three parts is rejected",
			authHeader: "Bearer valid.jwt.token extra",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "empty Authorization header is rejected",
			authHeader: "",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "Authorization header with only whitespace is rejected",
			authHeader: "Bearer    ",
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			// No mock functions set — any auth call would panic.
			// These requests must be rejected before ParseAccessToken is reached.
			svc := &mockAuthService{}
			router, _ := newTestRouter(svc)

			req, err := makeRawRequest(http.MethodGet, "/test", tc.authHeader)
			require.NoError(t, err)

			w := recordResponse(router, req)
			assert.Equal(t, tc.wantStatus, w.Code,
				"header %q should have been rejected during extraction", tc.authHeader)
		})
	}
}

// ─── Helpers local to this file ───────────────────────────────────────────────

// makeRawRequest builds an *http.Request with the Authorization header set to
// exactly authHeader (empty string means the header is omitted entirely).
// Used by TestAuthMiddleware_Extraction_MalformedHeaders to bypass the
// "Bearer " auto-prefix that requestOpts.bearerToken applies.
func makeRawRequest(method, path, authHeader string) (*http.Request, error) {
	req, err := newHTTPRequest(method, path)
	if err != nil {
		return nil, err
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	return req, nil
}

// newHTTPRequest wraps httptest.NewRequest to keep the helpers composable.
func newHTTPRequest(method, path string) (*http.Request, error) {
	req, err := http.NewRequest(method, path, nil)
	if err != nil {
		return nil, err
	}
	return req, nil
}

// recordResponse fires req through router and returns the recorder.
func recordResponse(router interface {
	ServeHTTP(http.ResponseWriter, *http.Request)
}, req *http.Request) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}