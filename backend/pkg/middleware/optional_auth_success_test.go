//backend/pkg/middleware/optional_auth_success_test.go

// backend/pkg/middleware/optional_auth_success_test.go
//
// Tests for the authenticated success path of OptionalAuth.
//
// When all validation passes, OptionalAuth sets 4 context keys:
//   - "user_id"        → uuid.UUID
//   - "user_id_string" → string
//   - "authenticated"  → bool (true)
//   - "token_type"     → string
//
// Contracts proven:
//   - All 4 keys are set on success
//   - Each key has the correct type
//   - Each key has the correct value
//   - user_id and user_id_string are consistent (uuid.String() == user_id_string)
//   - token_type reflects the value from claims
//   - Handler is always reached on success
//   - Token string from cookie is passed verbatim to ValidateAccessToken
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestOptionalAuth_Success

package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	servicejwt "github.com/eventify/backend/pkg/services/jwt"
)

// ─── All 4 context keys are set ───────────────────────────────────────────────

// TestOptionalAuth_Success_AllKeysSet proves all four context keys are present
// after a successful authentication.
func TestOptionalAuth_Success_AllKeysSet(t *testing.T) {
	t.Parallel()

	svc := validJWTValidator()
	router, captured := buildOptionalAuthRouter(svc)
	w := fireOptionalRequest(router, "valid.token")

	require.Equal(t, http.StatusOK, w.Code)

	ctx := *captured
	assert.Contains(t, ctx, "user_id", "user_id must be set on success")
	assert.Contains(t, ctx, "user_id_string", "user_id_string must be set on success")
	assert.Contains(t, ctx, "authenticated", "authenticated must be set on success")
	assert.Contains(t, ctx, "token_type", "token_type must be set on success")
}

// ─── Correct types ────────────────────────────────────────────────────────────

// TestOptionalAuth_Success_CorrectTypes proves each context key holds the
// correct Go type — not just any non-nil value.
func TestOptionalAuth_Success_CorrectTypes(t *testing.T) {
	t.Parallel()

	svc := validJWTValidator()
	router, captured := buildOptionalAuthRouter(svc)
	w := fireOptionalRequest(router, "valid.token")

	require.Equal(t, http.StatusOK, w.Code)
	ctx := *captured

	_, isUUID := ctx["user_id"].(uuid.UUID)
	assert.True(t, isUUID,
		"user_id must be stored as uuid.UUID — handlers use it directly in DB queries")

	_, isString := ctx["user_id_string"].(string)
	assert.True(t, isString,
		"user_id_string must be stored as string — used for logging and response fields")

	authVal, isBool := ctx["authenticated"].(bool)
	assert.True(t, isBool,
		"authenticated must be stored as bool — IsAuthenticated() depends on this")
	assert.True(t, authVal,
		"authenticated must be true on success")

	_, isTokenTypeString := ctx["token_type"].(string)
	assert.True(t, isTokenTypeString,
		"token_type must be stored as string")
}

// ─── Correct values ───────────────────────────────────────────────────────────

// TestOptionalAuth_Success_CorrectValues proves each context key holds the
// value derived from the claims — not a zero value, not a hardcoded default.
func TestOptionalAuth_Success_CorrectValues(t *testing.T) {
	t.Parallel()

	svc := validJWTValidator() // returns fakeClaims(): UserID=testUserID, TokenType="access"
	router, captured := buildOptionalAuthRouter(svc)
	w := fireOptionalRequest(router, "valid.token")

	require.Equal(t, http.StatusOK, w.Code)
	ctx := *captured

	assert.Equal(t, testUserID, ctx["user_id"],
		"user_id must equal the parsed UUID from claims.UserID")
	assert.Equal(t, testUserID.String(), ctx["user_id_string"],
		"user_id_string must equal claims.UserID exactly")
	assert.Equal(t, true, ctx["authenticated"],
		"authenticated must be true")
	assert.Equal(t, "access", ctx["token_type"],
		"token_type must equal claims.TokenType")
}

// ─── user_id and user_id_string consistency ───────────────────────────────────

