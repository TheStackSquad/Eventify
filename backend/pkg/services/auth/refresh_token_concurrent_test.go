// backend/pkg/services/auth/refresh_token_concurrent_test.go
//
// Race detector tests for concurrent refresh token requests.
// These tests must be run with the -race flag to be meaningful:
//
//   go test ./pkg/services/auth/ -race -run TestRefreshToken_Concurrent
//   go test ./pkg/services/auth/ -race -count=5 -run TestRefreshToken_Concurrent
//
// The tests verify that concurrent access to tokenCache is properly
// synchronised via tokenCacheMutex and does not produce data races.

package auth

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

// TestRefreshToken_Concurrent_GracePeriod_NoDataRace fires multiple goroutines
// all presenting the same consumed token within the grace period.
// The race detector will catch any unsynchronised reads/writes to tokenCache.
func TestRefreshToken_Concurrent_GracePeriod_NoDataRace(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	consumed := time.Now().Add(-5 * time.Second)
	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = &consumed
	refreshRepo.getByHashToken = stored

	const goroutines = 10
	errs := make(chan error, goroutines)
	var wg sync.WaitGroup

	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")
			errs <- err
		}()
	}

	wg.Wait()
	close(errs)

	for err := range errs {
		if err != nil {
			t.Errorf("concurrent grace period request failed: %v", err)
		}
	}
}

// TestRefreshToken_Concurrent_GracePeriod_AllReturnSameTokens verifies that
// all concurrent requests within the grace period receive identical token pairs.
// This is the correctness requirement: same tokens, not just no errors.
func TestRefreshToken_Concurrent_GracePeriod_AllReturnSameTokens(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	// Pre-prime cache so all goroutines definitely hit the cache path
	cachedPair := &TokenPair{
		AccessToken:  "shared-access-token",
		RefreshToken: "shared-refresh-token",
	}
	primeCache(t, svc, tokenHash, userID, cachedPair)

	consumed := time.Now().Add(-5 * time.Second)
	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = &consumed
	refreshRepo.getByHashToken = stored

	const goroutines = 20
	results := make(chan *TokenPair, goroutines)
	var wg sync.WaitGroup

	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, tokens, _ := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")
			results <- tokens
		}()
	}

	wg.Wait()
	close(results)

	for pair := range results {
		if pair == nil {
			t.Error("concurrent request returned nil token pair")
			continue
		}
		if pair.AccessToken != cachedPair.AccessToken {
			t.Errorf("concurrent request got different access token: %q vs %q",
				pair.AccessToken, cachedPair.AccessToken)
		}
	}
}

// TestRefreshToken_Concurrent_FirstUse_NoDataRace tests the first-use path
// under concurrent load. Multiple goroutines present an unconsumed token
// simultaneously. The cache write after ConsumeToken must be race-free.
func TestRefreshToken_Concurrent_FirstUse_NoDataRace(t *testing.T) {
	svc, _, refreshRepo := buildService(t)

	userID := uuid.New()
	token := generateValidRefreshToken(t, userID.String())
	tokenHash := sha256Hex(token)

	stored := makeStoredToken(userID, tokenHash)
	stored.ConsumedAt = nil
	refreshRepo.getByHashToken = stored

	const goroutines = 5
	var wg sync.WaitGroup
	errs := make(chan error, goroutines)

	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _, err := svc.RefreshToken(context.Background(), token, 30*24*time.Hour, "127.0.0.1", "TestAgent/1.0")
			errs <- err
		}()
	}

	wg.Wait()
	close(errs)

	// We don't assert all-success here because the mock ConsumeToken is not
	// atomic (it's a no-op stub). The goal is race-freedom, not idempotency.
	// Real DB atomicity is tested in integration tests.
	// Any panics from data races will cause the test to fail automatically.
}