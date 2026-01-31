// backend/pkg/repository/event/event_read_repo.go

package event

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// GetEventByID retrieves an event with its ticket tiers and social stats
func (r *postgresEventRepository) GetEventByID(
	ctx context.Context,
	eventID uuid.UUID,
	userID *uuid.UUID,
) (*models.Event, error) {
	log.Printf("🔍 [GetEventByID START] Fetching event: %s, UserID: %v", eventID, userID)
	
	query := `
		SELECT 
			e.id, e.organizer_id, e.event_title, e.event_description, e.event_slug,
			e.category, e.event_type, e.event_image_url, e.venue_name, e.venue_address,
			e.city, e.state, e.country, e.virtual_platform, e.meeting_link,
			e.start_date, e.end_date, e.max_attendees, e.paystack_subaccount_code,
			e.tags, e.is_deleted, e.deleted_at, e.created_at, e.updated_at,
			COALESCE(
				json_agg(
					json_build_object(
						'id', tt.id,
						'tierName', tt.name,
						'price', tt.price_kobo,
						'quantity', tt.capacity,
						'description', tt.description,
						'soldCount', tt.sold,
						'available', tt.available
					) ORDER BY tt.price_kobo ASC
				) FILTER (WHERE tt.id IS NOT NULL),
				'[]'
			) as ticket_tiers
		FROM events e
		LEFT JOIN ticket_tiers tt ON e.id = tt.event_id
		WHERE e.id = $1 AND e.is_deleted = false
		GROUP BY e.id
	`

	var event models.Event
	var ticketTiersJSON []byte
	var tags pq.StringArray

	log.Printf("📊 [GetEventByID] Executing SQL query for event: %s", eventID)
	
	err := r.db.QueryRowContext(ctx, query, eventID).Scan(
		&event.ID, &event.OrganizerID, &event.EventTitle, &event.EventDescription,
		&event.EventSlug, &event.Category, &event.EventType, &event.EventImageURL,
		&event.VenueName, &event.VenueAddress, &event.City, &event.State,
		&event.Country, &event.VirtualPlatform, &event.MeetingLink,
		&event.StartDate, &event.EndDate, &event.MaxAttendees,
		&event.PaystackSubaccountCode, &tags, &event.IsDeleted,
		&event.DeletedAt, &event.CreatedAt, &event.UpdatedAt,
		&ticketTiersJSON,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("❌ [GetEventByID] Event not found: %s", eventID)
			return nil, fmt.Errorf("event not found")
		}
		log.Printf("❌ [GetEventByID] Database error: %v", err)
		return nil, fmt.Errorf("failed to fetch event: %w", err)
	}

	log.Printf("✅ [GetEventByID] Query successful")

	// ✅ CRITICAL: Handle ticket tiers with single conversion
	if len(ticketTiersJSON) > 0 && string(ticketTiersJSON) != "[]" {
		log.Printf("🎫 [GetEventByID] Processing ticket tiers...")
		log.Printf("   Raw JSON from DB: %s", string(ticketTiersJSON))
		
		// Unmarshal ticket tiers
		if err := json.Unmarshal(ticketTiersJSON, &event.TicketTiers); err != nil {
			log.Printf("❌ [GetEventByID] Failed to unmarshal ticket tiers: %v", err)
			return nil, fmt.Errorf("failed to parse ticket tiers: %w", err)
		}

		log.Printf("✅ [GetEventByID] Successfully unmarshaled %d ticket tiers", len(event.TicketTiers))
		
		// ✅ SINGLE CONVERSION: Kobo to Naira
		for i := range event.TicketTiers {
			// The Price field now contains kobo value from JSON (e.g., 50000000)
			koboValue := int64(event.TicketTiers[i].Price)
			
			// Convert to Naira (divide by 100)
			nairaValue := float64(koboValue) / 100.0
			
			// Store both values
			event.TicketTiers[i].PriceKobo = koboValue      // Keep original kobo (internal use)
			event.TicketTiers[i].Price = nairaValue         // Naira for API response
			
			log.Printf("💰 [Ticket %d] %s:", i+1, event.TicketTiers[i].Name)
			log.Printf("   Kobo (from DB): %d", koboValue)
			log.Printf("   Naira (for API): %.2f", nairaValue)
			log.Printf("   Calculation: %d ÷ 100 = %.2f", koboValue, nairaValue)
		}
	} else {
		log.Printf("📭 [GetEventByID] No ticket tiers found")
		event.TicketTiers = []models.TicketTier{}
	}

	event.Tags = []string(tags)

	// Get social stats
	log.Printf("❤️ [GetEventByID] Fetching social stats...")
	var likeCount int
	if err := r.db.GetContext(ctx, &likeCount, 
		`SELECT COUNT(*) FROM likes WHERE event_id = $1`, eventID); err != nil {
		log.Printf("⚠️ [GetEventByID] Error fetching like count: %v", err)
		likeCount = 0
	}
	event.LikesCount = likeCount

	// Check if user has liked the event
	if userID != nil {
		var isLiked bool
		if err := r.db.GetContext(ctx, &isLiked, 
			`SELECT EXISTS(SELECT 1 FROM likes WHERE event_id = $1 AND user_id = $2)`, 
			eventID, userID); err != nil {
			log.Printf("⚠️ [GetEventByID] Error checking if liked: %v", err)
			isLiked = false
		}
		event.IsLiked = isLiked
	} else {
		event.IsLiked = false
	}

	log.Printf("🎉 [GetEventByID COMPLETE] Event %s retrieved successfully", eventID)
	log.Printf("   Tickets: %d", len(event.TicketTiers))
	if len(event.TicketTiers) > 0 {
		log.Printf("   First ticket price (Naira): %.2f", event.TicketTiers[0].Price)
	}
	
	return &event, nil
}

