// backend/pkg/repository/event/event_read_repo.go

package event

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// ============================================================================
// READ OPERATIONS
// ============================================================================

// GetEventByID (with ticket tiers and optional like status)
func (r *postgresEventRepository) GetEventByID(
	ctx context.Context,
	eventID uuid.UUID,
	userID *uuid.UUID,
) (*models.Event, error) {
	
	query := `
    SELECT 
        e.id,
        e.organizer_id,
        e.event_title,
        e.event_description,
        e.event_slug,
        e.category,
        e.event_type,
        e.event_image_url,
        e.venue_name,
        e.venue_address,
        e.city,
        e.state,
        e.country,
        e.virtual_platform,
        e.meeting_link,
        e.start_date,
        e.end_date,
        e.max_attendees,
        e.paystack_subaccount_code,
        e.tags,
        e.is_deleted,
        e.deleted_at,
        e.created_at,
        e.updated_at,
        COALESCE(
            json_agg(
                json_build_object(
                'id', tt.id,
                'tierName', tt.name,
                'price', tt.price_kobo,
                'quantity', tt.capacity,
                'description', tt.description
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
	
	err := r.db.QueryRowContext(ctx, query, eventID).Scan(
		&event.ID,
		&event.OrganizerID,
		&event.EventTitle,
		&event.EventDescription,
		&event.EventSlug,
		&event.Category,
		&event.EventType,
		&event.EventImageURL,
		&event.VenueName,
		&event.VenueAddress,
		&event.City,
		&event.State,
		&event.Country,
		&event.VirtualPlatform,
		&event.MeetingLink,
		&event.StartDate,
		&event.EndDate,
		&event.MaxAttendees,
		&event.PaystackSubaccountCode,
		&tags,
		&event.IsDeleted,
		&event.DeletedAt,
		&event.CreatedAt,
		&event.UpdatedAt,
		&ticketTiersJSON,
	)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("event not found")
		}
		return nil, fmt.Errorf("failed to fetch event: %w", err)
	}
	
	// Parse ticket tiers
	if len(ticketTiersJSON) > 0 {
		if err := json.Unmarshal(ticketTiersJSON, &event.TicketTiers); err != nil {
			return nil, fmt.Errorf("failed to parse ticket tiers: %w", err)
		}
	}
	
	// Convert pq.StringArray to []string
	event.Tags = []string(tags)
	
	// Get like count (always needed)
	var likeCount int
	likeCountQuery := `SELECT COUNT(*) FROM event_likes WHERE event_id = $1`
	if err := r.db.GetContext(ctx, &likeCount, likeCountQuery, eventID); err != nil {
		likeCount = 0 // Default on error
	}
	event.LikesCount = likeCount
	
	// Get user's like status (if authenticated)
	if userID != nil {
		var isLiked bool
		isLikedQuery := `
			SELECT EXISTS(
				SELECT 1 FROM event_likes 
				WHERE event_id = $1 AND user_id = $2
			)
		`
		if err := r.db.GetContext(ctx, &isLiked, isLikedQuery, eventID, userID); err != nil {
			isLiked = false
		}
		event.IsLiked = isLiked
	}
	
	return &event, nil
}

// GetEvents (with filters and pagination)
func (r *postgresEventRepository) GetEvents(
	ctx context.Context,
	filters EventFilters,
) ([]*models.Event, error) {
	
	query := `
		SELECT 
			e.id,
			e.organizer_id,
			e.event_title,
			e.event_description,
			e.category,
			e.event_type,
			e.event_image_url,
			e.venue_name,
			e.venue_address,
			e.city,
			e.state,
			e.country,
			e.virtual_platform,
			e.meeting_link,
			e.start_date,
			e.end_date,
			e.max_attendees,
			e.paystack_subaccount_code,
			e.tags,
			e.is_deleted,
			e.deleted_at,
			e.created_at,
			e.updated_at,
		COALESCE(
    json_agg(
        json_build_object(
            'id', tt.id,
            'tierName', tt.name,             
            'price', tt.price_kobo,
            'quantity', tt.capacity,
            'description', tt.description
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
	
	// Build dynamic WHERE clauses
	if filters.OrganizerID != nil {
		query += fmt.Sprintf(" AND e.organizer_id = $%d", paramIndex)
		args = append(args, *filters.OrganizerID)
		paramIndex++
	}
	
	if filters.EventType != nil {
		query += fmt.Sprintf(" AND e.event_type = $%d", paramIndex)
		args = append(args, *filters.EventType)
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
	
	// GROUP BY and ORDER BY
	query += " GROUP BY e.id ORDER BY e.start_date DESC"
	
	// Pagination
	if filters.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", paramIndex)
		args = append(args, filters.Limit)
		paramIndex++
	}
	
	if filters.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", paramIndex)
		args = append(args, filters.Offset)
	}
	
	// Execute query
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
			&event.ID,
			&event.OrganizerID,
			&event.EventTitle,
			&event.EventDescription,
			&event.Category,
			&event.EventType,
			&event.EventImageURL,
			&event.VenueName,
			&event.VenueAddress,
			&event.City,
			&event.State,
			&event.Country,
			&event.VirtualPlatform,
			&event.MeetingLink,
			&event.StartDate,
			&event.EndDate,
			&event.MaxAttendees,
			&event.PaystackSubaccountCode,
			&tags,
			&event.IsDeleted,
			&event.DeletedAt,
			&event.CreatedAt,
			&event.UpdatedAt,
			&ticketTiersJSON,
		)
		
		if err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}
		
		// Parse ticket tiers
		if len(ticketTiersJSON) > 0 {
			if err := json.Unmarshal(ticketTiersJSON, &event.TicketTiers); err != nil {
				return nil, fmt.Errorf("failed to parse ticket tiers: %w", err)
			}
		}
		
		event.Tags = []string(tags)
		events = append(events, &event)
	}
	
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating events: %w", err)
	}
	
	return events, nil
}

