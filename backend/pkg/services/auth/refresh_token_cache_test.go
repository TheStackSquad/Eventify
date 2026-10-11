// backend/pkg/services/auth/refresh_token_cache_test.go
//
// Tests for the in-memory token cache used to serve concurrent refresh
// requests within the grace period. Cache hits must return identical tokens
// without hitting SaveRefreshToken. Cache misses generate a new pair and
// store it for subsequent concurrent calls.
//
// Run:
//   go test ./pkg/services/auth/ -v -run TestRefreshToken_Cache

package auth

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

// TestRefreshToken_Cache_HitReturnsSameTokens verifies that when a valid cache
// entry exists for a consumed token (within grace period), the cached token pair
// is returned without generating a new one.
func TestRefreshToken_Cache_HitReturnsSameTokens(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	cachedPair := &TokenPair{
		AccessToken:  "cached-access-token",
		RefreshToken: "cached-refresh-token",
	}
	primeCache(t, svc, tokenHash, userID, cachedPair)

	consumed := time.Now().Add(-5 * time.Second)
	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = &consumed
	refreshRepo.getByHashToken = stored

	_, tokens, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if err != nil {
		t.Fatalf("cache hit: expected success, got %v", err)
	}
	if tokens.AccessToken != cachedPair.AccessToken {
		t.Errorf("access token mismatch: got %q, want %q", tokens.AccessToken, cachedPair.AccessToken)
	}
	if tokens.RefreshToken != cachedPair.RefreshToken {
		t.Errorf("refresh token mismatch: got %q, want %q", tokens.RefreshToken, cachedPair.RefreshToken)
	}
}

// TestRefreshToken_Cache_HitSkipsSaveRefreshToken verifies that a cache hit
// does not call SaveRefreshToken — the cached response is served as-is.
func TestRefreshToken_Cache_HitSkipsSaveRefreshToken(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	primeCache(t, svc, tokenHash, userID, &TokenPair{
		AccessToken:  "cached-access",
		RefreshToken: "cached-refresh",
	})

	consumed := time.Now().Add(-5 * time.Second)
	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = &consumed
	refreshRepo.getByHashToken = stored

	svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0") //nolint:errcheck

	if refreshRepo.saveRefreshTokenCalled {
		t.Error("SaveRefreshToken must not be called on a cache hit")
	}
}

// TestRefreshToken_Cache_ExpiredEntryTriggersMiss verifies that a cache entry
// older than TokenCacheTTL is treated as a miss and a new token pair is generated.
func TestRefreshToken_Cache_ExpiredEntryTriggersMiss(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	// Insert a stale cache entry (beyond TokenCacheTTL)
	svc.tokenCacheMutex.Lock()
	svc.tokenCache[tokenHash] = &cachedTokenPair{
		Tokens:    &TokenPair{AccessToken: "stale-access", RefreshToken: "stale-refresh"},
		UserID:    userID,
		CreatedAt: time.Now().Add(-(TokenCacheTTL + time.Second)), // expired
	}
	svc.tokenCacheMutex.Unlock()

	consumed := time.Now().Add(-5 * time.Second)
	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = &consumed
	refreshRepo.getByHashToken = stored

	_, tokens, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")

	if err != nil {
		t.Fatalf("expired cache entry: expected success, got %v", err)
	}
	// A new pair should have been generated (not the stale one)
	if tokens.AccessToken == "stale-access" {
		t.Error("expired cache entry should not be served — a new pair must be generated")
	}
	if !refreshRepo.saveRefreshTokenCalled {
		t.Error("SaveRefreshToken must be called when cache entry is expired")
	}
}

// TestRefreshToken_Cache_FirstUse_StoresInCache verifies that after a successful
// first-use rotation, the new token pair is stored in the cache so concurrent
// requests within the grace period can be served from cache.
func TestRefreshToken_Cache_FirstUse_StoresInCache(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = nil // first use
	refreshRepo.getByHashToken = stored

	svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0") //nolint:errcheck

	svc.tokenCacheMutex.RLock()
	entry, found := svc.tokenCache[tokenHash]
	svc.tokenCacheMutex.RUnlock()

	if !found {
		t.Error("first-use: generated tokens must be stored in cache for concurrent grace-period requests")
	}
	if found && entry.UserID != userID {
		t.Errorf("cached entry has wrong userID: got %v, want %v", entry.UserID, userID)
	}
}

// TestTokenCache_ManualEviction_RemovesExpiredEntries verifies the eviction
// logic by calling evictExpiredCacheEntries() directly, without relying on
// the background goroutine's 1-minute ticker. Confirms expired entries are
// removed and fresh entries are preserved in a single deterministic call.
func TestTokenCache_ManualEviction_RemovesExpiredEntries(t *testing.T) {
	svc, _, _ := buildService(t)

	svc.tokenCacheMutex.Lock()
	svc.tokenCache["expired"] = &cachedTokenPair{
		CreatedAt: time.Now().Add(-(TokenCacheTTL + time.Second)),
	}
	svc.tokenCache["fresh"] = &cachedTokenPair{
		CreatedAt: time.Now(),
	}
	svc.tokenCacheMutex.Unlock()

	svc.evictExpiredCacheEntries()

	svc.tokenCacheMutex.RLock()
	_, expiredExists := svc.tokenCache["expired"]
	_, freshExists := svc.tokenCache["fresh"]
	svc.tokenCacheMutex.RUnlock()

	if expiredExists {
		t.Error("expired entry should have been evicted")
	}
	if !freshExists {
		t.Error("fresh entry should not have been evicted")
	}
}