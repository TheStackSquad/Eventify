// backend/pkg/services/auth/auth_login_hardening.go

package auth

import (
    "strings"
    "sync"

    "golang.org/x/crypto/bcrypt"
)

// normalizeEmail makes email comparison independent of letter case and stray spaces (F416).
func normalizeEmail(email string) string {
    return strings.ToLower(strings.TrimSpace(email))
}

var (
    dummyHashOnce sync.Once
    dummyHash     []byte
)

// getDummyPasswordHash returns a real bcrypt hash, at the same cost as real passwords, of a throwaway value.
// Login compares against it when the email is unknown, so an unknown email takes as long to refuse as a known one (F401).
func getDummyPasswordHash() []byte {
    dummyHashOnce.Do(func() {
        h, err := bcrypt.GenerateFromPassword([]byte("eventify-dummy-password"), bcrypt.DefaultCost)
        if err == nil {
            dummyHash = h
        }
    })
    return dummyHash
}
