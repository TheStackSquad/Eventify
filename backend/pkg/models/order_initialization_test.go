// backend/pkg/models/order_initialization_test.go
package models

import (
	"strings"
	"testing"

	"github.com/google/uuid"
)

func validRequest() *OrderInitializationRequest {
	return &OrderInitializationRequest{
		Email:     "a@example.com",
		FirstName: "Ada",
		LastName:  "Obi",
		Phone:     "08012345678",
		Items:     []OrderInitializationItem{{EventID: uuid.New(), TicketTierID: uuid.New(), Quantity: 1}},
	}
}

// F220: input longer than the orders columns is a 400, never a failed insert.
func TestValidate_FieldLengths(t *testing.T) {
	if err := validRequest().Validate(); err != nil {
		t.Fatalf("a valid request was rejected: %v", err)
	}

	cases := []struct {
		name   string
		mutate func(r *OrderInitializationRequest)
		wantOK bool
	}{
		{"first name at the limit", func(r *OrderInitializationRequest) { r.FirstName = strings.Repeat("a", MaxNameLen) }, true},
		{"first name one over", func(r *OrderInitializationRequest) { r.FirstName = strings.Repeat("a", MaxNameLen+1) }, false},
		{"last name one over", func(r *OrderInitializationRequest) { r.LastName = strings.Repeat("a", MaxNameLen+1) }, false},
		{"email one over", func(r *OrderInitializationRequest) { r.Email = strings.Repeat("a", MaxEmailLen) + "@example.com" }, false},
		{"phone at the limit", func(r *OrderInitializationRequest) { r.Phone = strings.Repeat("1", MaxPhoneLen) }, true},
		{"phone one over", func(r *OrderInitializationRequest) { r.Phone = strings.Repeat("1", MaxPhoneLen+1) }, false},
		// the limit counts characters, not bytes: 255 two-byte characters fit a varchar(255)
		{"multi-byte name at the limit", func(r *OrderInitializationRequest) { r.FirstName = strings.Repeat("é", MaxNameLen) }, true},
	}
	for _, c := range cases {
		r := validRequest()
		c.mutate(r)
		err := r.Validate()
		if c.wantOK && err != nil {
			t.Errorf("%s: unexpected error: %v", c.name, err)
		}
		if !c.wantOK && err == nil {
			t.Errorf("%s: expected an error, got none", c.name)
		}
	}
}
