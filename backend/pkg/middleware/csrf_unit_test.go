// backend/pkg/middleware/csrf_unit_test.go
//
// Unit tests for the pure functions in csrf.go — no HTTP, no router,
// no middleware wiring. Each function is tested in isolation.
//
// Functions covered:
//   secureCompare(a, b string) bool
//   generateCSRFToken(length int) (string, error)
//   getCookieDomain() string
//   getCookieSameSite() http.SameSite
//   SkipCSRFForPaths(paths ...string) func(*gin.Context) bool
//   SkipCSRFForPrefixes(prefixes ...string) func(*gin.Context) bool
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestSecureCompare|TestGenerateCSRFToken|TestGetCookieDomain|TestGetCookieSameSite|TestSkipCSRF

package middleware

import (
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── secureCompare ────────────────────────────────────────────────────────────

// TestSecureCompare_EqualStrings proves identical strings return true.
func TestSecureCompare_EqualStrings(t *testing.T) {
	t.Parallel()

	assert.True(t, secureCompare("abc123", "abc123"))
	assert.True(t, secureCompare("", ""))
}

// TestSecureCompare_UnequalSameLength proves different strings of the same
// length return false — the core CSRF mismatch case.
func TestSecureCompare_UnequalSameLength(t *testing.T) {
	t.Parallel()

	tests := []struct {
		a, b string
	}{
		{"abc", "abd"},
		{"aaaa", "aaab"},
		{"aaaaaa", "aaaaab"},
		{"token1x", "token2x"},
	}

	for _, tc := range tests {
		assert.False(t, secureCompare(tc.a, tc.b),
			"secureCompare(%q, %q) must return false", tc.a, tc.b)
	}
}

// TestSecureCompare_DifferentLengths proves strings of different lengths
// always return false — regardless of content.
func TestSecureCompare_DifferentLengths(t *testing.T) {
	t.Parallel()

	assert.False(t, secureCompare("abc", "abcd"),
		"different lengths must return false")
	assert.False(t, secureCompare("", "a"),
		"empty vs non-empty must return false")
	assert.False(t, secureCompare("a", ""),
		"non-empty vs empty must return false")
	assert.False(t, secureCompare("longer", "short"),
		"longer vs shorter must return false")
}

// TestSecureCompare_EmptyBothEmpty proves two empty strings are equal —
// edge case that must not panic.
func TestSecureCompare_EmptyBothEmpty(t *testing.T) {
	t.Parallel()

	assert.True(t, secureCompare("", ""),
		"two empty strings must be considered equal")
}

// TestSecureCompare_RealisticTokens proves the function works correctly on
// realistic 64-char hex CSRF tokens (output of generateCSRFToken(32)).
func TestSecureCompare_RealisticTokens(t *testing.T) {
	t.Parallel()

	token := "a3f2e1d4c5b6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
	same := "a3f2e1d4c5b6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
	diff := "b3f2e1d4c5b6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"

	assert.True(t, secureCompare(token, same),
		"identical 64-char tokens must match")
	assert.False(t, secureCompare(token, diff),
		"tokens differing in first byte must not match")
}

// ─── generateCSRFToken ────────────────────────────────────────────────────────

// TestGenerateCSRFToken_Length proves the output length equals length*2 —
// hex encoding doubles the byte count.
func TestGenerateCSRFToken_Length(t *testing.T) {
	t.Parallel()

	tests := []struct {
		length         int
		wantHexLength  int
	}{
		{length: 16, wantHexLength: 32},
		{length: 32, wantHexLength: 64}, // default CSRFTokenLength
		{length: 64, wantHexLength: 128},
	}

	for _, tc := range tests {
		tc := tc
		t.Run("", func(t *testing.T) {
			t.Parallel()

			token, err := generateCSRFToken(tc.length)
			require.NoError(t, err)
			assert.Len(t, token, tc.wantHexLength,
				"generateCSRFToken(%d) must produce a %d-char hex string",
				tc.length, tc.wantHexLength)
		})
	}
}

// TestGenerateCSRFToken_IsValidHex proves the output is valid lowercase hex —
// callers pass it directly to cookie and header comparison.
func TestGenerateCSRFToken_IsValidHex(t *testing.T) {
	t.Parallel()

	token, err := generateCSRFToken(32)
	require.NoError(t, err)

	decoded, hexErr := hex.DecodeString(token)
	assert.NoError(t, hexErr,
		"generated token must be valid hex — got %q", token)
	assert.Len(t, decoded, 32,
		"decoded token must be 32 bytes")
}

// TestGenerateCSRFToken_Uniqueness proves two consecutive calls produce
// different tokens — tokens must not be predictable or reused.
func TestGenerateCSRFToken_Uniqueness(t *testing.T) {
	t.Parallel()

	token1, err1 := generateCSRFToken(32)
	token2, err2 := generateCSRFToken(32)

	require.NoError(t, err1)
	require.NoError(t, err2)

	assert.NotEqual(t, token1, token2,
		"consecutive generateCSRFToken calls must produce different tokens — "+
			"reuse would break CSRF protection")
}

// TestGenerateCSRFToken_DefaultLength proves CSRFTokenLength (32) produces
// a 64-char hex token — the value used throughout the middleware.
func TestGenerateCSRFToken_DefaultLength(t *testing.T) {
	t.Parallel()

	token, err := generateCSRFToken(CSRFTokenLength)
	require.NoError(t, err)
	assert.Len(t, token, 64,
		"default CSRFTokenLength must produce a 64-char hex token")
}

// ─── getCookieDomain ──────────────────────────────────────────────────────────

// TestGetCookieDomain_Empty proves empty COOKIE_DOMAIN returns "" —
// required for localhost development where domain restriction breaks cookies.
func TestGetCookieDomain_Empty(t *testing.T) {
	t.Setenv("COOKIE_DOMAIN", "")
	assert.Equal(t, "", getCookieDomain())
}

// TestGetCookieDomain_Localhost proves "localhost" returns "" —
// browsers reject cookies with domain=localhost.
func TestGetCookieDomain_Localhost(t *testing.T) {
	t.Setenv("COOKIE_DOMAIN", "localhost")
	assert.Equal(t, "", getCookieDomain(),
		"localhost domain must return empty string — "+
			"browsers reject Set-Cookie with Domain=localhost")
}

// TestGetCookieDomain_ProductionDomain proves a real domain is returned as-is.
func TestGetCookieDomain_ProductionDomain(t *testing.T) {
	t.Setenv("COOKIE_DOMAIN", "eventify.com")
	assert.Equal(t, "eventify.com", getCookieDomain())
}

// TestGetCookieDomain_SubdomainDomain proves a subdomain is returned as-is.
func TestGetCookieDomain_SubdomainDomain(t *testing.T) {
	t.Setenv("COOKIE_DOMAIN", "api.eventify.com")
	assert.Equal(t, "api.eventify.com", getCookieDomain())
}

// ─── getCookieSameSite ────────────────────────────────────────────────────────

// TestGetCookieSameSite_Variants proves all four COOKIE_SAMESITE values map
// to the correct http.SameSite constant.
func TestGetCookieSameSite_Variants(t *testing.T) {
	tests := []struct {
		// Cannot use t.Parallel() — t.Setenv modifies process-wide environment.
		envValue string
		want     http.SameSite
	}{
		{envValue: "strict", want: http.SameSiteStrictMode},
		{envValue: "none", want: http.SameSiteNoneMode},
		{envValue: "lax", want: http.SameSiteLaxMode},
		{envValue: "", want: http.SameSiteLaxMode},          // default
		{envValue: "unknown", want: http.SameSiteLaxMode},   // unknown falls to default
		{envValue: "STRICT", want: http.SameSiteLaxMode},    // case-sensitive — uppercase falls to default
	}

	for _, tc := range tests {
		t.Run(tc.envValue, func(t *testing.T) {
			t.Setenv("COOKIE_SAMESITE", tc.envValue)
			result := getCookieSameSite()
			assert.Equal(t, tc.want, result,
				"COOKIE_SAMESITE=%q must return %v", tc.envValue, tc.want)
		})
	}
}

// TestGetCookieSameSite_DefaultIsLax proves the default (unset env) is LaxMode —
// the safest default that works for same-site requests.
func TestGetCookieSameSite_DefaultIsLax(t *testing.T) {
	t.Setenv("COOKIE_SAMESITE", "")
	assert.Equal(t, http.SameSiteLaxMode, getCookieSameSite(),
		"default SameSite must be Lax — not None (too permissive) or Strict (too restrictive)")
}

// ─── SkipCSRFForPaths ─────────────────────────────────────────────────────────

// newGinContextWithPath builds a gin.Context with the given request path
// for testing Skip functions.
func newGinContextWithPath(path string) *gin.Context {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, path, nil)
	return c
}

