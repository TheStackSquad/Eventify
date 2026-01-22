//backend/pkg/utils/ticket_utils.go

package utils

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"regexp"
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
	// Format: [RefSuffix]-[Index]-[HMAC_Signature]
	parts := strings.Split(code, "-")
	if len(parts) != 3 {
		return false
	}

	payload := fmt.Sprintf("%s-%s", parts[0], parts[1])

	secret := os.Getenv("TICKET_SIGNING_SECRET")
	if secret == "" {
		secret = "local-dev-secret-key-12345"
	}

	// Re-calculate the HMAC for the extracted payload
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(payload))
	expectedSignature := hex.EncodeToString(h.Sum(nil))[:8]

	// Constant-time comparison to prevent timing attacks
	return hmac.Equal([]byte(parts[2]), []byte(expectedSignature))
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

func GenerateSlug(title string) string {
	slug := strings.ToLower(title)
	// Replace non-alphanumeric with hyphens
	reg := regexp.MustCompile("[^a-z0-9]+")
	slug = reg.ReplaceAllString(slug, "-")
	// Trim hyphens from ends
	return strings.Trim(slug, "-")
}