// backend/pkg/services/analytics/analytics_service.go
// Business logic for analytics - interface and main orchestration method

package analytics

import (
	"context"
	"fmt"

	"eventify/backend/pkg/analytics"
	"eventify/backend/pkg/models"

	"github.com/google/uuid"
)

// ============================================================================
// INTERFACE
// ============================================================================

// AnalyticsService defines methods for analytics business logic
type AnalyticsService interface {
	GetEventAnalytics(ctx context.Context, eventID, organizerID uuid.UUID, includeTimeline bool) (*models.AnalyticsResponse, error)
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
	eventID, organizerID uuid.UUID,
	includeTimeline bool,
) (*models.AnalyticsResponse, error) {

	// Step 1: Get event basic info and verify ownership
	eventInfo, err := s.repo.GetEventInfo(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get event info: %w", err)
	}

	// Step 2: Verify organizer owns this event
	if eventInfo.OrganizerID != organizerID.String() {
		return nil, fmt.Errorf("unauthorized: event does not belong to this organizer")
	}

	// Step 3: Fetch all analytics data
	ticketsSold, err := s.repo.GetTicketsSold(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tickets sold: %w", err)
	}

	ticketsByTier, err := s.repo.GetTicketsSoldByTier(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tickets by tier: %w", err)
	}

	orderMetrics, err := s.repo.GetOrderMetrics(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get order metrics: %w", err)
	}

	revenueMetrics, err := s.repo.GetRevenueMetrics(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get revenue metrics: %w", err)
	}

	customerMetrics, err := s.repo.GetCustomerMetrics(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get customer metrics: %w", err)
	}

	topCountries, err := s.repo.GetTopCountries(ctx, eventID, 5)
	if err != nil {
		// Don't fail if countries not available
		topCountries = []models.CountryData{}
	}

	paymentChannels, err := s.repo.GetPaymentChannels(ctx, eventID)
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
		EventID:    eventID.String(),
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
		timeline, err := s.repo.GetSalesTimeline(ctx, eventID, "day")
		if err == nil && len(timeline) > 0 {
			response.Timeline = s.calculateTimeline(timeline)
		}
	}

	return response, nil
}