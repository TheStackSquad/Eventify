// backend/pkg/models/analytics.go

package models

import "time"

// ============================================================================
// MAIN RESPONSE STRUCTURE
// ============================================================================

// AnalyticsResponse is the top-level response returned to the client
// Matches frontend Redux state: state.events.analytics
type AnalyticsResponse struct {
	EventID    string         `json:"eventId"`
	EventTitle string         `json:"eventTitle"`
	Overview   OverviewData   `json:"overview"`
	Tickets    TicketsData    `json:"tickets"`
	Revenue    RevenueData    `json:"revenue"`
	Tiers      []TierData     `json:"tiers"`
	Orders     OrdersData     `json:"orders"`
	Customers  CustomersData  `json:"customers"`
	Payments   PaymentsData   `json:"payments"`
	Timeline   []TimelineData `json:"timeline,omitempty"` // Optional
}

// ============================================================================
// OVERVIEW DATA (Top-level KPIs)
// ============================================================================

// OverviewData contains high-level metrics for dashboard stat cards
// Frontend usage: analytics.overview
type OverviewData struct {
	Status          string  `json:"status"`          // "upcoming", "ongoing", "ended"
	TotalRevenue    int     `json:"totalRevenue"`    // in kobo
	TicketsSold     int     `json:"ticketsSold"`
	TotalOrders     int     `json:"totalOrders"`
	SellThroughRate float64 `json:"sellThroughRate"` // percentage (0-100)
	ConversionRate  float64 `json:"conversionRate"`  // percentage (0-100)
	DaysUntilEvent  int     `json:"daysUntilEvent"`  // negative if past
}

// ============================================================================
// TICKETS DATA (Inventory Metrics)
// ============================================================================

// TicketsData contains ticket inventory and sales metrics
// Frontend usage: analytics.tickets
type TicketsData struct {
	TotalInventory  int     `json:"totalInventory"`  // Sum of all tier quantities
	TotalSold       int     `json:"totalSold"`       // Count from tickets collection
	TotalRemaining  int     `json:"totalRemaining"`  // inventory - sold
	SellThroughRate float64 `json:"sellThroughRate"` // (sold/inventory) * 100
	VelocityPerDay  float64 `json:"velocityPerDay"`  // tickets sold per day
}

// ============================================================================
// REVENUE DATA (Financial Metrics)
// ============================================================================

// RevenueData contains all financial metrics (all amounts in kobo)
// Frontend usage: analytics.revenue
type RevenueData struct {
	Gross              int     `json:"gross"`              // Total revenue (final_total sum)
	ServiceFees        int     `json:"serviceFees"`        // Platform fees
	VAT                int     `json:"vat"`                // Tax collected
	Net                int     `json:"net"`                // Subtotal (what organizer gets)
	AverageOrderValue  float64 `json:"averageOrderValue"`  // gross / successful orders
	AverageTicketPrice float64 `json:"averageTicketPrice"` // net / tickets sold
}

// ============================================================================
// TIER DATA (Per-Tier Performance)
// ============================================================================

// TierData contains analytics for a single ticket tier
// Frontend usage: analytics.tiers[] (array)
type TierData struct {
	TierName        string  `json:"tierName"`
	PriceKobo       int     `json:"priceKobo"`       // Price in kobo
	TotalStock      int     `json:"totalStock"`      // From event.ticket_tiers.quantity
	Sold            int     `json:"sold"`            // From tickets collection
	Available       int     `json:"available"`       // stock - sold
	Revenue         int     `json:"revenue"`         // price * sold
	SellThroughRate float64 `json:"sellThroughRate"` // (sold/stock) * 100
	Popularity      string  `json:"popularity"`      // "high", "medium", "low"
}

// ============================================================================
// ORDERS DATA (Order Status Metrics)
// ============================================================================

// OrdersData contains order status breakdown and conversion metrics
// Frontend usage: analytics.orders
type OrdersData struct {
	Total           int     `json:"total"`           // All orders
	Successful      int     `json:"successful"`      // status = "success"
	Pending         int     `json:"pending"`         // status = "pending"
	Failed          int     `json:"failed"`          // status = "failed"
	Fraud           int     `json:"fraud"`           // status = "fraud"
	ConversionRate  float64 `json:"conversionRate"`  // (successful/total) * 100
	AbandonmentRate float64 `json:"abandonmentRate"` // ((failed+pending)/total) * 100
}

// ============================================================================
// CUSTOMERS DATA (Customer Demographics)
// ============================================================================

