// backend/pkg/services/analytics/analytics_utilities.go
// Business logic for analytics - utility functions

package analytics

import (
	"time"
)

// roundToTwoDecimals rounds a float to 2 decimal places
func roundToTwoDecimals(value float64) float64 {
	return float64(int(value*100+0.5)) / 100
}

// calculateDaysUntil returns days until a date (negative if past)
func calculateDaysUntil(targetDate time.Time) int {
	now := time.Now()
	duration := targetDate.Sub(now)
	return int(duration.Hours() / 24)
}

// calculateEventStatus determines if event is upcoming, ongoing, or ended
func calculateEventStatus(startDate, endDate time.Time) string {
	now := time.Now()
	if now.Before(startDate) {
		return "upcoming"
	} else if now.After(endDate) {
		return "ended"
	}
	return "ongoing"
}