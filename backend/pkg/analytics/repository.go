// backend/pkg/analytics/repository.go
package analytics

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"eventify/backend/pkg/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ============================================================================
// INTERFACE
// ============================================================================

// AnalyticsRepository defines methods for fetching analytics data
type AnalyticsRepository interface {
	// Event queries
	GetEventInfo(ctx context.Context, eventID uuid.UUID) (*models.EventBasicInfo, error)

	// Ticket queries
	GetTicketsSold(ctx context.Context, eventID uuid.UUID) (int64, error)
	GetTicketsSoldByTier(ctx context.Context, eventID uuid.UUID) (map[string]int64, error)

	// Order queries
	GetOrderMetrics(ctx context.Context, eventID uuid.UUID) (*models.OrderMetricsRaw, error)
	GetRevenueMetrics(ctx context.Context, eventID uuid.UUID) (*models.RevenueMetricsRaw, error)

	// Customer queries
	GetCustomerMetrics(ctx context.Context, eventID uuid.UUID) (*models.CustomerMetricsRaw, error)
	GetTopCountries(ctx context.Context, eventID uuid.UUID, limit int) ([]models.CountryData, error)

	// Payment queries
	GetPaymentChannels(ctx context.Context, eventID uuid.UUID) ([]models.PaymentChannelRaw, error)

	// Timeline queries
	GetSalesTimeline(ctx context.Context, eventID uuid.UUID, groupBy string) ([]models.TimelineData, error)
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

// PostgresAnalyticsRepository implements AnalyticsRepository using PostgreSQL
type PostgresAnalyticsRepository struct {
	DB *sqlx.DB
}

// NewAnalyticsRepository creates a new analytics repository instance
func NewPostgresAnalyticsRepository(db *sqlx.DB) AnalyticsRepository {
	return &PostgresAnalyticsRepository{
		DB: db,
	}
}

// ============================================================================
// EVENT QUERIES
// ============================================================================

// GetEventInfo fetches basic event information
func (r *PostgresAnalyticsRepository) GetEventInfo(
	ctx context.Context,
	eventID uuid.UUID,
) (*models.EventBasicInfo, error) {

	query := `
		SELECT 
			e.id,
			e.title,
			e.organizer_id,
			e.start_date,
			e.end_date
		FROM events e
		WHERE e.id = $1 AND e.is_deleted = false
	`

	var result struct {
		ID          uuid.UUID `db:"id"`
		Title       string    `db:"title"`
		OrganizerID uuid.UUID `db:"organizer_id"`
		StartDate   time.Time `db:"start_date"`
		EndDate     time.Time `db:"end_date"`
	}

	err := r.DB.GetContext(ctx, &result, query, eventID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("event not found or deleted")
		}
		return nil, fmt.Errorf("failed to fetch event: %w", err)
	}

	// Fetch ticket tiers
	tierQuery := `
		SELECT 
			tier_name,
			price,
			quantity
		FROM ticket_tiers
		WHERE event_id = $1
		ORDER BY price ASC
	`

	var tiers []models.TierInfo
	err = r.DB.SelectContext(ctx, &tiers, tierQuery, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch ticket tiers: %w", err)
	}

	info := &models.EventBasicInfo{
		ID:          result.ID.String(),
		Title:       result.Title,
		OrganizerID: result.OrganizerID.String(),
		StartDate:   result.StartDate,
		EndDate:     result.EndDate,
		TicketTiers: tiers,
	}

	return info, nil
}

// ============================================================================
// TICKET QUERIES
// ============================================================================

// GetTicketsSold counts total tickets sold for an event
func (r *PostgresAnalyticsRepository) GetTicketsSold(
	ctx context.Context,
	eventID uuid.UUID,
) (int64, error) {

	query := `
		SELECT COUNT(*) 
		FROM tickets 
		WHERE event_id = $1
	`

	var count int64
	err := r.DB.GetContext(ctx, &count, query, eventID)
	if err != nil {
		return 0, fmt.Errorf("failed to count tickets: %w", err)
	}

	return count, nil
}

// GetTicketsSoldByTier returns tickets sold per tier
func (r *PostgresAnalyticsRepository) GetTicketsSoldByTier(
	ctx context.Context,
	eventID uuid.UUID,
) (map[string]int64, error) {

	query := `
		SELECT 
			tt.tier_name,
			COUNT(t.id) as count
		FROM ticket_tiers tt
		LEFT JOIN tickets t ON t.ticket_tier_id = tt.id AND t.event_id = $1
		WHERE tt.event_id = $1
		GROUP BY tt.tier_name
		ORDER BY tt.tier_name
	`

	var results []struct {
		TierName string `db:"tier_name"`
		Count    int64  `db:"count"`
	}

	err := r.DB.SelectContext(ctx, &results, query, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tickets by tier: %w", err)
	}

	tierMap := make(map[string]int64)
	for _, result := range results {
		tierMap[result.TierName] = result.Count
	}

	return tierMap, nil
}

