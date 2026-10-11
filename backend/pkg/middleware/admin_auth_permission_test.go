// backend/pkg/middleware/admin_auth_permission_test.go
//
// Tests for Stage 5 of AdminMiddleware — the permission check:
//
//   Contracts proven:
//   - isAdmin=true allows the request through to the handler (c.Next() called)
//   - isAdmin=false returns 403 with exact message
//   - Response body shape on rejection contains exactly one field
//   - The 403 message is distinct from all other 403 messages in this middleware
//   - Handler is never reached when isAdmin=false
//   - The full happy path: valid context → valid UUID → not blacklisted → admin → 200
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestAdminMiddleware_Permission

package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Happy path ───────────────────────────────────────────────────────────────

// TestAdminMiddleware_Permission_AdminAllowed proves that an authenticated admin
// user reaches the handler — c.Next() is called, the probe returns 200.
func TestAdminMiddleware_Permission_AdminAllowed(t *testing.T) {
	t.Parallel()

	repo := validAdminRepo() // isAdmin=true, no error
	router := buildAdminRouter(repo, func(c *gin.Context) {
		c.Set("user_id_string", testUserID.String())
	})
	w := fireAdminRequest(router)

	assert.Equal(t, http.StatusOK, w.Code,
		"admin user must reach the handler — c.Next() must be called")
}

// TestAdminMiddleware_Permission_HandlerReached proves the handler body is
// actually executed — not just that no error was returned. Uses a capturing
// handler to confirm execution reached past the middleware.
func TestAdminMiddleware_Permission_HandlerReached(t *testing.T) {
	t.Parallel()

	handlerReached := false

	repo := validAdminRepo()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id_string", testUserID.String())
		c.Next()
	})
	router.Use(AdminMiddleware(repo))
	router.GET("/admin", func(c *gin.Context) {
		handlerReached = true
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, handlerReached,
		"handler must be executed when user is admin — c.Next() must propagate")
}

// ─── Non-admin rejection ──────────────────────────────────────────────────────

// TestAdminMiddleware_Permission_NonAdminRejected proves that a valid,
// authenticated user who is not an admin receives 403.
func TestAdminMiddleware_Permission_NonAdminRejected(t *testing.T) {
	t.Parallel()

	repo := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return false, nil // valid user, not an admin
		},
	}

	router := buildAdminRouter(repo, func(c *gin.Context) {
		c.Set("user_id_string", testUserID.String())
	})
	w := fireAdminRequest(router)

	assert.Equal(t, http.StatusForbidden, w.Code,
		"non-admin user must be rejected with 403")
}

// TestAdminMiddleware_Permission_NonAdminBodyContract proves the exact response
// body shape for a non-admin rejection — one field, exact message.
func TestAdminMiddleware_Permission_NonAdminBodyContract(t *testing.T) {
	t.Parallel()

	repo := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return false, nil
		},
	}

	router := buildAdminRouter(repo, func(c *gin.Context) {
		c.Set("user_id_string", testUserID.String())
	})
	w := fireAdminRequest(router)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	assert.Equal(t, "Authorization failed: Insufficient permissions.", body["message"],
		"non-admin rejection message must match the contract exactly")

	assert.Len(t, body, 1,
		"non-admin rejection body must contain exactly one field — no extra detail leaked")
}

// ─── Non-admin 403 is distinct from other 403 messages ───────────────────────

// TestAdminMiddleware_Permission_DistinctFrom403s proves the non-admin 403
// message is distinct from the two prerequisite 403 messages. A client or
// log aggregator must be able to distinguish all three failure modes.
//
// The three 403 messages in AdminMiddleware:
//   1. "Access denied: Authentication failure."      (key absent)
//   2. "Access denied: Invalid user identifier."     (wrong type / empty)
//   3. "Authorization failed: Insufficient permissions." (not admin)
func TestAdminMiddleware_Permission_DistinctFrom403s(t *testing.T) {
	t.Parallel()

	// 403 A: key absent
	repoA := &mockAuthRepository{}
	routerA := buildAdminRouter(repoA, nil)
	wA := fireAdminRequest(routerA)

	// 403 B: wrong type
	repoB := &mockAuthRepository{}
	routerB := buildAdminRouter(repoB, func(c *gin.Context) {
		c.Set("user_id_string", 999)
	})
	wB := fireAdminRequest(routerB)

	// 403 C: not admin
	repoC := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return false, nil
		},
	}
	routerC := buildAdminRouter(repoC, func(c *gin.Context) {
		c.Set("user_id_string", testUserID.String())
	})
	wC := fireAdminRequest(routerC)

	var bodyA, bodyB, bodyC map[string]interface{}
	require.NoError(t, json.Unmarshal(wA.Body.Bytes(), &bodyA))
	require.NoError(t, json.Unmarshal(wB.Body.Bytes(), &bodyB))
	require.NoError(t, json.Unmarshal(wC.Body.Bytes(), &bodyC))

	msgA := bodyA["message"].(string)
	msgB := bodyB["message"].(string)
	msgC := bodyC["message"].(string)

	assert.NotEqual(t, msgA, msgB, "key-absent and wrong-type messages must be distinct")
	assert.NotEqual(t, msgA, msgC, "key-absent and non-admin messages must be distinct")
	assert.NotEqual(t, msgB, msgC, "wrong-type and non-admin messages must be distinct")
}

// ─── Handler not reached on non-admin rejection ───────────────────────────────

// TestAdminMiddleware_Permission_HandlerNotReachedOnRejection proves c.Abort()
// is called — the handler must never execute when the user is not an admin.
func TestAdminMiddleware_Permission_HandlerNotReachedOnRejection(t *testing.T) {
	t.Parallel()

	handlerReached := false

	repo := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return false, nil
		},
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id_string", testUserID.String())
		c.Next()
	})
	router.Use(AdminMiddleware(repo))
	router.GET("/admin", func(c *gin.Context) {
		handlerReached = true
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.False(t, handlerReached,
		"handler must NOT be reached when user is not admin — c.Abort() must stop the chain")
}

// ─── Full happy path ──────────────────────────────────────────────────────────

// TestAdminMiddleware_Permission_FullHappyPath is an end-to-end test that
// chains AuthMiddleware → AdminMiddleware with a real (mocked) auth service
// and repo. This proves the two middleware work correctly in sequence —
// AuthMiddleware sets "user_id_string", AdminMiddleware reads it.
func TestAdminMiddleware_Permission_FullHappyPath(t *testing.T) {
	t.Parallel()

	authSvc := validSvc() // parses token, not blacklisted

	adminRepo := validAdminRepo() // isAdmin=true

	// Wire both middleware in production order.
	router := gin.New()
	router.Use(AuthMiddleware(authSvc))
	router.Use(AdminMiddleware(adminRepo))
	router.GET("/admin", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.Header.Set("Authorization", "Bearer valid.admin.token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code,
		"full chain AuthMiddleware → AdminMiddleware must allow a valid admin through")
}

// TestAdminMiddleware_Permission_FullChainNonAdmin proves the full chain
// correctly rejects a valid authenticated user who is not an admin.
func TestAdminMiddleware_Permission_FullChainNonAdmin(t *testing.T) {
	t.Parallel()

	authSvc := validSvc()

	adminRepo := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return false, nil
		},
	}

	router := gin.New()
	router.Use(AuthMiddleware(authSvc))
	router.Use(AdminMiddleware(adminRepo))
	router.GET("/admin", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.Header.Set("Authorization", "Bearer valid.user.token")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code,
		"full chain must reject a valid authenticated non-admin user with 403")
}