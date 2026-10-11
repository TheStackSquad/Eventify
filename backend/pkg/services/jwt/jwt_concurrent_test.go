//backend/pkg/services/jwt/jwt_test_helpers_test.go

package servicejwt

import (
    "sync"
    "testing"
)

// TestConcurrent_Initialize_NoDataRace fires 20 goroutines all calling
// GenerateAccessToken simultaneously on a fresh (uninitialised) service.
// Run with: go test ./pkg/services/jwt/ -race -run TestConcurrent
func TestConcurrent_Initialize_NoDataRace(t *testing.T) {
    svc := newSvc(t)

    const goroutines = 20
    var wg sync.WaitGroup
    errs := make(chan error, goroutines)

    for i := 0; i < goroutines; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            _, err := svc.GenerateAccessToken("user-abc")
            errs <- err
        }()
    }

    wg.Wait()
    close(errs)

    for err := range errs {
        if err != nil {
            t.Errorf("concurrent GenerateAccessToken failed: %v", err)
        }
    }
}

// TestConcurrent_ValidateToken_NoDataRace — concurrent reads on the public key
// after initialisation must not race with any writes.
func TestConcurrent_ValidateToken_NoDataRace(t *testing.T) {
    svc := newSvc(t)
    token, err := svc.GenerateAccessToken("user-abc")
    if err != nil {
        t.Fatalf("setup: %v", err)
    }

    const goroutines = 50
    var wg sync.WaitGroup
    errs := make(chan error, goroutines)

    for i := 0; i < goroutines; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            _, err := svc.ValidateAccessToken(token)
            errs <- err
        }()
    }

    wg.Wait()
    close(errs)

    for err := range errs {
        if err != nil {
            t.Errorf("concurrent ValidateAccessToken failed: %v", err)
        }
    }
}

// TestConcurrent_InitError_PropagatestoAllCallers — EXPOSES THE GAP.
// A JWTService with no keys and GIN_MODE=release will fail to initialize.
// sync.Once means that error is permanent — every subsequent call sees it.
// This test documents that behaviour as a known contract (not a silent surprise).
func TestConcurrent_InitError_PropagatestoAllCallers(t *testing.T) {
    // Fresh service with no keys set and no env vars — Initialize() will fail
    t.Setenv("GIN_MODE", "release")
    t.Setenv("RSA_PRIVATE_KEY_PATH", "/nonexistent/private.pem")
    t.Setenv("RSA_PUBLIC_KEY_PATH", "/nonexistent/public.pem")

    svc := NewJWTService() // deliberately no SetKeysForTesting

    const goroutines = 10
    var wg sync.WaitGroup
    errs := make([]error, goroutines)

    for i := 0; i < goroutines; i++ {
        wg.Add(1)
        go func(i int) {
            defer wg.Done()
            _, errs[i] = svc.GenerateAccessToken("user-abc")
        }(i)
    }
    wg.Wait()

    for i, err := range errs {
        if err == nil {
            t.Errorf("goroutine %d: expected init error, got nil", i)
        }
    }
}