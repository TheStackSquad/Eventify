// backend/pkg/models/paging_test.go

package models

import "testing"

func TestClampPaging(t *testing.T) {
	cases := []struct {
		name, page, limit  string
		wantPage, wantLimit int
	}{
		{"defaults", "", "", 1, 12},
		{"valid values", "3", "24", 3, 24},
		{"zero page", "0", "12", 1, 12},
		{"negative values", "-4", "-1", 1, 12},
		{"not numbers", "abc", "x", 1, 12},
		{"limit above the cap", "1", "5000", 1, 48},
		{"page above the cap", "99999", "12", 1000, 12},
		{"decimals are rejected", "2.5", "10.5", 1, 12},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			page, limit := ClampPaging(tc.page, tc.limit)
			if page != tc.wantPage || limit != tc.wantLimit {
				t.Fatalf("got page=%d limit=%d, want page=%d limit=%d", page, limit, tc.wantPage, tc.wantLimit)
			}
		})
	}
}