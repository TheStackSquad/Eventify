// backend/pkg/middleware/admin_auth_db_test.go
//
// Tests for Stage 4 of AdminMiddleware — the IsUserAdmin DB call:
//
//   Happy path:
//   - IsUserAdmin returning (true, nil) allows the request through
//   - IsUserAdmin returning (false, nil) denies with 403 (covered in permission tests)
//
//   Error paths:
//   - Any error from IsUserAdmin currently returns 500
//   - The "user not found" → 403 branch is DEAD CODE — documented below
//
//   The dead code bug:
//
//     if errors.Is(err, errors.New("user not found")) {  // always false
//         c.JSON(403, ...)
//     } else {
//         c.JSON(500, ...)                               // always reached
//     }
//
//   errors.New() creates a new error instance on every call. errors.Is() uses
//   pointer equality for non-wrapped errors. These two never match — the 403
//   branch can never be reached regardless of what error IsUserAdmin returns.
//
//   Fix: use a package-level sentinel error:
//     var ErrUserNotFound = errors.New("user not found")
//   Then: errors.Is(err, ErrUserNotFound) works correctly.
//
//   These tests document current behaviour (500 for all errors) and provide
//   the skipped test that should pass after the fix.
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestAdminMiddleware_DB

package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── DB error → 500 (current behaviour) ──────────────────────────────────────

// TestAdminMiddleware_DB_ErrorReturns500 proves that any error from IsUserAdmin
// currently returns 500 — regardless of the error message content.
func TestAdminMiddleware_DB_ErrorReturns500(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		dbErr  error
	}{
		{
			name:  "generic database error",
			dbErr: errors.New("pq: connection refused"),
		},
		{
			name:  "timeout error",
			dbErr: errors.New("context deadline exceeded"),
		},
		{
			name:  "string 'user not found' error — currently still 500 due to dead code bug",
			dbErr: errors.New("user not found"),
		},
		{
			name:  "wrapped user not found error — currently still 500",
			dbErr: fmt.Errorf("db query failed: %w", errors.New("user not found")),
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			repo := &mockAuthRepository{
				isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
					return false, tc.dbErr
				},
			}

			router := buildAdminRouter(repo, func(c *gin.Context) {
				c.Set("user_id_string", testUserID.String())
			})
			w := fireAdminRequest(router)

			// TODO: the "user not found" case should return 403 after fixing
			// the errors.Is(err, errors.New(...)) dead code bug.
			assert.Equal(t, http.StatusInternalServerError, w.Code,
				"CURRENT BEHAVIOUR: all DB errors return 500 because the "+
					"errors.Is(err, errors.New(...)) check is dead code — "+
					"errors.New() creates a new instance on every call, "+
					"so pointer equality never matches")

			var body map[string]interface{}
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
			assert.Equal(t, "Internal error checking user role.", body["message"],
				"DB error message must not leak internal error detail")
		})
	}
}

// ─── The dead code bug ────────────────────────────────────────────────────────

// TestAdminMiddleware_DB_DeadCodeBug explicitly documents the broken
// errors.Is(err, errors.New("user not found")) check.
//
// This test proves the bug by asserting the WRONG behaviour (500 instead of 403)
// and explaining exactly why.
func TestAdminMiddleware_DB_DeadCodeBug(t *testing.T) {
	t.Parallel()

	// This is the exact error string the middleware tries to match.
	userNotFoundErr := errors.New("user not found")

	repo := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return false, userNotFoundErr
		},
	}

	router := buildAdminRouter(repo, func(c *gin.Context) {
		c.Set("user_id_string", testUserID.String())
	})
	w := fireAdminRequest(router)

	// BUG: this returns 500, not 403.
	// errors.Is(err, errors.New("user not found")) compares err against a
	// brand-new error instance created at check time — they never match
	// because errors.New() allocates a new *errorString each call.
	//
	// The middleware code:
	//   if errors.Is(err, errors.New("user not found")) {  // always false
	//       c.JSON(403, ...)
	//   } else {
	//       c.JSON(500, ...)  // always reached
	//   }
	assert.Equal(t, http.StatusInternalServerError, w.Code,
		"BUG DOCUMENTED: errors.Is(err, errors.New(...)) is always false — "+
			"user not found should return 403 but currently returns 500")
}

