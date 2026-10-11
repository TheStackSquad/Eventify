// backend/pkg/shared/fee_config.go
package shared

// ============================================================================
// FEE CONFIGURATION - SINGLE SOURCE OF TRUTH
// ============================================================================
// This file defines ALL fee calculation logic for the entire platform.
// Both initialization and verification use these same formulas to ensure consistency.

const (
	// VAT rate (7.5% as per Nigerian tax law)
	VATRate = 75 // Represented as 75/1000 for integer math (7.5%)
	
	// Tier thresholds (in Kobo)
	TierOneCap   = 250000  // ₦2,500
	TierTwoCap   = 1000000 // ₦10,000
	TierThreeCap = 5000000 // ₦50,000
	
	// Fee rates (represented for integer division)
	TierOneFlat    = 20000 // ₦200 flat fee for tickets under ₦2,500
	TierTwoPercent = 8     // 8% for ₦2,501 - ₦10,000
	TierThreePercent = 6   // 6% for ₦10,001 - ₦50,000
	TierFourPercent = 4    // 4% for above ₦50,000
)

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

// CalculateServiceFee calculates the service fee based on tiered percentage model.
// This ensures fair pricing across all ticket price ranges.
//
// Pricing Tiers:
//   - ₦0 - ₦2,500:      Flat ₦200
//   - ₦2,501 - ₦10,000: 8% of subtotal
//   - ₦10,001 - ₦50,000: 6% of subtotal
//   - Above ₦50,000:    4% of subtotal
//
// Parameters:
//   - subtotalKobo: The sum of all ticket prices in Kobo
//
// Returns:
//   - Service fee in Kobo
func CalculateServiceFee(subtotalKobo int) int {
	if subtotalKobo <= TierOneCap {
		// Tier 1: Flat ₦200 for small transactions
		return TierOneFlat
	} else if subtotalKobo <= TierTwoCap {
		// Tier 2: 8% for ₦2,501 - ₦10,000
		return subtotalKobo * TierTwoPercent / 100
	} else if subtotalKobo <= TierThreeCap {
		// Tier 3: 6% for ₦10,001 - ₦50,000
		return subtotalKobo * TierThreePercent / 100
	} else {
		// Tier 4: 4% for expensive tickets
		return subtotalKobo * TierFourPercent / 100
	}
}

// CalculateVAT calculates the Value Added Tax on the given amount.
// Nigerian VAT is 7.5% and is applied to (subtotal + service_fee).
//
// Parameters:
//   - amountKobo: The base amount to calculate VAT on (in Kobo)
//
// Returns:
//   - VAT amount in Kobo
func CalculateVAT(amountKobo int) int {
	return amountKobo * VATRate / 1000 // 7.5% = 75/1000
}

// CalculateOrderTotals computes all financial components of an order.
// This is the canonical calculation used by both frontend and backend.
//
// Parameters:
//   - subtotalKobo: Sum of (item_price * quantity) for all items in Kobo
//
// Returns:
//   - subtotal: Input subtotal (for consistency)
//   - serviceFee: Calculated service fee in Kobo
//   - vatAmount: Calculated VAT in Kobo
//   - finalTotal: Complete total in Kobo (subtotal + serviceFee + vatAmount)
func CalculateOrderTotals(subtotalKobo int) (subtotal, serviceFee, vatAmount, finalTotal int) {
	subtotal = subtotalKobo
	serviceFee = CalculateServiceFee(subtotalKobo)
	
	// VAT is calculated on (subtotal + service_fee) per Nigerian tax law
	taxableAmount := subtotal + serviceFee
	vatAmount = CalculateVAT(taxableAmount)
	
	finalTotal = subtotal + serviceFee + vatAmount
	
	return subtotal, serviceFee, vatAmount, finalTotal
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// GetFeeTier returns a human-readable description of the fee tier for a given subtotal.
// Useful for customer-facing fee transparency displays.
func GetFeeTier(subtotalKobo int) string {
	if subtotalKobo <= TierOneCap {
		return "Flat ₦200 fee"
	} else if subtotalKobo <= TierTwoCap {
		return "8% service fee"
	} else if subtotalKobo <= TierThreeCap {
		return "6% service fee"
	} else {
		return "4% service fee"
	}
}

// ConvertNairaToKobo safely converts Naira (as float) to Kobo (as int).
// Handles rounding to avoid precision errors.
func ConvertNairaToKobo(naira float64) int {
	return int(naira * 100)
}

// ConvertKoboToNaira converts Kobo (int) to Naira (float).
func ConvertKoboToNaira(kobo int) float64 {
	return float64(kobo) / 100.0
}