// GetEvents retrieves events with optional filters
func (r *postgresEventRepository) GetEvents(
	ctx context.Context,
	filters EventFilters,
) ([]*models.Event, error) {
	query := `
		SELECT 
			e.id, e.organizer_id, e.event_title, e.event_description, e.event_slug,
			e.category, e.event_type, e.event_image_url, e.venue_name, e.venue_address,
			e.city, e.state, e.country, e.virtual_platform, e.meeting_link,
			e.start_date, e.end_date, e.max_attendees, e.paystack_subaccount_code,
			e.tags, e.is_deleted, e.deleted_at, e.created_at, e.updated_at,
			COALESCE(
				json_agg(
					json_build_object(
						'id', tt.id,
						'tierName', tt.name,
						'price', tt.price_kobo,
						'quantity', tt.capacity,
						'description', tt.description,
						'soldCount', tt.sold,
						'available', tt.available
					) ORDER BY tt.price_kobo ASC
				) FILTER (WHERE tt.id IS NOT NULL),
				'[]'
			) as ticket_tiers
		FROM events e
		LEFT JOIN ticket_tiers tt ON e.id = tt.event_id
		WHERE e.is_deleted = $1
	`

	args := []interface{}{filters.IsDeleted}
	paramIndex := 2

	// Apply filters
	if filters.OrganizerID != nil {
		query += fmt.Sprintf(" AND e.organizer_id = $%d", paramIndex)
		args = append(args, *filters.OrganizerID)
		paramIndex++
	}
	if filters.Category != nil {
		query += fmt.Sprintf(" AND e.category = $%d", paramIndex)
		args = append(args, *filters.Category)
		paramIndex++
	}
	if filters.City != nil {
		query += fmt.Sprintf(" AND e.city = $%d", paramIndex)
		args = append(args, *filters.City)
		paramIndex++
	}
	if filters.State != nil {
		query += fmt.Sprintf(" AND e.state = $%d", paramIndex)
		args = append(args, *filters.State)
		paramIndex++
	}
	if filters.Country != nil {
		query += fmt.Sprintf(" AND e.country = $%d", paramIndex)
		args = append(args, *filters.Country)
		paramIndex++
	}
	if filters.EventType != nil {
		query += fmt.Sprintf(" AND e.event_type = $%d", paramIndex)
		args = append(args, *filters.EventType)
		paramIndex++
	}
	if filters.StartDate != nil {
		query += fmt.Sprintf(" AND e.start_date >= $%d", paramIndex)
		args = append(args, *filters.StartDate)
		paramIndex++
	}
	if filters.EndDate != nil {
		query += fmt.Sprintf(" AND e.end_date <= $%d", paramIndex)
		args = append(args, *filters.EndDate)
		paramIndex++
	}

	query += " GROUP BY e.id ORDER BY e.start_date DESC"

	// Apply pagination
	if filters.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", paramIndex)
		args = append(args, filters.Limit)
		paramIndex++
	}
	if filters.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", paramIndex)
		args = append(args, filters.Offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	var events []*models.Event
	for rows.Next() {
		var event models.Event
		var ticketTiersJSON []byte
		var tags pq.StringArray

		err := rows.Scan(
			&event.ID, &event.OrganizerID, &event.EventTitle, &event.EventDescription,
			&event.EventSlug, &event.Category, &event.EventType, &event.EventImageURL,
			&event.VenueName, &event.VenueAddress, &event.City, &event.State,
			&event.Country, &event.VirtualPlatform, &event.MeetingLink,
			&event.StartDate, &event.EndDate, &event.MaxAttendees,
			&event.PaystackSubaccountCode, &tags, &event.IsDeleted,
			&event.DeletedAt, &event.CreatedAt, &event.UpdatedAt,
			&ticketTiersJSON,
		)

		if err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}

		if len(ticketTiersJSON) > 0 {
			if err := json.Unmarshal(ticketTiersJSON, &event.TicketTiers); err != nil {
				return nil, fmt.Errorf("failed to parse ticket tiers for event %s: %w", event.ID, err)
			}
		}

		event.Tags = []string(tags)
		events = append(events, &event)
	}

	return events, nil
}

