// backend/pkg/middleware/rate_limit_unit_test.go
//
// Unit tests for the two pure functions in rate_limit_middleware.go:
//
//   isLocalhost(addr string) bool
//   getClientIP(c *gin.Context) string
//
// No router, no middleware wiring, no rate limiter involved.
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestIsLocalhost|TestGetClientIP

package middleware

import (
	"net/http/httptest"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// ─── isLocalhost ──────────────────────────────────────────────────────────────

func TestIsLocalhost_IPv4Loopback(t *testing.T) {
	t.Parallel()
	assert.True(t, isLocalhost("127.0.0.1"), "127.0.0.1 must be localhost")
}

func TestIsLocalhost_IPv6Loopback(t *testing.T) {
	t.Parallel()
	assert.True(t, isLocalhost("::1"), "::1 must be localhost")
}

func TestIsLocalhost_LocalhostString(t *testing.T) {
	t.Parallel()
	assert.True(t, isLocalhost("localhost"), "localhost string must be localhost")
}

func TestIsLocalhost_127Prefix(t *testing.T) {
	t.Parallel()
	assert.True(t, isLocalhost("127.0.0.2"), "127.0.0.2 must be localhost")
	assert.True(t, isLocalhost("127.255.255.255"), "127.255.255.255 must be localhost")
	assert.True(t, isLocalhost("127.1.2.3"), "127.1.2.3 must be localhost")
}

func TestIsLocalhost_Empty(t *testing.T) {
	t.Parallel()
	assert.True(t, isLocalhost(""), "empty address must be treated as localhost")
}

func TestIsLocalhost_WithPort_IPv4(t *testing.T) {
	t.Parallel()
	assert.True(t, isLocalhost("127.0.0.1:8080"),
		"127.0.0.1:8080 must be localhost — port must be stripped")
}

func TestIsLocalhost_WithPort_IPv6(t *testing.T) {
	t.Parallel()
	assert.True(t, isLocalhost("[::1]:8080"),
		"[::1]:8080 must be localhost — port and brackets must be stripped")
}

func TestIsLocalhost_WithPort_Localhost(t *testing.T) {
	t.Parallel()
	assert.True(t, isLocalhost("localhost:3000"),
		"localhost:3000 must be localhost — port must be stripped")
}

func TestIsLocalhost_NonLocal_PublicIPv4(t *testing.T) {
	t.Parallel()
	assert.False(t, isLocalhost("192.168.1.1"), "192.168.1.1 must not be localhost")
	assert.False(t, isLocalhost("10.0.0.1"), "10.0.0.1 must not be localhost")
	assert.False(t, isLocalhost("8.8.8.8"), "8.8.8.8 must not be localhost")
}

func TestIsLocalhost_NonLocal_WithPort(t *testing.T) {
	t.Parallel()
	assert.False(t, isLocalhost("192.168.1.1:443"),
		"192.168.1.1:443 must not be localhost after port stripping")
}

func TestIsLocalhost_NonLocal_128Prefix(t *testing.T) {
	t.Parallel()
	assert.False(t, isLocalhost("128.0.0.1"),
		"128.0.0.1 must not be localhost — only 127.x.x.x is loopback")
}

func TestIsLocalhost_NonLocal_PublicIPv6(t *testing.T) {
	t.Parallel()
	assert.False(t, isLocalhost("2001:db8::1"),
		"public IPv6 address must not be localhost")
}

// ─── getClientIP ──────────────────────────────────────────────────────────────

// newGinContextWithHeaders builds a gin.Context with the given HTTP headers set.
func newGinContextWithHeaders(headers map[string]string, remoteAddr string) *gin.Context {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if remoteAddr != "" {
		req.RemoteAddr = remoteAddr
	}
	c.Request = req
	return c
}

// TestGetClientIP_XRealIP proves X-Real-IP takes highest priority.
func TestGetClientIP_XRealIP(t *testing.T) {
	t.Parallel()

	c := newGinContextWithHeaders(map[string]string{
		"X-Real-IP":       "1.2.3.4",
		"X-Forwarded-For": "5.6.7.8",
	}, "9.10.11.12:5000")

	assert.Equal(t, "1.2.3.4", getClientIP(c),
		"X-Real-IP must take priority over X-Forwarded-For and RemoteAddr")
}

// TestGetClientIP_XForwardedFor_Single proves X-Forwarded-For is used when
// X-Real-IP is absent.
func TestGetClientIP_XForwardedFor_Single(t *testing.T) {
	t.Parallel()

	c := newGinContextWithHeaders(map[string]string{
		"X-Forwarded-For": "5.6.7.8",
	}, "9.10.11.12:5000")

	assert.Equal(t, "5.6.7.8", getClientIP(c),
		"X-Forwarded-For must be used when X-Real-IP is absent")
}

// TestGetClientIP_XForwardedFor_MultipleIPs proves the first IP is taken from
// a comma-separated X-Forwarded-For list — the original client IP.
func TestGetClientIP_XForwardedFor_MultipleIPs(t *testing.T) {
	t.Parallel()

	c := newGinContextWithHeaders(map[string]string{
		"X-Forwarded-For": "1.1.1.1, 2.2.2.2, 3.3.3.3",
	}, "9.10.11.12:5000")

	assert.Equal(t, "1.1.1.1", getClientIP(c),
		"first IP in X-Forwarded-For chain must be used — that is the original client")
}

// TestGetClientIP_XForwardedFor_Whitespace proves whitespace around IPs in
// X-Forwarded-For is trimmed correctly.
func TestGetClientIP_XForwardedFor_Whitespace(t *testing.T) {
	t.Parallel()

	c := newGinContextWithHeaders(map[string]string{
		"X-Forwarded-For": "  1.1.1.1  , 2.2.2.2",
	}, "")

	assert.Equal(t, "1.1.1.1", getClientIP(c),
		"whitespace around first IP in X-Forwarded-For must be trimmed")
}

// TestGetClientIP_RemoteAddr_Fallback proves RemoteAddr is used when no
// proxy headers are present.
func TestGetClientIP_RemoteAddr_Fallback(t *testing.T) {
	t.Parallel()

	c := newGinContextWithHeaders(nil, "9.10.11.12:5000")

	assert.Equal(t, "9.10.11.12:5000", getClientIP(c),
		"RemoteAddr must be used as fallback when no proxy headers are present")
}

// TestGetClientIP_AllHeadersEmpty proves RemoteAddr is used when headers
// are present but empty.
func TestGetClientIP_AllHeadersEmpty(t *testing.T) {
	t.Parallel()

	c := newGinContextWithHeaders(map[string]string{
		"X-Real-IP":       "",
		"X-Forwarded-For": "",
	}, "fallback:1234")

	assert.Equal(t, "fallback:1234", getClientIP(c),
		"empty headers must fall through to RemoteAddr")
}

// TestGetClientIP_Priority proves the full priority order:
// X-Real-IP > X-Forwarded-For > RemoteAddr.
func TestGetClientIP_Priority(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		headers    map[string]string
		remoteAddr string
		wantIP     string
	}{
		{
			name:       "X-Real-IP beats all",
			headers:    map[string]string{"X-Real-IP": "1.1.1.1", "X-Forwarded-For": "2.2.2.2"},
			remoteAddr: "3.3.3.3:80",
			wantIP:     "1.1.1.1",
		},
		{
			name:       "X-Forwarded-For beats RemoteAddr",
			headers:    map[string]string{"X-Forwarded-For": "2.2.2.2"},
			remoteAddr: "3.3.3.3:80",
			wantIP:     "2.2.2.2",
		},
		{
			name:       "RemoteAddr as last resort",
			headers:    nil,
			remoteAddr: "3.3.3.3:80",
			wantIP:     "3.3.3.3:80",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			c := newGinContextWithHeaders(tc.headers, tc.remoteAddr)
			assert.Equal(t, tc.wantIP, getClientIP(c))
		})
	}
}