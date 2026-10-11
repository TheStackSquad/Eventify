//backend/pkg/services/jwt/jwt_test_helpers_test.go

package servicejwt

import (
    "testing"
    "time"
)

// TestValidate_CrossTypeRejection mirrors the pattern in
// refresh_token_revoked_test.go — the validator must enforce token type.
func TestValidate_CrossTypeRejection(t *testing.T) {
    svc := newSvc(t)

    refresh, _ := svc.GenerateRefreshToken("user-abc")
    if _, err := svc.ValidateAccessToken(refresh); err == nil {
        t.Error("ValidateAccessToken must reject a refresh token")
    }

    access, _ := svc.GenerateAccessToken("user-abc")
    if _, err := svc.ValidateRefreshToken(access); err == nil {
        t.Error("ValidateRefreshToken must reject an access token")
    }
}

// TestValidate_ExpiredAccessToken_IsRejected — requires Clock injection.
// Without it this test would need a real sleep. With it: instant, deterministic.
// Mirrors how grace period tests use exact time offsets rather than sleeping.
func TestValidate_ExpiredAccessToken_IsRejected(t *testing.T) {
    start := time.Now()
    svc, clock := newSvcWithClock(t, start)

    token, err := svc.GenerateAccessToken("user-abc")
    if err != nil {
        t.Fatalf("generate: %v", err)
    }

    // Advance clock past access token expiry
    *clock = start.Add(svc.accessTokenExpiry + time.Second)

    if _, err := svc.ValidateAccessToken(token); err == nil {
        t.Error("expired token must be rejected")
    }
}

// TestValidate_TokenJustBeforeExpiry_IsAccepted — boundary test.
// Token must be valid 1 second before expiry.
func TestValidate_TokenJustBeforeExpiry_IsAccepted(t *testing.T) {
    start := time.Now()
    svc, clock := newSvcWithClock(t, start)

    token, err := svc.GenerateAccessToken("user-abc")
    if err != nil {
        t.Fatalf("generate: %v", err)
    }

    *clock = start.Add(svc.accessTokenExpiry - time.Second)

    if _, err := svc.ValidateAccessToken(token); err != nil {
        t.Errorf("token should still be valid 1s before expiry: %v", err)
    }
}

// TestValidate_EmptyString_ReturnsError — guards against panics on bad input.
func TestValidate_EmptyString_ReturnsError(t *testing.T) {
    svc := newSvc(t)
    if _, err := svc.ValidateToken(""); err == nil {
        t.Error("empty token string must return error")
    }
}

// TestValidate_MalformedToken_ReturnsError
func TestValidate_MalformedToken_ReturnsError(t *testing.T) {
    svc := newSvc(t)
    if _, err := svc.ValidateToken("not.a.jwt"); err == nil {
        t.Error("malformed token must return error")
    }
}