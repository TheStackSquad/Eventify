// backend/pkg/services/analytics/analytics_calculations.go
// Business logic for analytics - calculation methods

package analytics

import (
	"time"

	"eventify/backend/pkg/models"
)

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