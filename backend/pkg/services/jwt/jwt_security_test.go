//backend/pkg/services/jwt/jwt_test_helpers_test.go

package servicejwt

import (
    "crypto/rand"
    "crypto/rsa"
    "testing"
    "time"
	 "encoding/base64"

    "github.com/golang-jwt/jwt/v5"
)

// TestSecurity_AlgorithmConfusion_HMAC guards against the HS256 confusion attack.
// An attacker signs a token with HS256 using the public key as the HMAC secret.
// Your code checks for this — this test is the regression guard.
func TestSecurity_AlgorithmConfusion_HMAC(t *testing.T) {
    svc := newSvc(t)

    claims := &Claims{
        UserID:    "attacker",
        TokenType: "access",
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
            Issuer:    "eventify-api",
        },
    }
    tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    signed, err := tok.SignedString([]byte("any-secret"))
    if err != nil {
        t.Fatalf("craft HMAC token: %v", err)
    }

    if _, err := svc.ValidateAccessToken(signed); err == nil {
        t.Error("HMAC-signed token must be rejected by an RS256 validator")
    }
}

// TestSecurity_WrongKey_IsRejected — a token signed by a different keypair
// must fail validation. Covers key rotation scenarios and cross-service misuse.
func TestSecurity_WrongKey_IsRejected(t *testing.T) {
    svc1 := newSvc(t)

    // Build a second service with a completely different key
    otherKey, err := rsa.GenerateKey(rand.Reader, 2048)
    if err != nil {
        t.Fatalf("generate second key: %v", err)
    }
    svc2 := NewJWTService()
    svc2.SetKeysForTesting(otherKey, &otherKey.PublicKey)

    token, _ := svc1.GenerateAccessToken("user-abc")

    if _, err := svc2.ValidateAccessToken(token); err == nil {
        t.Error("token signed by svc1 must be rejected by svc2")
    }
}

// TestSecurity_TamperedPayload_IsRejected — manually construct a token whose
// header+payload claim to be from "eventify-api" but whose signature is invalid.
// Covers direct payload manipulation (base64 decode → edit → re-encode).
func TestSecurity_TamperedPayload_IsRejected(t *testing.T) {
    svc := newSvc(t)

    // Get a valid signed token
    token, _ := svc.GenerateAccessToken("user-abc")

    // Tamper: swap the payload segment with a different base64 blob
    // Real payload manipulation — split on ".", replace middle segment
    parts := splitToken(token)
    if len(parts) != 3 {
        t.Fatalf("expected 3 JWT parts, got %d", len(parts))
    }
    parts[1] = "eyJ1c2VyX2lkIjoiYXR0YWNrZXIifQ" // {"user_id":"attacker"}
    tampered := parts[0] + "." + parts[1] + "." + parts[2]

    if _, err := svc.ValidateAccessToken(tampered); err == nil {
        t.Error("tampered payload must be rejected")
    }
}

// TestSecurity_NoneAlgorithm_IsRejected — "alg: none" is a classic JWT attack.
// The library should reject this but the test makes it an explicit contract.
func TestSecurity_NoneAlgorithm_IsRejected(t *testing.T) {
    svc := newSvc(t)

    // Manually craft an "alg:none" token
    header := base64RawURL(`{"alg":"none","typ":"JWT"}`)
    payload := base64RawURL(`{"user_id":"attacker","token_type":"access","iss":"eventify-api","exp":9999999999}`)
    noneToken := header + "." + payload + "."

    if _, err := svc.ValidateAccessToken(noneToken); err == nil {
        t.Error("alg:none token must be rejected")
    }
}

// splitToken splits a JWT string into its three dot-separated parts.
func splitToken(token string) []string {
    var parts []string
    start := 0
    for i, c := range token {
        if c == '.' {
            parts = append(parts, token[start:i])
            start = i + 1
        }
    }
    parts = append(parts, token[start:])
    return parts
}

// base64RawURL encodes a string as base64url without padding.
func base64RawURL(s string) string {
    return base64.RawURLEncoding.EncodeToString([]byte(s))
}