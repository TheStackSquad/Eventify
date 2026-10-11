// backend/pkg/middleware/context_helpers_test.go
//
// Tests for ExtractVendorID — a request-scoped helper that resolves a vendor
// UUID from the Gin context, with a DB fallback and request-level caching.
//
// ExtractVendorID is not a middleware — it is called directly from handlers.
// Tests construct a *gin.Context manually rather than using a test router.
//
// Stages proven:
//   Stage 1 — Cache hit:
//   - "vendor_id" already in context as uuid.UUID → returned immediately
//   - DB is never called on a cache hit
//   - Wrong type stored under "vendor_id" falls through to Stage 2
//
//   Stage 2 — User ID extraction:
//   - "user_id" absent → error "authentication required"
//   - "user_id" is uuid.UUID → used directly
//   - "user_id" is valid string → parsed to uuid.UUID
//   - "user_id" is invalid string → error "invalid user identity format"
//   - "user_id" is wrong type → error "identity type mismatch"
//
//   Stage 3 — DB lookup:
//   - GetByOwnerID success → vendor ID returned
//   - GetByOwnerID error → error "vendor identity not found"
//   - Correct ownerID is passed to GetByOwnerID
//
//   Stage 4 — Cache write:
//   - After DB hit, "vendor_id" is set in context
//   - Second call returns cached value without hitting DB again
//
// Run just this file:
//
//	go test ./pkg/middleware/ -v -run TestExtractVendorID

package middleware

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Test context builder ─────────────────────────────────────────────────────

// newGinContext builds a minimal *gin.Context suitable for calling
// ExtractVendorID directly. It is not wired to a router — the context
// is constructed in-process so tests can seed it with arbitrary values.
func newGinContext() *gin.Context {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	return c
}

// ─── Stage 1: Cache hit ───────────────────────────────────────────────────────

// TestExtractVendorID_CacheHit_ReturnsImmediately proves that when "vendor_id"
// is already in context as a uuid.UUID, it is returned without touching the DB.
func TestExtractVendorID_CacheHit_ReturnsImmediately(t *testing.T) {
	t.Parallel()

	// No getByOwnerIDFn set — any DB call panics loudly.
	repo := &mockVendorRepository{}

	c := newGinContext()
	c.Set("vendor_id", testVendorID)
	c.Set("user_id", testUserID) // present but must not be needed

	result, err := ExtractVendorID(c, repo)

	require.NoError(t, err)
	assert.Equal(t, testVendorID, result,
		"cache hit must return the exact UUID stored in context")
}

// TestExtractVendorID_CacheHit_NoDBCall proves the DB is never hit on a cache
// hit — confirmed by leaving getByOwnerIDFn nil so any call panics.
func TestExtractVendorID_CacheHit_NoDBCall(t *testing.T) {
	t.Parallel()

	dbCalled := false
	repo := &mockVendorRepository{
		getByOwnerIDFn: func(_ context.Context, _ uuid.UUID) (*models.Vendor, error) {
			dbCalled = true
			return fakeVendor(), nil
		},
	}

	c := newGinContext()
	c.Set("vendor_id", testVendorID)

	_, err := ExtractVendorID(c, repo)

	require.NoError(t, err)
	assert.False(t, dbCalled,
		"DB must not be called when vendor_id is already cached in context")
}

// TestExtractVendorID_CacheHit_WrongTypeFallsThrough proves that if "vendor_id"
// is stored as the wrong type, the cache hit is skipped and the function falls
// through to the user_id extraction stage.
func TestExtractVendorID_CacheHit_WrongTypeFallsThrough(t *testing.T) {
	t.Parallel()

	repo := validVendorRepo()

	c := newGinContext()
	c.Set("vendor_id", "not-a-uuid-type") // string, not uuid.UUID
	c.Set("user_id", testUserID)

	result, err := ExtractVendorID(c, repo)

	// Falls through to DB lookup — returns the vendor from the repo.
	require.NoError(t, err)
	assert.Equal(t, testVendorID, result,
		"wrong-type cache entry must be ignored — function must fall through to DB lookup")
}

