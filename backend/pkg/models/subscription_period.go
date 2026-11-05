//backend/pkg/models/subscription_period.go

package models

import "time"

// NextExpiry returns the expiry after one paid month. A renewal while still
// active extends from the current expiry; otherwise the month starts now.
func NextExpiry(now, currentExpiry time.Time) time.Time {
	start := now
	if currentExpiry.After(now) {
		start = currentExpiry
	}
	return addMonthClamped(start)
}

// addMonthClamped adds one calendar month and clamps to the last day of the
// target month (Jan 31 becomes Feb 28/29) instead of overflowing into the next.
func addMonthClamped(t time.Time) time.Time {
	y, m, d := t.Date()
	lastDay := time.Date(y, m+1, 1, 0, 0, 0, 0, t.Location()).AddDate(0, 1, -1).Day()
	if d > lastDay {
		d = lastDay
	}
	return time.Date(y, m+1, d, t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), t.Location())
}