// TestAdminMiddleware_DB_DeadCodeFix is the test that should pass AFTER fixing
// the dead code bug. It is skipped until then.
//
// Fix: replace the inline errors.New("user not found") with a package-level
// sentinel and return that sentinel from IsUserAdmin when the user doesn't exist:
//
//	var ErrUserNotFound = errors.New("user not found")  // in repository package
//	if errors.Is(err, repoauth.ErrUserNotFound) { ... } // in middleware
func TestAdminMiddleware_DB_DeadCodeFix(t *testing.T) {
	t.Skip("dead code bug not yet fixed — remove skip after introducing sentinel error")
	t.Parallel()

	// Sentinel error that the repository would return.
	// Replace with the actual sentinel once defined in the repo package.
	var ErrUserNotFound = errors.New("user not found")

	repo := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return false, ErrUserNotFound
		},
	}

	router := buildAdminRouter(repo, func(c *gin.Context) {
		c.Set("user_id_string", testUserID.String())
	})
	w := fireAdminRequest(router)

	assert.Equal(t, http.StatusForbidden, w.Code,
		"user not found must return 403 after sentinel error fix")

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "Access denied: User not found.", body["message"])
}

// ─── Error response leaks no internal detail ─────────────────────────────────

// TestAdminMiddleware_DB_ErrorBodyOpaque proves the 500 response body never
// contains the internal error string — infrastructure failures must not be
// leaked to the client.
func TestAdminMiddleware_DB_ErrorBodyOpaque(t *testing.T) {
	t.Parallel()

	internalErr := errors.New("pq: SSL connection required but not provided by client")

	repo := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			return false, internalErr
		},
	}

	router := buildAdminRouter(repo, func(c *gin.Context) {
		c.Set("user_id_string", testUserID.String())
	})
	w := fireAdminRequest(router)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	bodyStr := w.Body.String()
	assert.NotContains(t, bodyStr, internalErr.Error(),
		"internal DB error must never be leaked to the client")
	assert.NotContains(t, bodyStr, "pq:",
		"database driver prefix must never appear in the response")
	assert.NotContains(t, bodyStr, "SSL",
		"infrastructure detail must never appear in the response")
}

// ─── IsUserAdmin receives the correct UUID ────────────────────────────────────

// TestAdminMiddleware_DB_CorrectUUIDPassed proves the UUID passed to IsUserAdmin
// is the one parsed from context — not a zero value, not a different user.
func TestAdminMiddleware_DB_CorrectUUIDPassed(t *testing.T) {
	t.Parallel()

	// Use a UUID that is distinct from testUserID to rule out accidental matches.
	targetUserID := uuid.MustParse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")

	var receivedID uuid.UUID
	repo := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, id uuid.UUID) (bool, error) {
			receivedID = id
			return true, nil
		},
	}

	router := buildAdminRouter(repo, func(c *gin.Context) {
		c.Set("user_id_string", targetUserID.String())
	})
	w := fireAdminRequest(router)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, targetUserID, receivedID,
		"IsUserAdmin must receive exactly the UUID parsed from user_id_string — "+
			"not testUserID, not uuid.Nil, not a different value")
}

// ─── IsUserAdmin called exactly once ─────────────────────────────────────────

// TestAdminMiddleware_DB_CalledExactlyOnce proves the DB is hit exactly once
// per request — no retry logic, no double-check.
func TestAdminMiddleware_DB_CalledExactlyOnce(t *testing.T) {
	t.Parallel()

	var callCount int
	repo := &mockAuthRepository{
		isUserAdminFn: func(_ context.Context, _ uuid.UUID) (bool, error) {
			callCount++
			return true, nil
		},
	}

	router := buildAdminRouter(repo, func(c *gin.Context) {
		c.Set("user_id_string", testUserID.String())
	})
	w := fireAdminRequest(router)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, 1, callCount,
		"IsUserAdmin must be called exactly once per request")
}