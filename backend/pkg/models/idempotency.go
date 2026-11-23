// backend/pkg/models/idempotency.go
package models

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"regexp"
	"strings"
)

var idempotencyKeyPattern = regexp.MustCompile(`^[A-Za-z0-9_.:\-]{8,128}$`)

// ValidIdempotencyKey reports whether a client-supplied Idempotency-Key is acceptable:
// 8 to 128 characters from letters, digits and - _ . :
func ValidIdempotencyKey(key string) bool { return idempotencyKeyPattern.MatchString(key) }

// IdempotencyHash fingerprints what the buyer asked for (contact details and the ticket lines).
// The same key with a different fingerprint is a client bug and is refused instead of returning an unrelated order.
// UserID and the key itself are not part of it.
func (r *OrderInitializationRequest) IdempotencyHash() string {
	type line struct {
		Event string
		Tier  string
		Qty   int32
	}
	lines := make([]line, 0, len(r.Items))
	for _, it := range r.Items {
		lines = append(lines, line{it.EventID.String(), it.TicketTierID.String(), it.Quantity})
	}
	b, _ := json.Marshal(struct {
		Email, First, Last, Phone string
		Items                     []line
	}{
		strings.ToLower(strings.TrimSpace(r.Email)), strings.TrimSpace(r.FirstName),
		strings.TrimSpace(r.LastName), strings.TrimSpace(r.Phone), lines,
	})
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}