// CustomersData contains customer analytics and geographic breakdown
// Frontend usage: analytics.customers
type CustomersData struct {
	UniqueCustomers int            `json:"uniqueCustomers"` // Distinct emails
	RepeatCustomers int            `json:"repeatCustomers"` // Customers with >1 order
	TopCountries    []CountryData  `json:"topCountries"`    // Top 5 countries
}

// CountryData represents analytics for a specific country
type CountryData struct {
	Country        string  `json:"country"`
	OrderCount     int     `json:"orderCount"`
	TicketsSold    int     `json:"ticketsSold"`
	Revenue        int     `json:"revenue"`        // in kobo
	PercentOfTotal float64 `json:"percentOfTotal"` // % of total revenue
}

// ============================================================================
// PAYMENTS DATA (Payment Channel Analytics)
// ============================================================================

// PaymentsData contains payment method breakdown
// Frontend usage: analytics.payments
type PaymentsData struct {
	Channels           []PaymentChannelData `json:"channels"`
	MostPopularChannel string               `json:"mostPopularChannel"` // Channel with most revenue
}

// PaymentChannelData represents analytics for a payment method
type PaymentChannelData struct {
	Channel        string  `json:"channel"`        // "card", "bank_transfer", "ussd", etc.
	OrderCount     int     `json:"orderCount"`     // Number of orders
	Revenue        int     `json:"revenue"`        // Revenue in kobo
	PercentOfTotal float64 `json:"percentOfTotal"` // % of total revenue
	SuccessRate    float64 `json:"successRate"`    // (successful/total) * 100
}

// ============================================================================
// TIMELINE DATA (Sales Over Time - Optional)
// ============================================================================

// TimelineData represents sales metrics for a specific date/period
// Frontend usage: analytics.timeline[] (optional, for charts)
type TimelineData struct {
	Date           string `json:"date"`           // "2025-01-15" or "2025-W10" or "2025-01"
	TicketsSold    int    `json:"ticketsSold"`    // Tickets sold on this date
	Revenue        int    `json:"revenue"`        // Revenue in kobo
	OrderCount     int    `json:"orderCount"`     // Number of orders
	CumulativeSold int    `json:"cumulativeSold"` // Running total of tickets sold
}

// ============================================================================
// INTERNAL DATA TRANSFER OBJECTS (Repository → Service)
// These are NOT returned to the client, only used internally
// ============================================================================

// EventBasicInfo contains event details from events collection
// Used internally by repository and service layers
type EventBasicInfo struct {
	ID           string
	Title        string
	OrganizerID  string
	StartDate    time.Time
	EndDate      time.Time
	TicketTiers  []TierInfo
}

// TierInfo contains ticket tier details from event
type TierInfo struct {
	TierName string
	Price    float64 // Price in Naira (will convert to kobo)
	Quantity int
}

// OrderMetricsRaw contains raw order counts by status
// Used internally before calculating percentages
type OrderMetricsRaw struct {
	Total      int
	Successful int
	Pending    int
	Failed     int
	Fraud      int
}

// RevenueMetricsRaw contains raw revenue data from orders
// Used internally before calculating averages
type RevenueMetricsRaw struct {
	TotalRevenue      int
	SubtotalRevenue   int
	ServiceFees       int
	VATAmount         int
	OrderCount        int
	TotalOrderValue   float64 // For average calculation
}

// CustomerMetricsRaw contains raw customer data
type CustomerMetricsRaw struct {
	UniqueEmails []string // Will count these for unique customers
	TotalOrders  int
}

// PaymentChannelRaw contains raw payment channel data
type PaymentChannelRaw struct {
	Channel      string
	OrderCount   int
	Revenue      int
	SuccessCount int
	FailCount    int
}

// ============================================================================
// QUERY PARAMETERS (for future filtering/pagination)
// ============================================================================

// AnalyticsQuery represents optional query parameters
// Not used in MVP but prepared for future enhancements
type AnalyticsQuery struct {
	IncludeTimeline bool   // Whether to include timeline data
	GroupBy         string // "day", "week", "month" for timeline
	StartDate       *time.Time
	EndDate         *time.Time
}

// ============================================================================
// ERROR RESPONSES (for consistency)
// ============================================================================

// ErrorResponse represents an error returned to the client
type ErrorResponse struct {
	Status  string `json:"status"`  // "error"
	Message string `json:"message"` // Human-readable error message
}

// SuccessResponse represents a successful response wrapper
type SuccessResponse struct {
	Status  string      `json:"status"`  // "success"
	Message string      `json:"message"` // Success message
	Data    interface{} `json:"data"`    // The actual data (AnalyticsResponse)
}