// TestSkipCSRFForPaths_MatchingPath proves a registered path returns true.
func TestSkipCSRFForPaths_MatchingPath(t *testing.T) {
	t.Parallel()

	skip := SkipCSRFForPaths("/webhooks/stripe", "/public/health")

	assert.True(t, skip(newGinContextWithPath("/webhooks/stripe")),
		"/webhooks/stripe must be skipped")
	assert.True(t, skip(newGinContextWithPath("/public/health")),
		"/public/health must be skipped")
}

// TestSkipCSRFForPaths_NonMatchingPath proves an unregistered path returns false.
func TestSkipCSRFForPaths_NonMatchingPath(t *testing.T) {
	t.Parallel()

	skip := SkipCSRFForPaths("/webhooks/stripe")

	assert.False(t, skip(newGinContextWithPath("/api/orders")),
		"non-registered path must not be skipped")
	assert.False(t, skip(newGinContextWithPath("/webhooks/stripe/extra")),
		"path with extra segments must not match exact path")
}

// TestSkipCSRFForPaths_EmptyPaths proves an empty skip list never skips.
func TestSkipCSRFForPaths_EmptyPaths(t *testing.T) {
	t.Parallel()

	skip := SkipCSRFForPaths()

	assert.False(t, skip(newGinContextWithPath("/any/path")),
		"empty skip list must never skip any path")
}

