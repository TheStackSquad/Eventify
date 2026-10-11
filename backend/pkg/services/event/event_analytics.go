// backend/pkg/services/event/event_analytics.go

package event

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
)

// EventAnalytics contains aggregated analytics data for an event
type EventAnalytics struct {
	EventID        uuid.UUID   `json:"eventId"`
	EventTitle     string      `json:"eventTitle"`
	TotalInventory int32       `json:"totalInventory"`
	TicketsSold    int32       `json:"ticketsSold"`
	TicketsLeft    int32       `json:"ticketsLeft"`
	TotalRevenue   float64     `json:"totalRevenue"`   // In Naira
	ConversionRate float64     `json:"conversionRate"`
	TierBreakdown  []TierStats `json:"tierBreakdown"`
}

// TierStats contains analytics for a specific ticket tier
type TierStats struct {
	TierName  string  `json:"tierName"`
	Capacity  int32   `json:"capacity"`
	Sold      int32   `json:"sold"`
	Available int32   `json:"available"`
	Revenue   float64 `json:"revenue"` // In Naira
	Price     float64 `json:"price"`   // In Naira
}

// GetEventAnalytics retrieves comprehensive analytics for an event
func (s *eventService) GetEventAnalytics(
	ctx context.Context,
	eventID, organizerID uuid.UUID,
) (*EventAnalytics, error) {
	// Verify ownership and get basic event info
	event, err := s.eventRepo.GetEventByID(ctx, eventID, nil)
	if err != nil {
		return nil, fmt.Errorf("event not found: %w", err)
	}

	if event.OrganizerID != organizerID {
		return nil, errors.New("unauthorized: you don't own this event")
	}

	// Query ticket tier data
	query := `
		SELECT 
			name,
			price_kobo,
			capacity,
			sold,
			available
		FROM ticket_tiers
		WHERE event_id = $1
		ORDER BY price_kobo DESC
	`

	rows, err := s.db.QueryContext(ctx, query, eventID)
	if err != nil {
		return nil, fmt.Errorf("analytics query failed: %w", err)
	}
	defer rows.Close()

	// Process tier data
	var tierBreakdown []TierStats
	var totalInventory, totalSold int32
	var totalRevenueKobo int64 // Use int64 to prevent overflow

	for rows.Next() {
		var tierName string
		var priceKobo, capacity, sold, available int32

		err := rows.Scan(
			&tierName,
			&priceKobo,
			&capacity,
			&sold,
			&available,
		)
		if err != nil {
			return nil, err
		}

		// Convert Kobo to Naira for financial calculations
		tierRevenueNaira := (float64(sold) * float64(priceKobo)) / 100.0
		tierPriceNaira := float64(priceKobo) / 100.0

		tierStats := TierStats{
			TierName:  tierName,
			Capacity:  capacity,
			Sold:      sold,
			Available: available,
			Revenue:   tierRevenueNaira,
			Price:     tierPriceNaira,
		}

		tierBreakdown = append(tierBreakdown, tierStats)
		totalInventory += capacity
		totalSold += sold
		totalRevenueKobo += int64(sold) * int64(priceKobo)
	}

	// Calculate conversion rate
	conversionRate := 0.0
	if totalInventory > 0 {
		conversionRate = (float64(totalSold) / float64(totalInventory)) * 100
	}

	// Build analytics response
	analytics := &EventAnalytics{
		EventID:        eventID,
		EventTitle:     event.EventTitle,
		TotalInventory: totalInventory,
		TicketsSold:    totalSold,
		TicketsLeft:    totalInventory - totalSold,
		TotalRevenue:   float64(totalRevenueKobo) / 100.0, // Convert to Naira
		ConversionRate: conversionRate,
		TierBreakdown:  tierBreakdown,
	}

	return analytics, nil
}