// backend/pkg/services/event/event_analytics.go

package event

import (
	"context"
	"fmt"
	"errors"
	"github.com/google/uuid"
)

type EventAnalytics struct {
	EventID        uuid.UUID   `json:"eventId"`
	EventTitle     string      `json:"eventTitle"`
	TotalInventory int32       `json:"totalInventory"`
	TicketsSold    int32       `json:"ticketsSold"`
	TicketsLeft    int32       `json:"ticketsLeft"`
	TotalRevenue   float64     `json:"totalRevenue"`
	ConversionRate float64     `json:"conversionRate"`
	TierBreakdown  []TierStats `json:"tierBreakdown"`
}

type TierStats struct {
	TierName   string  `json:"tierName"`
	TotalStock int32   `json:"totalStock"`
	Sold       int32   `json:"sold"`
	Available  int32   `json:"available"`
	Revenue    float64 `json:"revenue"`
	Price      float64 `json:"price"`
}

// GET EVENT ANALYTICS (Real Aggregation)

func (s *eventService) GetEventAnalytics(
	ctx context.Context,
	eventID, organizerID uuid.UUID,
) (*EventAnalytics, error) {
	// Verify ownership
	event, err := s.eventRepo.GetEventByID(ctx, eventID, nil)
	if err != nil {
		return nil, fmt.Errorf("event not found: %w", err)
	}
	
	if event.OrganizerID != organizerID {
		return nil, errors.New("unauthorized: you don't own this event")
	}
	
	// Query for tier statistics
	query := `
		SELECT 
			tt.tier_name,
			tt.price,
			tt.quantity as total_stock,
			COALESCE(COUNT(t.id), 0) as sold,
			tt.quantity - COALESCE(COUNT(t.id), 0) as available,
			COALESCE(SUM(t.price_paid), 0) as revenue
		FROM ticket_tiers tt
		LEFT JOIN tickets t ON tt.event_id = t.event_id 
		                    AND tt.tier_name = t.tier_name
		WHERE tt.event_id = $1
		GROUP BY tt.id, tt.tier_name, tt.price, tt.quantity
		ORDER BY tt.price DESC
	`
	
	rows, err := s.db.QueryContext(ctx, query, eventID)
	if err != nil {
		return nil, fmt.Errorf("analytics query failed: %w", err)
	}
	defer rows.Close()
	
	var tierBreakdown []TierStats
	var totalInventory, totalSold int32
	var totalRevenue float64
	
	for rows.Next() {
		var tier TierStats
		err := rows.Scan(
			&tier.TierName,
			&tier.Price,
			&tier.TotalStock,
			&tier.Sold,
			&tier.Available,
			&tier.Revenue,
		)
		if err != nil {
			return nil, err
		}
		
		tierBreakdown = append(tierBreakdown, tier)
		totalInventory += tier.TotalStock
		totalSold += tier.Sold
		totalRevenue += tier.Revenue
	}
	
	// Calculate conversion rate (mock for now - requires visit tracking)
	conversionRate := 0.0
	if totalInventory > 0 {
		conversionRate = (float64(totalSold) / float64(totalInventory)) * 100
	}
	
	analytics := &EventAnalytics{
		EventID:        eventID,
		EventTitle:     event.EventTitle,
		TotalInventory: totalInventory,
		TicketsSold:    totalSold,
		TicketsLeft:    totalInventory - totalSold,
		TotalRevenue:   totalRevenue,
		ConversionRate: conversionRate,
		TierBreakdown:  tierBreakdown,
	}
	
	return analytics, nil
}