//backend/pkg/services/jwt/jwt_test_helpers_test.go

package servicejwt

import (
    "crypto/rand"
    "crypto/rsa"
    "testing"
    "time"
)

// testPrivKey is generated once for the entire test run — mirrors auth_test_helpers_test.go
var testPrivKey *rsa.PrivateKey

func TestMain(m *testing.M) {
    var err error
    testPrivKey, err = rsa.GenerateKey(rand.Reader, 2048)
    if err != nil {
        panic("failed to generate test RSA key: " + err.Error())
    }
    m.Run()
}

// newSvc is the single constructor for all JWT tests.
// Mirrors buildService() in auth_test_helpers_test.go.
func newSvc(t *testing.T) *JWTService {
    t.Helper()
    svc := NewJWTService()
    svc.SetKeysForTesting(testPrivKey, &testPrivKey.PublicKey)
    return svc
}

// newSvcWithClock returns a service whose clock is fully controlled by the test.
// The returned setter lets individual tests advance time without a sleep.
func newSvcWithClock(t *testing.T, start time.Time) (*JWTService, *time.Time) {
    t.Helper()
    now := start
    svc := NewJWTService()
    svc.SetKeysForTesting(testPrivKey, &testPrivKey.PublicKey)
    svc.Clock = func() time.Time { return now }
    return svc, &now
}