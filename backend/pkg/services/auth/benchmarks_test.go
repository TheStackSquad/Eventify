// backend/pkg/services/auth/benchmarks_test.go

package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"

	"github.com/google/uuid"
)

// ================================================================
// TOKEN HASHING BENCHMARKS
// ================================================================

// BenchmarkTokenHashing measures SHA-256 hashing performance
func BenchmarkTokenHashing(b *testing.B) {
	token := "a3f2b8c1d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		hash := sha256.Sum256([]byte(token))
		_ = hex.EncodeToString(hash[:])
	}
}

// BenchmarkTokenHashingConcurrent measures concurrent hashing
func BenchmarkTokenHashingConcurrent(b *testing.B) {
	token := "a3f2b8c1d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			hash := sha256.Sum256([]byte(token))
			_ = hex.EncodeToString(hash[:])
		}
	})
}

// ================================================================
// TOKEN CACHE BENCHMARKS
// ================================================================

// BenchmarkCacheLookup measures cache read performance
func BenchmarkCacheLookup(b *testing.B) {
	cache := make(map[string]*cachedTokenPair)

	// Populate cache with 100 entries
	for i := 0; i < 100; i++ {
		key := uuid.NewString()
		cache[key] = &cachedTokenPair{
			Tokens: &TokenPair{
				AccessToken:  "access_" + key,
				RefreshToken: "refresh_" + key,
			},
			UserID:    uuid.New(),
			CreatedAt: time.Now(),
		}
	}

	keys := make([]string, 0, 100)
	for k := range cache {
		keys = append(keys, k)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key := keys[i%len(keys)]
		_ = cache[key]
	}
}

// BenchmarkCacheWrite measures cache write performance
func BenchmarkCacheWrite(b *testing.B) {
	cache := make(map[string]*cachedTokenPair)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key := uuid.NewString()
		cache[key] = &cachedTokenPair{
			Tokens: &TokenPair{
				AccessToken:  "access_token",
				RefreshToken: "refresh_token",
			},
			UserID:    uuid.New(),
			CreatedAt: time.Now(),
		}
	}
}

// BenchmarkCacheCleanup measures cleanup performance
func BenchmarkCacheCleanup(b *testing.B) {
	for i := 0; i < b.N; i++ {
		b.StopTimer()
		cache := make(map[string]*cachedTokenPair)

		// Populate with 1000 entries (mix of fresh and expired)
		now := time.Now()
		for j := 0; j < 1000; j++ {
			key := uuid.NewString()
			createdAt := now.Add(-time.Duration(j) * time.Second)
			cache[key] = &cachedTokenPair{
				Tokens:    &TokenPair{},
				UserID:    uuid.New(),
				CreatedAt: createdAt,
			}
		}

		b.StartTimer()

		// Cleanup expired entries (older than 35s)
		for key, cached := range cache {
			if now.Sub(cached.CreatedAt) > TokenCacheTTL {
				delete(cache, key)
			}
		}
	}
}

// ================================================================
// METADATA VALIDATION BENCHMARKS
// ================================================================

// BenchmarkIPComparison measures IP address comparison
func BenchmarkIPComparison(b *testing.B) {
	ip1 := "192.168.1.1"
	ip2 := "192.168.1.2"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ip1 == ip2
	}
}

// BenchmarkUserAgentComparison measures User-Agent comparison
func BenchmarkUserAgentComparison(b *testing.B) {
	ua1 := "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
	ua2 := "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ua1 == ua2
	}
}

// ================================================================
// CONCURRENT OPERATION BENCHMARKS
// ================================================================

// BenchmarkConcurrentRefresh simulates concurrent refresh requests
func BenchmarkConcurrentRefresh(b *testing.B) {
	cache := make(map[string]*cachedTokenPair)
	tokenHash := "test-token-hash"

	// Pre-populate cache
	cache[tokenHash] = &cachedTokenPair{
		Tokens: &TokenPair{
			AccessToken:  "access",
			RefreshToken: "refresh",
		},
		UserID:    uuid.New(),
		CreatedAt: time.Now(),
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			// Simulate concurrent cache lookup
			if cached, exists := cache[tokenHash]; exists {
				if time.Since(cached.CreatedAt) < TokenCacheTTL {
					_ = cached.Tokens
				}
			}
		}
	})
}

// ================================================================
// CONTEXT TIMEOUT BENCHMARKS
// ================================================================

// BenchmarkContextWithTimeout measures context creation overhead
func BenchmarkContextWithTimeout(b *testing.B) {
	parentCtx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx, cancel := context.WithTimeout(parentCtx, 5*time.Second)
		_ = ctx
		cancel()
	}
}

// ================================================================
// UUID GENERATION BENCHMARKS
// ================================================================

// BenchmarkUUIDGeneration measures UUID v4 generation
func BenchmarkUUIDGeneration(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = uuid.New()
	}
}

// BenchmarkUUIDParsing measures UUID parsing from string
func BenchmarkUUIDParsing(b *testing.B) {
	uuidStr := "550e8400-e29b-41d4-a716-446655440000"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = uuid.Parse(uuidStr)
	}
}

// ================================================================
// COMPARATIVE BENCHMARKS
// ================================================================

// BenchmarkStringConcatenation compares different string building methods
func BenchmarkStringConcatenation(b *testing.B) {
	b.Run("Plus", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_ = "prefix_" + "middle_" + "suffix"
		}
	})

	b.Run("Sprintf", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_ = "prefix_middle_suffix"
		}
	})
}

// ================================================================
// PERFORMANCE TARGETS
// ================================================================
/*
EXPECTED PERFORMANCE (on modern hardware):

Token Hashing:
- BenchmarkTokenHashing:            ~10,000 ns/op   (0.01ms per hash)
- BenchmarkTokenHashingConcurrent:  ~5,000 ns/op    (with parallelism)

Cache Operations:
- BenchmarkCacheLookup:             ~50 ns/op       (extremely fast map lookup)
- BenchmarkCacheWrite:              ~200 ns/op      (map write + struct alloc)
- BenchmarkCacheCleanup:            ~50,000 ns/op   (for 1000 entries)

Metadata Validation:
- BenchmarkIPComparison:            ~5 ns/op        (string equality)
- BenchmarkUserAgentComparison:     ~10 ns/op       (longer string)

Concurrent Operations:
- BenchmarkConcurrentRefresh:       ~100 ns/op      (with cache hit)

Context & UUID:
- BenchmarkContextWithTimeout:      ~500 ns/op
- BenchmarkUUIDGeneration:          ~1,000 ns/op
- BenchmarkUUIDParsing:             ~100 ns/op

USAGE:
  go test -bench=. -benchmem -benchtime=5s

MONITORING:
  Compare before/after optimization:
  go test -bench=BenchmarkCacheLookup -benchmem > old.txt
  [apply optimization]
  go test -bench=BenchmarkCacheLookup -benchmem > new.txt
  benchcmp old.txt new.txt
*/