// ============================================================================
// ORDER QUERIES
// ============================================================================

// GetOrderMetrics fetches order status breakdown
func (r *PostgresAnalyticsRepository) GetOrderMetrics(
	ctx context.Context,
	eventID uuid.UUID,
) (*models.OrderMetricsRaw, error) {

	query := `
		SELECT 
			o.status,
			COUNT(*) as count
		FROM orders o
		INNER JOIN order_items oi ON oi.order_id = o.id
		WHERE oi.event_id = $1
		GROUP BY o.status
	`

	var results []struct {
		Status string `db:"status"`
		Count  int    `db:"count"`
	}

	err := r.DB.SelectContext(ctx, &results, query, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get order metrics: %w", err)
	}

	metrics := &models.OrderMetricsRaw{}

	for _, result := range results {
		metrics.Total += result.Count

		switch result.Status {
		case "success":
			metrics.Successful = result.Count
		case "pending":
			metrics.Pending = result.Count
		case "failed":
			metrics.Failed = result.Count
		case "fraud":
			metrics.Fraud = result.Count
		}
	}

	return metrics, nil
}

// GetRevenueMetrics fetches financial data from successful orders
func (r *PostgresAnalyticsRepository) GetRevenueMetrics(
	ctx context.Context,
	eventID uuid.UUID,
) (*models.RevenueMetricsRaw, error) {

	query := `
		SELECT 
			SUM(o.final_total) as total_revenue,
			SUM(o.subtotal) as subtotal_revenue,
			SUM(o.service_fee) as service_fees,
			SUM(o.vat_amount) as vat_amount,
			COUNT(DISTINCT o.id) as order_count,
			AVG(o.final_total) as avg_order_value
		FROM orders o
		INNER JOIN order_items oi ON oi.order_id = o.id
		WHERE oi.event_id = $1 AND o.status = 'success'
	`

	var result struct {
		TotalRevenue     sql.NullInt64   `db:"total_revenue"`
		SubtotalRevenue  sql.NullInt64   `db:"subtotal_revenue"`
		ServiceFees      sql.NullInt64   `db:"service_fees"`
		VATAmount        sql.NullInt64   `db:"vat_amount"`
		OrderCount       sql.NullInt64   `db:"order_count"`
		AvgOrderValue    sql.NullFloat64 `db:"avg_order_value"`
	}

	err := r.DB.GetContext(ctx, &result, query, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get revenue metrics: %w", err)
	}

	metrics := &models.RevenueMetricsRaw{
		TotalRevenue:     int(result.TotalRevenue.Int64),
		SubtotalRevenue:  int(result.SubtotalRevenue.Int64),
		ServiceFees:      int(result.ServiceFees.Int64),
		VATAmount:        int(result.VATAmount.Int64),
		OrderCount:       int(result.OrderCount.Int64),
		TotalOrderValue:  result.AvgOrderValue.Float64,
	}

	return metrics, nil
}

// ============================================================================
// CUSTOMER QUERIES
// ============================================================================

// GetCustomerMetrics fetches unique customer count
func (r *PostgresAnalyticsRepository) GetCustomerMetrics(
	ctx context.Context,
	eventID uuid.UUID,
) (*models.CustomerMetricsRaw, error) {

	query := `
		SELECT 
			ARRAY_AGG(DISTINCT o.customer_email) as unique_emails,
			COUNT(DISTINCT o.id) as total_orders
		FROM orders o
		INNER JOIN order_items oi ON oi.order_id = o.id
		WHERE oi.event_id = $1 AND o.status = 'success'
	`

	var result struct {
		UniqueEmails []string `db:"unique_emails"`
		TotalOrders  int      `db:"total_orders"`
	}

	err := r.DB.GetContext(ctx, &result, query, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer metrics: %w", err)
	}

	metrics := &models.CustomerMetricsRaw{
		UniqueEmails: result.UniqueEmails,
		TotalOrders:  result.TotalOrders,
	}

	return metrics, nil
}