// ─── Stage 2: User ID extraction ─────────────────────────────────────────────

// TestExtractVendorID_UserID_Absent proves that when "user_id" is not in
// context, an "authentication required" error is returned.
func TestExtractVendorID_UserID_Absent(t *testing.T) {
	t.Parallel()

	repo := &mockVendorRepository{} // no getByOwnerIDFn — DB call panics

	c := newGinContext()
	// Neither vendor_id nor user_id set.

	result, err := ExtractVendorID(c, repo)

	assert.Equal(t, uuid.Nil, result)
	require.Error(t, err)
	assert.Equal(t, "authentication required", err.Error())
}

// TestExtractVendorID_UserID_Types proves the two valid user_id types are both
// handled correctly: direct uuid.UUID and parseable string.
func TestExtractVendorID_UserID_Types(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		userIDVal interface{}
	}{
		{
			name:      "user_id stored as uuid.UUID",
			userIDVal: testUserID,
		},
		{
			name:      "user_id stored as valid UUID string",
			userIDVal: testUserID.String(),
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var receivedOwnerID uuid.UUID
			repo := &mockVendorRepository{
				getByOwnerIDFn: func(_ context.Context, ownerID uuid.UUID) (*models.Vendor, error) {
					receivedOwnerID = ownerID
					return fakeVendor(), nil
				},
			}

			c := newGinContext()
			c.Set("user_id", tc.userIDVal)

			result, err := ExtractVendorID(c, repo)

			require.NoError(t, err)
			assert.Equal(t, testVendorID, result)
			assert.Equal(t, testUserID, receivedOwnerID,
				"both user_id types must resolve to the same ownerID passed to GetByOwnerID")
		})
	}
}

// TestExtractVendorID_UserID_InvalidString proves that a non-UUID string stored
// under "user_id" returns an "invalid user identity format" error.
func TestExtractVendorID_UserID_InvalidString(t *testing.T) {
	t.Parallel()

	repo := &mockVendorRepository{} // DB call panics — must not be reached

	c := newGinContext()
	c.Set("user_id", "not-a-valid-uuid")

	result, err := ExtractVendorID(c, repo)

	assert.Equal(t, uuid.Nil, result)
	require.Error(t, err)
	assert.Equal(t, "invalid user identity format", err.Error())
}

// TestExtractVendorID_UserID_WrongType proves that an unsupported type stored
// under "user_id" returns an "identity type mismatch" error.
func TestExtractVendorID_UserID_WrongType(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value interface{}
	}{
		{name: "integer", value: 12345},
		{name: "boolean", value: true},
		{name: "nil", value: nil},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			repo := &mockVendorRepository{} // DB call panics

			c := newGinContext()
			c.Set("user_id", tc.value)

			result, err := ExtractVendorID(c, repo)

			assert.Equal(t, uuid.Nil, result)
			require.Error(t, err)
			assert.Equal(t, "identity type mismatch", err.Error(),
				"unsupported user_id type %T must return identity type mismatch", tc.value)
		})
	}
}

// ─── Stage 3: DB lookup ───────────────────────────────────────────────────────

// TestExtractVendorID_DB_Success proves a successful GetByOwnerID returns
// the vendor's ID correctly.
func TestExtractVendorID_DB_Success(t *testing.T) {
	t.Parallel()

	repo := validVendorRepo()

	c := newGinContext()
	c.Set("user_id", testUserID)

	result, err := ExtractVendorID(c, repo)

	require.NoError(t, err)
	assert.Equal(t, testVendorID, result)
}

