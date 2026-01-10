// backend/pkg/services/vendor/analytics_helpers.go

package vendor

// roundToTwoDecimals rounds a float64 value to two decimal places
func roundToTwoDecimals(value float64) float64 {
	return float64(int(value*100+0.5)) / 100
}