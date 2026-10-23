//backend/pkg/models/subscription_period_test.go

package models_test

import (
	"testing"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestNextExpiry(t *testing.T) {
	d := func(y int, m time.Month, day int) time.Time { return time.Date(y, m, day, 10, 0, 0, 0, time.UTC) }
	cases := []struct {
		name             string
		now, current, want time.Time
	}{
		{"new subscriber gets a month from now", d(2026, 10, 23), time.Time{}, d(2026, 11, 23)},
		{"early renewal keeps the remaining days", d(2026, 10, 23), d(2026, 10, 28), d(2026, 11, 28)},
		{"renewal after lapse restarts from now", d(2026, 10, 23), d(2026, 10, 1), d(2026, 11, 23)},
		{"expiring exactly now counts as lapsed", d(2026, 10, 23), d(2026, 10, 23), d(2026, 11, 23)},
		{"month end clamps instead of overflowing", d(2026, 1, 31), time.Time{}, d(2026, 2, 28)},
		{"leap year clamp", d(2028, 1, 31), time.Time{}, d(2028, 2, 29)},
		{"year rollover", d(2026, 12, 31), time.Time{}, d(2027, 1, 31)},
	}
	for _, tc := range cases {
		got := models.NextExpiry(tc.now, tc.current)
		assert.True(t, tc.want.Equal(got), "%s: want %v got %v", tc.name, tc.want, got)
	}
}