// TestExtractVendorID_DB_Error proves any GetByOwnerID error returns a generic
// "vendor identity not found" error — no internal DB detail leaked.
func TestExtractVendorID_DB_Error(t *testing.T) {
	t.Parallel()

	internalErr := errors.New("pq: connection refused")

	repo := &mockVendorRepository{
		getByOwnerIDFn: func(_ context.Context, _ uuid.UUID) (*models.Vendor, error) {
			return nil, internalErr
		},
	}

	c := newGinContext()
	c.Set("user_id", testUserID)

	result, err := ExtractVendorID(c, repo)

	assert.Equal(t, uuid.Nil, result)
	require.Error(t, err)
	assert.Equal(t, "vendor identity not found — authentication required", err.Error(),
		"DB error must be wrapped in a generic message — internal detail must not leak")
	assert.NotEqual(t, internalErr.Error(), err.Error(),
		"the raw DB error must never be returned directly to the caller")
}

// TestExtractVendorID_DB_CorrectOwnerIDPassed proves the UUID passed to
// GetByOwnerID is exactly the one extracted from context — not uuid.Nil,
// not a different user.
func TestExtractVendorID_DB_CorrectOwnerIDPassed(t *testing.T) {
	t.Parallel()

	// Use a UUID distinct from testUserID to rule out accidental matches.
	specificUserID := uuid.MustParse("11111111-2222-3333-4444-555555555555")
	specificVendorID := uuid.MustParse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")

	var receivedOwnerID uuid.UUID
	repo := &mockVendorRepository{
		getByOwnerIDFn: func(_ context.Context, ownerID uuid.UUID) (*models.Vendor, error) {
			receivedOwnerID = ownerID
			return &models.Vendor{ID: specificVendorID, OwnerID: specificUserID}, nil
		},
	}

	c := newGinContext()
	c.Set("user_id", specificUserID)

	result, err := ExtractVendorID(c, repo)

	require.NoError(t, err)
	assert.Equal(t, specificVendorID, result)
	assert.Equal(t, specificUserID, receivedOwnerID,
		"GetByOwnerID must receive exactly the user_id from context")
}

// ─── Stage 4: Cache write ─────────────────────────────────────────────────────

// TestExtractVendorID_CacheWrite_AfterDBHit proves that after a successful DB
// lookup, the vendor_id is stored in context for subsequent calls.
func TestExtractVendorID_CacheWrite_AfterDBHit(t *testing.T) {
	t.Parallel()

	repo := validVendorRepo()

	c := newGinContext()
	c.Set("user_id", testUserID)

	// First call — hits the DB.
	result, err := ExtractVendorID(c, repo)
	require.NoError(t, err)
	require.Equal(t, testVendorID, result)

	// Assert "vendor_id" is now in context.
	cached, exists := c.Get("vendor_id")
	assert.True(t, exists,
		"vendor_id must be set in context after DB lookup for subsequent cache hits")

	cachedUUID, ok := cached.(uuid.UUID)
	assert.True(t, ok, "cached vendor_id must be stored as uuid.UUID, not string")
	assert.Equal(t, testVendorID, cachedUUID,
		"cached vendor_id must equal the value returned by GetByOwnerID")
}

// TestExtractVendorID_CacheWrite_SecondCallNoDB proves the second call to
// ExtractVendorID on the same context uses the cache — the DB is hit exactly
// once across two calls.
func TestExtractVendorID_CacheWrite_SecondCallNoDB(t *testing.T) {
	t.Parallel()

	dbCallCount := 0
	repo := &mockVendorRepository{
		getByOwnerIDFn: func(_ context.Context, _ uuid.UUID) (*models.Vendor, error) {
			dbCallCount++
			return fakeVendor(), nil
		},
	}

	c := newGinContext()
	c.Set("user_id", testUserID)

	// First call — DB hit.
	first, err := ExtractVendorID(c, repo)
	require.NoError(t, err)

	// Second call on the same context — must use cache.
	second, err := ExtractVendorID(c, repo)
	require.NoError(t, err)

	assert.Equal(t, first, second,
		"both calls must return the same vendor ID")
	assert.Equal(t, 1, dbCallCount,
		"DB must be hit exactly once across two calls on the same context — "+
			"second call must use the cached vendor_id")
}