// GetTopCountries fetches top countries by revenue (requires country field)
func (r *PostgresAnalyticsRepository) GetTopCountries(
	ctx context.Context,
	eventID uuid.UUID,
	limit int,
) ([]models.CountryData, error) {

	// Note: This assumes you have a 'country' field in orders table
	// If not, you may need to add it or modify this query
	query := `
		SELECT 
			o.country,
			COUNT(DISTINCT o.id) as order_count,
			SUM(o.final_total) as revenue,
			SUM(oi.quantity) as tickets_sold
		FROM orders o
		INNER JOIN order_items oi ON oi.order_id = o.id
		WHERE oi.event_id = $1 AND o.status = 'success' AND o.country IS NOT NULL
		GROUP BY o.country
		ORDER BY revenue DESC
		LIMIT $2
	`

	var results []struct {
		Country     string `db:"country"`
		OrderCount  int    `db:"order_count"`
		Revenue     int    `db:"revenue"`
		TicketsSold int    `db:"tickets_sold"`
	}

	err := r.DB.SelectContext(ctx, &results, query, eventID, limit)
	if err != nil {
		// If country column doesn't exist, return empty slice
		if err == sql.ErrNoRows {
			return []models.CountryData{}, nil
		}
		return nil, fmt.Errorf("failed to get top countries: %w", err)
	}

	countryData := make([]models.CountryData, len(results))
	for i, result := range results {
		countryData[i] = models.CountryData{
			Country:     result.Country,
			OrderCount:  result.OrderCount,
			TicketsSold: result.TicketsSold,
			Revenue:     result.Revenue,
		}
	}

	return countryData, nil
}

// ============================================================================
// PAYMENT QUERIES
// ============================================================================

// GetPaymentChannels fetches payment method breakdown
func (r *PostgresAnalyticsRepository) GetPaymentChannels(
	ctx context.Context,
	eventID uuid.UUID,
) ([]models.PaymentChannelRaw, error) {

	query := `
		SELECT 
			o.payment_channel as channel,
			COUNT(DISTINCT o.id) as order_count,
			SUM(CASE WHEN o.status = 'success' THEN o.final_total ELSE 0 END) as revenue,
			SUM(CASE WHEN o.status = 'success' THEN 1 ELSE 0 END) as success_count,
			SUM(CASE WHEN o.status = 'failed' THEN 1 ELSE 0 END) as fail_count
		FROM orders o
		INNER JOIN order_items oi ON oi.order_id = o.id
		WHERE oi.event_id = $1 
			AND o.payment_channel IS NOT NULL 
			AND o.payment_channel != ''
		GROUP BY o.payment_channel
		ORDER BY revenue DESC
	`

	var results []struct {
		Channel      sql.NullString `db:"channel"`
		OrderCount   int            `db:"order_count"`
		Revenue      int            `db:"revenue"`
		SuccessCount int            `db:"success_count"`
		FailCount    int            `db:"fail_count"`
	}

	err := r.DB.SelectContext(ctx, &results, query, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get payment channels: %w", err)
	}

	channels := make([]models.PaymentChannelRaw, len(results))
	for i, result := range results {
		channel := "unknown"
		if result.Channel.Valid {
			channel = result.Channel.String
		}

		channels[i] = models.PaymentChannelRaw{
			Channel:      channel,
			OrderCount:   result.OrderCount,
			Revenue:      result.Revenue,
			SuccessCount: result.SuccessCount,
			FailCount:    result.FailCount,
		}
	}

	return channels, nil
}

// ============================================================================
// TIMELINE QUERIES
// ============================================================================

// GetSalesTimeline fetches sales data grouped by time period
func (r *PostgresAnalyticsRepository) GetSalesTimeline(
	ctx context.Context,
	eventID uuid.UUID,
	groupBy string,
) ([]models.TimelineData, error) {

	// Determine date truncation based on grouping
	var dateFormat string
	switch groupBy {
	case "day":
		dateFormat = "DATE(o.paid_at)"
	case "week":
		dateFormat = "DATE_TRUNC('week', o.paid_at)"
	case "month":
		dateFormat = "DATE_TRUNC('month', o.paid_at)"
	default:
		dateFormat = "DATE(o.paid_at)"
	}

	query := fmt.Sprintf(`
		SELECT 
			TO_CHAR(%s, 'YYYY-MM-DD') as date,
			SUM(oi.quantity) as tickets_sold,
			SUM(oi.subtotal) as revenue,
			COUNT(DISTINCT o.id) as order_count
		FROM orders o
		INNER JOIN order_items oi ON oi.order_id = o.id
		WHERE oi.event_id = $1 
			AND o.status = 'success' 
			AND o.paid_at IS NOT NULL
		GROUP BY %s
		ORDER BY date ASC
	`, dateFormat, dateFormat)

	var results []struct {
		Date        string `db:"date"`
		TicketsSold int    `db:"tickets_sold"`
		Revenue     int    `db:"revenue"`
		OrderCount  int    `db:"order_count"`
	}

	err := r.DB.SelectContext(ctx, &results, query, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get sales timeline: %w", err)
	}

	timeline := make([]models.TimelineData, len(results))
	for i, result := range results {
		timeline[i] = models.TimelineData{
			Date:        result.Date,
			TicketsSold: result.TicketsSold,
			Revenue:     result.Revenue,
			OrderCount:  result.OrderCount,
		}
	}

	return timeline, nil
}