// GetEventTicketTiers retrieves all ticket tiers for an event
func (r *postgresEventRepository) GetEventTicketTiers(
	ctx context.Context,
	eventID uuid.UUID,
) ([]models.TicketTier, error) {
	
	query := `
		SELECT 
			id, event_id, name, description, price_kobo, 
			capacity, sold, available, created_at, updated_at
		FROM ticket_tiers
		WHERE event_id = $1
		ORDER BY price_kobo ASC
	`

	var tiers []models.TicketTier
	err := r.db.SelectContext(ctx, &tiers, query, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get ticket tiers for event %s: %w", eventID, err)
	}

	return tiers, nil
}

// GetTierDetails retrieves details for a specific tier (for legacy name-based processing)
func (r *postgresEventRepository) GetTierDetails(
	ctx context.Context,
	eventID uuid.UUID,
	tierName string,
) (*models.TierDetails, error) { // ✅ Updated return type to models.TierDetails
	query := `
		SELECT 
			e.id as event_id,
			e.title as event_title, -- Changed from event_title to title to match DB schema
			e.end_date,
			tt.id as ticket_tier_id,
			tt.name,
			tt.price_kobo,
			tt.capacity,
			tt.sold,
			tt.available
		FROM events e
		JOIN ticket_tiers tt ON e.id = tt.event_id
		WHERE e.id = $1 
			AND tt.name = $2 
			AND e.is_deleted = false
			AND e.end_date > NOW()
	`

	var details models.TierDetails // ✅ Updated variable type
	err := r.db.GetContext(ctx, &details, query, eventID, tierName)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("tier not found, event deleted, or event has already ended")
		}
		return nil, fmt.Errorf("failed to get fresh tier details: %w", err)
	}

	return &details, nil
}

// GetTierDetailsByID retrieves tier details using only the UUID
func (r *postgresEventRepository) GetTierDetailsByID(ctx context.Context, tierID uuid.UUID) (*models.TierDetails, error) {
    query := `
        SELECT 
            e.id as event_id,
            e.event_title,
            e.end_date,
            tt.id as ticket_tier_id,
            tt.name,
            tt.price_kobo,
            tt.capacity,
            tt.sold,
            tt.available
        FROM events e
        JOIN ticket_tiers tt ON e.id = tt.event_id
        WHERE tt.id = $1 
          AND e.is_deleted = false
          AND e.end_date > NOW()
    `
    
    var details models.TierDetails // Points to models package now
    err := r.db.GetContext(ctx, &details, query, tierID)
    if err != nil {
        if err == sql.ErrNoRows {
            return nil, fmt.Errorf("ticket tier not found or event inactive")
        }
        return nil, fmt.Errorf("failed to get tier details by ID: %w", err)
    }
    
    return &details, nil
}

// CheckTicketAvailability checks if a specific tier has enough inventory
func (r *postgresEventRepository) CheckTicketAvailability(
	ctx context.Context,
	tierID uuid.UUID,
	quantity int32,
) (bool, error) {
	query := `
		SELECT available >= $1
		FROM ticket_tiers
		WHERE id = $2
	`

	var enough bool
	err := r.db.GetContext(ctx, &enough, query, quantity, tierID)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, fmt.Errorf("ticket tier with ID %s does not exist", tierID)
		}
		return false, fmt.Errorf("availability check failed: %w", err)
	}

	return enough, nil
}

// GetEventWithStats retrieves event with analytics data
func (r *postgresEventRepository) GetEventWithStats(
	ctx context.Context,
	eventID uuid.UUID,
) (*EventWithStats, error) {
	// Get the event
	event, err := r.GetEventByID(ctx, eventID, nil)
	if err != nil {
		return nil, err
	}

	// Get stats
	statsQuery := `
		SELECT 
			COALESCE(COUNT(*), 0) as total_tickets_sold,
			COALESCE(SUM(price_paid), 0) as total_revenue
		FROM tickets
		WHERE event_id = $1
	`

	var stats EventWithStats
	stats.Event = event

	err = r.db.QueryRowContext(ctx, statsQuery, eventID).Scan(
		&stats.TotalTicketsSold,
		&stats.TotalRevenue,
	)

	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}

	return &stats, nil
}