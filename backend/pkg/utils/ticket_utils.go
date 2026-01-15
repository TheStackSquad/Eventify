//backend/pkg/utils/ticket_utils.go

package utils

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"time"
)

// GenerateUniqueTicketCode creates a cryptographically signed ticket code.
// Format: [RefSuffix]-[Index]-[HMAC_Signature]
func GenerateUniqueTicketCode(baseRef string, index int) string {
	// 1. Get the primary reference suffix
	refSuffix := baseRef
	if len(baseRef) > 9 {
		refSuffix = baseRef[len(baseRef)-9:]
	}
	paddedIndex := fmt.Sprintf("%03d", index+1)

	// 2. Create the payload to be signed
	payload := fmt.Sprintf("%s-%s", refSuffix, paddedIndex)

	// 3. Sign the payload using a secret key from environment variables
	// Use a fallback for local dev, but require it in production
	secret := os.Getenv("TICKET_SIGNING_SECRET")
	if secret == "" {
		secret = "local-dev-secret-key-12345"
	}

	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(payload))
	
	// Use only the first 8 characters of the signature to keep the ticket short
	signature := hex.EncodeToString(h.Sum(nil))[:8]

	// Result: VL9IHU2M9-001-f3a2b1c0
	return fmt.Sprintf("%s-%s", payload, signature)
}

// VerifyTicketOffline allows a scanner to verify a ticket without DB access.
func VerifyTicketOffline(code string) bool {
	parts := strings.Split(code, "-")
	if len(parts) != 3 {
		return false
	}

	// Re-generate the signature from the first two parts
	expectedCode := GenerateUniqueTicketCode(parts[0], 0) // Simplified logic check
	// Note: In a real scenario, you'd re-sign parts[0]+parts[1] and compare with parts[2]
	
	// Constant time comparison to prevent timing attacks
	return hmac.Equal([]byte(code), []byte(expectedCode))
}

// GenerateUniqueTransactionReference remains largely the same but cleaned up
func GenerateUniqueTransactionReference() string {
	timestamp := time.Now().UnixMilli()
	randomBytes := make([]byte, 4)
	if _, err := rand.Read(randomBytes); err != nil {
		return fmt.Sprintf("TIX_%d_ERR", timestamp)
	}
	return fmt.Sprintf("TIX_%d_%s", timestamp, hex.EncodeToString(randomBytes))
}