// TestOptionalAuth_Success_UUIDConsistency proves user_id.String() == user_id_string.
// Handlers that use both keys for different purposes must get consistent values.
func TestOptionalAuth_Success_UUIDConsistency(t *testing.T) {
	t.Parallel()

	svc := validJWTValidator()
	router, captured := buildOptionalAuthRouter(svc)
	w := fireOptionalRequest(router, "valid.token")

	require.Equal(t, http.StatusOK, w.Code)
	ctx := *captured

	userID := ctx["user_id"].(uuid.UUID)
	userIDString := ctx["user_id_string"].(string)

	assert.Equal(t, userID.String(), userIDString,
		"user_id.String() must equal user_id_string — inconsistency here causes "+
			"silent mismatches in handlers that use both keys")
}

// ─── token_type reflects claims ───────────────────────────────────────────────

// TestOptionalAuth_Success_TokenTypeFromClaims proves token_type is taken
// directly from claims.TokenType — not hardcoded.
func TestOptionalAuth_Success_TokenTypeFromClaims(t *testing.T) {
	t.Parallel()

	customTokenType := "refresh" // unusual but should be stored as-is

	svc := &mockJWTValidator{
		validateAccessTokenFn: func(_ string) (*servicejwt.Claims, error) {
			return &servicejwt.Claims{
				UserID:    testUserID.String(),
				TokenType: customTokenType,
			}, nil
		},
	}
	router, captured := buildOptionalAuthRouter(svc)
	w := fireOptionalRequest(router, "valid.token")

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, customTokenType, (*captured)["token_type"],
		"token_type must be taken from claims.TokenType, not hardcoded")
}

// ─── Handler is reached ───────────────────────────────────────────────────────

// TestOptionalAuth_Success_HandlerReached proves c.Next() is called on the
// success path — the handler executes after the middleware.
func TestOptionalAuth_Success_HandlerReached(t *testing.T) {
	t.Parallel()

	handlerReached := false

	svc := validJWTValidator()
	router := gin.New()
	router.Use(OptionalAuth(svc))
	router.GET("/test", func(c *gin.Context) {
		handlerReached = true
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: "valid.token"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, handlerReached,
		"handler must be reached on successful authentication — c.Next() must be called")
}

// ─── Token passed verbatim to ValidateAccessToken ────────────────────────────

// TestOptionalAuth_Success_TokenPassthrough proves the exact cookie value is
// passed to ValidateAccessToken — no trimming, no modification.
func TestOptionalAuth_Success_TokenPassthrough(t *testing.T) {
	t.Parallel()

	const cookieToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.realistic.token"
	var receivedToken string

	svc := &mockJWTValidator{
		validateAccessTokenFn: func(tokenString string) (*servicejwt.Claims, error) {
			receivedToken = tokenString
			return fakeClaims(), nil
		},
	}
	router, _ := buildOptionalAuthRouter(svc)
	w := fireOptionalRequest(router, cookieToken)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, cookieToken, receivedToken,
		"cookie token must be passed verbatim to ValidateAccessToken")
}

// ─── UUID case variants all succeed ──────────────────────────────────────────

// TestOptionalAuth_Success_UUIDCaseVariants proves that UUID strings in
// different cases all parse correctly to the same uuid.UUID value.
func TestOptionalAuth_Success_UUIDCaseVariants(t *testing.T) {
	t.Parallel()

	variants := []struct {
		name   string
		userID string
	}{
		{name: "lowercase", userID: "550e8400-e29b-41d4-a716-446655440000"},
		{name: "uppercase", userID: "550E8400-E29B-41D4-A716-446655440000"},
		{name: "mixed case", userID: "550e8400-E29B-41d4-A716-446655440000"},
	}

	for _, tc := range variants {
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
			w := fireOptionalRequest(router, "valid.token")

			require.Equal(t, http.StatusOK, w.Code)
			userID := (*captured)["user_id"].(uuid.UUID)
			assert.Equal(t, testUserID, userID,
				"UUID variant %q must parse to the same uuid.UUID value", tc.userID)
		})
	}
}

// ─── No context keys from AuthMiddleware are required ─────────────────────────

// TestOptionalAuth_Success_NoPrerequisite proves OptionalAuth is self-contained —
// it does not require "user_id" or "user_id_string" to already be in context.
// Unlike AdminMiddleware, it sets its own context from the JWT claims directly.
func TestOptionalAuth_Success_NoPrerequisite(t *testing.T) {
	t.Parallel()

	svc := validJWTValidator()

	// Router with no seeding middleware — bare OptionalAuth.
	router := gin.New()
	router.Use(OptionalAuth(svc))
	router.GET("/test", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: "valid.token"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code,
		"OptionalAuth must not require any prior middleware to have run")
}