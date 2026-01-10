// backend/pkg/utils/rate_limiter.go

package utils

import (
	"os"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// Visitor represents a unique client
type Visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type IPRateLimiter struct {
	visitors map[string]*Visitor
	mu       sync.Mutex
	r        rate.Limit
	b        int
}

func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	i := &IPRateLimiter{
		visitors: make(map[string]*Visitor),
		r:        r,
		b:        b,
	}

	// Cleanup goroutine to remove old entries every hour
	go i.cleanupVisitors()

	return i
}

func (i *IPRateLimiter) GetVisitor(identifier string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	v, exists := i.visitors[identifier]
	if !exists {
		limiter := rate.NewLimiter(i.r, i.b)
		i.visitors[identifier] = &Visitor{limiter, time.Now()}
		return limiter
	}

	v.lastSeen = time.Now()
	return v.limiter
}

func (i *IPRateLimiter) cleanupVisitors() {
	for {
		time.Sleep(time.Hour)
		i.mu.Lock()
		for id, v := range i.visitors {
			if time.Since(v.lastSeen) > 24*time.Hour {
				delete(i.visitors, id)
			}
		}
		i.mu.Unlock()
	}
}

// Global configuration
var (
	// SkipLocalhostRateLimit - Whether to skip rate limiting for localhost
	SkipLocalhostRateLimit bool
)

func init() {
	// Check environment variable
	skipLocalhost := os.Getenv("SKIP_LOCALHOST_RATE_LIMIT")
	SkipLocalhostRateLimit = skipLocalhost != "false" // Default: true (skip localhost)
	
	// Also skip in debug/test mode
	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "debug" || ginMode == "test" {
		SkipLocalhostRateLimit = true
	}
}

// Global instances for different route types
var (
	// PublicLimiter - 50 requests per second with burst
	PublicLimiter = NewIPRateLimiter(rate.Every(time.Second), 50)
	
	// AuthLimiter - 5 attempts per minute (stricter for auth)
	AuthLimiter = NewIPRateLimiter(rate.Every(time.Minute), 5)
	
	// WriteLimiter - 1 write every 5 seconds (prevent spam)
	WriteLimiter = NewIPRateLimiter(rate.Every(time.Second*5), 3)
)