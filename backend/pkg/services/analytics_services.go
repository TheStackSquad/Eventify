// backend/pkg/services/analytics_services.go
// Business logic for analytics - calculations, transformations, validation

package services

import (
	"context"
	"fmt"
	"time"

	"eventify/backend/pkg/analytics"
	"eventify/backend/pkg/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ============================================================================
// INTERFACE
// ============================================================================

// AnalyticsService defines methods for analytics business logic
type AnalyticsService interface {
	GetEventAnalytics(ctx context.Context, eventID, organizerID primitive.ObjectID, includeTimeline bool) (*models.AnalyticsResponse, error)
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

// AnalyticsServiceImpl implements AnalyticsService
type AnalyticsServiceImpl struct {
	repo analytics.AnalyticsRepository
}

// NewAnalyticsService creates a new analytics service instance
func NewAnalyticsService(repo analytics.AnalyticsRepository) AnalyticsService {
	return &AnalyticsServiceImpl{
		repo: repo,
	}
}

// ============================================================================
// MAIN METHOD - GET EVENT ANALYTICS
// ============================================================================

// GetEventAnalytics retrieves and calculates analytics for a single event
func (s *AnalyticsServiceImpl) GetEventAnalytics(
	ctx context.Context,
	eventID, organizerID primitive.ObjectID,
	includeTimeline bool,
) (*models.AnalyticsResponse, error) {

	// Step 1: Get event basic info and verify ownership
	eventInfo, err := s.repo.GetEventInfo(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get event info: %w", err)
	}

	// Step 2: Verify organizer owns this event
	if eventInfo.OrganizerID != organizerID.Hex() {
		return nil, fmt.Errorf("unauthorized: event does not belong to this organizer")
	}

	eventIDStr := eventID.Hex()

	// Step 3: Fetch all analytics data in parallel (could use goroutines for optimization)
	// For simplicity, we'll do sequential calls. In production, use sync.WaitGroup

	// Tickets data
	ticketsSold, err := s.repo.GetTicketsSold(ctx, eventIDStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get tickets sold: %w", err)
	}

	ticketsByTier, err := s.repo.GetTicketsSoldByTier(ctx, eventIDStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get tickets by tier: %w", err)
	}

	// Order data
	orderMetrics, err := s.repo.GetOrderMetrics(ctx, eventIDStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get order metrics: %w", err)
	}

	// Revenue data
	revenueMetrics, err := s.repo.GetRevenueMetrics(ctx, eventIDStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get revenue metrics: %w", err)
	}

	// Customer data
	customerMetrics, err := s.repo.GetCustomerMetrics(ctx, eventIDStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer metrics: %w", err)
	}

	// Geographic data
	topCountries, err := s.repo.GetTopCountries(ctx, eventIDStr, 5)
	if err != nil {
		return nil, fmt.Errorf("failed to get top countries: %w", err)
	}

	// Payment data
	paymentChannels, err := s.repo.GetPaymentChannels(ctx, eventIDStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get payment channels: %w", err)
	}

	// Step 4: Calculate metrics and build response
	overview := s.calculateOverview(eventInfo, int(ticketsSold), orderMetrics, revenueMetrics)
	tickets := s.calculateTickets(eventInfo, int(ticketsSold))
	revenue := s.calculateRevenue(revenueMetrics, int(ticketsSold))
	tiers := s.calculateTiers(eventInfo, ticketsByTier)
	orders := s.calculateOrders(orderMetrics)
	customers := s.calculateCustomers(customerMetrics, topCountries, revenueMetrics.TotalRevenue)
	payments := s.calculatePayments(paymentChannels, revenueMetrics.TotalRevenue)

	// Build response
	response := &models.AnalyticsResponse{
		EventID:    eventIDStr,
		EventTitle: eventInfo.Title,
		Overview:   overview,
		Tickets:    tickets,
		Revenue:    revenue,
		Tiers:      tiers,
		Orders:     orders,
		Customers:  customers,
		Payments:   payments,
	}

	// Step 5: Optionally include timeline
	if includeTimeline {
		timeline, err := s.repo.GetSalesTimeline(ctx, eventIDStr, "day")
		if err == nil && len(timeline) > 0 {
			response.Timeline = s.calculateTimeline(timeline)
		}
	}

	return response, nil
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

// calculateOverview builds the overview metrics
func (s *AnalyticsServiceImpl) calculateOverview(
	eventInfo *models.EventBasicInfo,
	ticketsSold int,
	orderMetrics *models.OrderMetricsRaw,
	revenueMetrics *models.RevenueMetricsRaw,
) models.OverviewData {

	// Calculate total inventory
	totalInventory := 0
	for _, tier := range eventInfo.TicketTiers {
		totalInventory += tier.Quantity
	}

	// Calculate sell-through rate
	sellThroughRate := 0.0
	if totalInventory > 0 {
		sellThroughRate = (float64(ticketsSold) / float64(totalInventory)) * 100
	}

	// Calculate conversion rate
	conversionRate := 0.0
	if orderMetrics.Total > 0 {
		conversionRate = (float64(orderMetrics.Successful) / float64(orderMetrics.Total)) * 100
	}

	// Determine event status
	now := time.Now()
	status := "upcoming"
	if now.After(eventInfo.StartDate) && now.Before(eventInfo.EndDate) {
		status = "ongoing"
	} else if now.After(eventInfo.EndDate) {
		status = "ended"
	}

	// Calculate days until event
	daysUntil := int(eventInfo.StartDate.Sub(now).Hours() / 24)

	return models.OverviewData{
		Status:          status,
		TotalRevenue:    revenueMetrics.TotalRevenue,
		TicketsSold:     ticketsSold,
		TotalOrders:     orderMetrics.Total,
		SellThroughRate: roundToTwoDecimals(sellThroughRate),
		ConversionRate:  roundToTwoDecimals(conversionRate),
		DaysUntilEvent:  daysUntil,
	}
}

// calculateTickets builds the tickets metrics
func (s *AnalyticsServiceImpl) calculateTickets(
	eventInfo *models.EventBasicInfo,
	ticketsSold int,
) models.TicketsData {

	// Calculate total inventory
	totalInventory := 0
	for _, tier := range eventInfo.TicketTiers {
		totalInventory += tier.Quantity
	}

	// Calculate remaining
	remaining := totalInventory - ticketsSold
	if remaining < 0 {
		remaining = 0
	}

	// Calculate sell-through rate
	sellThroughRate := 0.0
	if totalInventory > 0 {
		sellThroughRate = (float64(ticketsSold) / float64(totalInventory)) * 100
	}

	// Calculate velocity (tickets per day since event creation)
	// For now, use a simple calculation. In production, track event.created_at
	velocityPerDay := 0.0
	daysSinceCreation := 30.0 // Placeholder - should calculate from eventInfo.CreatedAt
	if daysSinceCreation > 0 {
		velocityPerDay = float64(ticketsSold) / daysSinceCreation
	}

	return models.TicketsData{
		TotalInventory:  totalInventory,
		TotalSold:       ticketsSold,
		TotalRemaining:  remaining,
		SellThroughRate: roundToTwoDecimals(sellThroughRate),
		VelocityPerDay:  roundToTwoDecimals(velocityPerDay),
	}
}

// calculateRevenue builds the revenue metrics
func (s *AnalyticsServiceImpl) calculateRevenue(
	metrics *models.RevenueMetricsRaw,
	ticketsSold int,
) models.RevenueData {

	// Calculate average ticket price
	avgTicketPrice := 0.0
	if ticketsSold > 0 {
		avgTicketPrice = float64(metrics.SubtotalRevenue) / float64(ticketsSold)
	}

	return models.RevenueData{
		Gross:              metrics.TotalRevenue,
		ServiceFees:        metrics.ServiceFees,
		VAT:                metrics.VATAmount,
		Net:                metrics.SubtotalRevenue, // What organizer receives
		AverageOrderValue:  roundToTwoDecimals(metrics.TotalOrderValue),
		AverageTicketPrice: roundToTwoDecimals(avgTicketPrice),
	}
}

// calculateTiers builds per-tier analytics
func (s *AnalyticsServiceImpl) calculateTiers(
	eventInfo *models.EventBasicInfo,
	soldByTier map[string]int64,
) []models.TierData {

	var tiers []models.TierData

	for _, tier := range eventInfo.TicketTiers {
		sold := int(soldByTier[tier.TierName])
		available := tier.Quantity - sold
		if available < 0 {
			available = 0
		}

		// Convert price from Naira to Kobo
		priceKobo := int(tier.Price * 100)

		// Calculate revenue
		revenue := priceKobo * sold

		// Calculate sell-through rate
		sellThroughRate := 0.0
		if tier.Quantity > 0 {
			sellThroughRate = (float64(sold) / float64(tier.Quantity)) * 100
		}

		// Determine popularity
		popularity := "low"
		if sellThroughRate > 80 {
			popularity = "high"
		} else if sellThroughRate > 50 {
			popularity = "medium"
		}

		tiers = append(tiers, models.TierData{
			TierName:        tier.TierName,
			PriceKobo:       priceKobo,
			TotalStock:      tier.Quantity,
			Sold:            sold,
			Available:       available,
			Revenue:         revenue,
			SellThroughRate: roundToTwoDecimals(sellThroughRate),
			Popularity:      popularity,
		})
	}

	return tiers
}

// calculateOrders builds order metrics
func (s *AnalyticsServiceImpl) calculateOrders(
	metrics *models.OrderMetricsRaw,
) models.OrdersData {

	// Calculate conversion rate
	conversionRate := 0.0
	if metrics.Total > 0 {
		conversionRate = (float64(metrics.Successful) / float64(metrics.Total)) * 100
	}

	// Calculate abandonment rate
	abandonmentRate := 0.0
	if metrics.Total > 0 {
		abandoned := metrics.Failed + metrics.Pending
		abandonmentRate = (float64(abandoned) / float64(metrics.Total)) * 100
	}

	return models.OrdersData{
		Total:           metrics.Total,
		Successful:      metrics.Successful,
		Pending:         metrics.Pending,
		Failed:          metrics.Failed,
		Fraud:           metrics.Fraud,
		ConversionRate:  roundToTwoDecimals(conversionRate),
		AbandonmentRate: roundToTwoDecimals(abandonmentRate),
	}
}

// calculateCustomers builds customer metrics
func (s *AnalyticsServiceImpl) calculateCustomers(
	metrics *models.CustomerMetricsRaw,
	topCountries []models.CountryData,
	totalRevenue int,
) models.CustomersData {

	// Count unique customers
	uniqueCustomers := len(metrics.UniqueEmails)

	// Calculate repeat customers (customers with >1 order)
	// For now, placeholder. In production, need more complex query
	repeatCustomers := 0
	if metrics.TotalOrders > uniqueCustomers {
		repeatCustomers = metrics.TotalOrders - uniqueCustomers
	}

	// Calculate percent of total for each country
	for i := range topCountries {
		if totalRevenue > 0 {
			topCountries[i].PercentOfTotal = roundToTwoDecimals(
				(float64(topCountries[i].Revenue) / float64(totalRevenue)) * 100,
			)
		}
	}

	return models.CustomersData{
		UniqueCustomers: uniqueCustomers,
		RepeatCustomers: repeatCustomers,
		TopCountries:    topCountries,
	}
}

// calculatePayments builds payment channel metrics
func (s *AnalyticsServiceImpl) calculatePayments(
	channels []models.PaymentChannelRaw,
	totalRevenue int,
) models.PaymentsData {

	if len(channels) == 0 {
		return models.PaymentsData{
			Channels:           []models.PaymentChannelData{},
			MostPopularChannel: "",
		}
	}

	var paymentChannels []models.PaymentChannelData
	mostPopular := ""
	maxRevenue := 0

	for _, ch := range channels {
		// Calculate percent of total
		percentOfTotal := 0.0
		if totalRevenue > 0 {
			percentOfTotal = (float64(ch.Revenue) / float64(totalRevenue)) * 100
		}

		// Calculate success rate
		successRate := 0.0
		totalAttempts := ch.SuccessCount + ch.FailCount
		if totalAttempts > 0 {
			successRate = (float64(ch.SuccessCount) / float64(totalAttempts)) * 100
		}

		paymentChannels = append(paymentChannels, models.PaymentChannelData{
			Channel:        ch.Channel,
			OrderCount:     ch.OrderCount,
			Revenue:        ch.Revenue,
			PercentOfTotal: roundToTwoDecimals(percentOfTotal),
			SuccessRate:    roundToTwoDecimals(successRate),
		})

		// Track most popular
		if ch.Revenue > maxRevenue {
			maxRevenue = ch.Revenue
			mostPopular = ch.Channel
		}
	}

	return models.PaymentsData{
		Channels:           paymentChannels,
		MostPopularChannel: mostPopular,
	}
}

// calculateTimeline builds timeline with cumulative data
func (s *AnalyticsServiceImpl) calculateTimeline(
	data []models.TimelineData,
) []models.TimelineData {

	cumulative := 0
	for i := range data {
		cumulative += data[i].TicketsSold
		data[i].CumulativeSold = cumulative
	}

	return data
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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