// ─── SkipCSRFForPrefixes ──────────────────────────────────────────────────────

// TestSkipCSRFForPrefixes_MatchingPrefix proves paths starting with a registered
// prefix return true.
func TestSkipCSRFForPrefixes_MatchingPrefix(t *testing.T) {
	t.Parallel()

	skip := SkipCSRFForPrefixes("/webhooks/", "/internal/")

	assert.True(t, skip(newGinContextWithPath("/webhooks/stripe")))
	assert.True(t, skip(newGinContextWithPath("/webhooks/paystack")))
	assert.True(t, skip(newGinContextWithPath("/internal/health")))
}

// TestSkipCSRFForPrefixes_NonMatchingPrefix proves paths not starting with any
// registered prefix return false.
func TestSkipCSRFForPrefixes_NonMatchingPrefix(t *testing.T) {
	t.Parallel()

	skip := SkipCSRFForPrefixes("/webhooks/")

	assert.False(t, skip(newGinContextWithPath("/api/orders")),
		"non-matching prefix must return false")
	assert.False(t, skip(newGinContextWithPath("/webhooks")),
		"path equal to prefix without trailing slash must not match '/webhooks/'")
}

// TestSkipCSRFForPrefixes_EmptyPrefixes proves an empty prefix list never skips.
func TestSkipCSRFForPrefixes_EmptyPrefixes(t *testing.T) {
	t.Parallel()

	skip := SkipCSRFForPrefixes()

	assert.False(t, skip(newGinContextWithPath("/any/path")))
}

// TestSkipCSRFForPrefixes_EmptyPrefix proves an empty string prefix matches
// every path — documents the edge case where "" is a valid prefix of all strings.
func TestSkipCSRFForPrefixes_EmptyStringPrefix(t *testing.T) {
	t.Parallel()

	skip := SkipCSRFForPrefixes("")

	assert.True(t, skip(newGinContextWithPath("/any/path")),
		"empty string prefix matches every path — callers must not register \"\"")
}