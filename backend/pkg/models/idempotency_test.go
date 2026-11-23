// backend/pkg/models/idempotency_test.go
package models

import (
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestValidIdempotencyKey(t *testing.T) {
	good := []string{"12345678", "ord-p1a-0123456789abcdef", "a.b:c_d-e1", strings.Repeat("k", 128)}
	bad := []string{"", "short", "has space 1234", "semi;colon12", "new\nline1234", strings.Repeat("k", 129), "émoji-key-123"}
	for _, k := range good {
		if !ValidIdempotencyKey(k) {
			t.Errorf("%q should be valid", k)
		}
	}
	for _, k := range bad {
		if ValidIdempotencyKey(k) {
			t.Errorf("%q should be invalid", k)
		}
	}
}

func TestIdempotencyHash(t *testing.T) {
	a, b := validRequest(), validRequest()
	b.Items = a.Items // same ticket lines
	if a.IdempotencyHash() != b.IdempotencyHash() {
		t.Fatal("the same request must hash the same")
	}
	if len(a.IdempotencyHash()) != 64 {
		t.Fatalf("expected a 64 character hash, got %d", len(a.IdempotencyHash()))
	}

	diff := func(name string, mutate func(r *OrderInitializationRequest)) {
		r := validRequest()
		r.Items = a.Items
		mutate(r)
		if r.IdempotencyHash() == a.IdempotencyHash() {
			t.Errorf("%s must change the hash", name)
		}
	}
	diff("quantity", func(r *OrderInitializationRequest) { r.Items = []OrderInitializationItem{{EventID: a.Items[0].EventID, TicketTierID: a.Items[0].TicketTierID, Quantity: 2}} })
	diff("tier", func(r *OrderInitializationRequest) { r.Items = []OrderInitializationItem{{EventID: a.Items[0].EventID, TicketTierID: uuid.New(), Quantity: 1}} })
	diff("email", func(r *OrderInitializationRequest) { r.Email = "other@example.com" })
	diff("first name", func(r *OrderInitializationRequest) { r.FirstName = "Other" })

	// harmless differences must not change it: letter case of the email, surrounding spaces, the key field, the userId
	c := validRequest()
	c.Items = a.Items
	c.Email = "  A@EXAMPLE.COM "
	c.FirstName = " Ada "
	id := uuid.New()
	c.UserID = &id
	c.IdempotencyKey = "whatever-key-1"
	if c.IdempotencyHash() != a.IdempotencyHash() {
		t.Error("case, spaces, userId and the key itself must not change the hash")
	}
}
