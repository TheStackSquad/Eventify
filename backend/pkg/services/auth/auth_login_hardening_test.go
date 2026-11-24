// backend/pkg/services/auth/auth_login_hardening_test.go

package auth

import (
    "errors"
    "testing"

    "golang.org/x/crypto/bcrypt"
)

func TestNormalizeEmail(t *testing.T) {
    cases := map[string]string{
        "A@X.com":             "a@x.com",
        "  User@Example.COM ": "user@example.com",
        "already@lower.com":   "already@lower.com",
        "":                    "",
    }
    for in, want := range cases {
        if got := normalizeEmail(in); got != want {
            t.Errorf("normalizeEmail(%q) = %q, want %q", in, got, want)
        }
    }
}

// The dummy hash must be a valid hash of the same cost as real passwords, or the timing it hides would show.
func TestDummyPasswordHashMatchesRealCost(t *testing.T) {
    h := getDummyPasswordHash()
    if err := bcrypt.CompareHashAndPassword(h, []byte("not the dummy password")); !errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
        t.Fatalf("expected a plain mismatch, got %v", err)
    }
    cost, err := bcrypt.Cost(h)
    if err != nil || cost != bcrypt.DefaultCost {
        t.Fatalf("dummy hash cost = %d (err %v), want %d", cost, err, bcrypt.DefaultCost)
    }
}