// GetTierDetails (for order processing)
func (r *postgresEventRepository) GetTierDetails(
	ctx context.Context,
	eventID uuid.UUID,
	tierName string,
) (*TierDetails, error) {
	
	query := `
		SELECT 
			e.id as event_id,
			e.event_title,
			tt.id as ticket_tier_id,          -- ✅ Added: needed for order items
			tt.name as tier_name,             -- ✅ Fixed: tt.name not tt.tier_name
			tt.price_kobo,                    -- ✅ Fixed: already in kobo, no conversion
			tt.capacity as total_stock,       -- ✅ Fixed: tt.capacity not tt.quantity
			tt.sold as sold_count,            -- ✅ Fixed: use tt.sold column directly
			tt.available                      -- ✅ Fixed: use tt.available column directly
		FROM events e
		JOIN ticket_tiers tt ON e.id = tt.event_id
		WHERE e.id = $1 
		  AND tt.name = $2                   -- ✅ Fixed: tt.name not tt.tier_name
		  AND e.is_deleted = false
	`
	
	var details TierDetails
	err := r.db.GetContext(ctx, &details, query, eventID, tierName)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("tier not found for event %s, tier %s", eventID, tierName)
		}
		return nil, fmt.Errorf("failed to get tier details: %w", err)
	}
	
	return &details, nil
}

// GetEventTicketTiers
func (r *postgresEventRepository) GetEventTicketTiers(
	ctx context.Context,
	eventID uuid.UUID,
) ([]models.TicketTier, error) {
	
	query := `
		SELECT id, event_id, tier_name, price, quantity, description
		FROM ticket_tiers
		WHERE event_id = $1
		ORDER BY price ASC
	`
	
	var tiers []models.TicketTier
	err := r.db.SelectContext(ctx, &tiers, query, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to get ticket tiers: %w", err)
	}
	
	return tiers, nil
}

// CheckTicketAvailability
func (r *postgresEventRepository) CheckTicketAvailability(
	ctx context.Context,
	eventID uuid.UUID,
	tierName string,
	quantity int,
) (bool, error) {
	
	query := `
		SELECT quantity >= $1
		FROM ticket_tiers
		WHERE event_id = $2 AND tier_name = $3
	`
	
	var available bool
	err := r.db.GetContext(ctx, &available, query, quantity, eventID, tierName)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, fmt.Errorf("tier not found")
		}
		return false, fmt.Errorf("failed to check availability: %w", err)
	}
	
	return available, nil
}

// GetEventWithStats (for analytics)
func (r *postgresEventRepository) GetEventWithStats(
	ctx context.Context,
	eventID uuid.UUID,
) (*EventWithStats, error) {
	
	// First get the event
	event, err := r.GetEventByID(ctx, eventID, nil)
	if err != nil {
		return nil, err
	}
	
	// Then get stats
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