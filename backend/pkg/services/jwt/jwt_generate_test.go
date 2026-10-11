//backend/pkg/services/jwt/jwt_test_helpers_test.go

package servicejwt

import (
    "testing"
)

// TestGenerateAccessToken_ClaimsAreCorrect verifies every claim field is
// populated correctly — mirrors the claim-level assertions in auth login tests.
func TestGenerateAccessToken_ClaimsAreCorrect(t *testing.T) {
    svc := newSvc(t)
    token, err := svc.GenerateAccessToken("user-abc")
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }

    claims, err := svc.ValidateAccessToken(token)
    if err != nil {
        t.Fatalf("token failed validation: %v", err)
    }

    if claims.UserID != "user-abc" {
        t.Errorf("UserID: got %q, want %q", claims.UserID, "user-abc")
    }
    if claims.TokenType != "access" {
        t.Errorf("TokenType: got %q, want %q", claims.TokenType, "access")
    }
    if claims.Issuer != "eventify-api" {
        t.Errorf("Issuer: got %q, want %q", claims.Issuer, "eventify-api")
    }
    if claims.ID == "" {
        t.Error("JTI (ID) must not be empty")
    }
    if claims.Subject != "user-abc" {
        t.Errorf("Subject: got %q, want %q", claims.Subject, "user-abc")
    }
}

// TestGenerateRefreshToken_ClaimsAreCorrect — same coverage for refresh path.
func TestGenerateRefreshToken_ClaimsAreCorrect(t *testing.T) {
    svc := newSvc(t)
    token, err := svc.GenerateRefreshToken("user-abc")
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }

    claims, err := svc.ValidateRefreshToken(token)
    if err != nil {
        t.Fatalf("token failed validation: %v", err)
    }

    if claims.TokenType != "refresh" {
        t.Errorf("TokenType: got %q, want %q", claims.TokenType, "refresh")
    }
}

// TestGenerateTokens_JTIsAreUnique locks in the uniqueness guarantee.
// Two calls for the same user must produce different JTIs.
func TestGenerateTokens_JTIsAreUnique(t *testing.T) {
    svc := newSvc(t)

    t1, _ := svc.GenerateAccessToken("user-abc")
    t2, _ := svc.GenerateAccessToken("user-abc")

    c1, _ := svc.ValidateAccessToken(t1)
    c2, _ := svc.ValidateAccessToken(t2)

    if c1.ID == c2.ID {
        t.Error("two tokens for the same user must have different JTIs")
    }
}

// TestGenerateAccessToken_AudienceClaimPresent — WILL FAIL until aud is added.
// This is the test-driven forcing function for adding the aud claim.
func TestGenerateAccessToken_AudienceClaimPresent(t *testing.T) {
    svc := newSvc(t)
    token, _ := svc.GenerateAccessToken("user-abc")
    claims, _ := svc.ValidateAccessToken(token)

    if len(claims.Audience) == 0 {
        t.Error("aud claim must be set — a token without aud is valid at any service sharing this key")
    }
}

// TestGenerateAccessToken_NotBeforeClaimPresent — WILL FAIL until nbf is added.
func TestGenerateAccessToken_NotBeforeClaimPresent(t *testing.T) {
    svc := newSvc(t)
    token, _ := svc.GenerateAccessToken("user-abc")
    claims, _ := svc.ValidateAccessToken(token)

    if claims.NotBefore == nil {
        t.Error("nbf claim must be present")
    }
}