// backend/pkg/repository/event/event_repo.go

package event

import (
	"context"
	"time"
	"fmt"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// MODELS & TYPES

// TierDetails contains consolidated ticket tier information
type TierDetails struct {
	EventID      uuid.UUID `db:"event_id"`
	EventTitle   string    `db:"event_title"`
	EndDate      time.Time `db:"end_date"`
	TicketTierID uuid.UUID `db:"ticket_tier_id"`
	TierName     string    `db:"name"` 
	PriceKobo    int32     `db:"price_kobo"`
	TotalStock   int32     `db:"capacity"`
	SoldCount    int32     `db:"sold"`     
	Available    int32     `db:"available"`
}

// EventFilters defines parameters for filtering events
type EventFilters struct {
	OrganizerID *uuid.UUID
	EventType   *models.EventType
	Category    *string
	City        *string
	State       *string
	Country     *string
	StartDate   *time.Time
	EndDate     *time.Time
	IsDeleted   bool
	Limit       int
	Offset      int
}

// EventWithStats extends Event with analytics data
type EventWithStats struct {
	*models.Event
	TotalRevenue     float64
	TotalTicketsSold int32
}

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

// EventRepository defines the contract for event data operations
type EventRepository interface {
	// Event CRUD Operations
	GetEventByID(ctx context.Context, eventID uuid.UUID, userID *uuid.UUID) (*models.Event, error)
	GetEvents(ctx context.Context, filters EventFilters) ([]*models.Event, error)
	CreateEvent(ctx context.Context, tx *sqlx.Tx, event *models.Event) (uuid.UUID, error)
	UpdateEvent(ctx context.Context, tx *sqlx.Tx, event *models.Event) error
	SoftDeleteEvent(ctx context.Context, eventID uuid.UUID) error

	// Ticket Tier Operations
	GetTierDetails(ctx context.Context, eventID uuid.UUID, tierName string) (*models.TierDetails, error)
    GetTierDetailsByID(ctx context.Context, tierID uuid.UUID) (*models.TierDetails, error)
	GetEventTicketTiers(ctx context.Context, eventID uuid.UUID) ([]models.TicketTier, error)
	CreateTicketTier(ctx context.Context, tx *sqlx.Tx, tier *models.TicketTier) error
	CreateTicketTiers(ctx context.Context, tx *sqlx.Tx, eventID uuid.UUID, tiers []models.TicketTier) error
	SyncTicketTiers(ctx context.Context, tx *sqlx.Tx, eventID uuid.UUID, incomingTiers []models.TicketTier) error

	MarkTicketAsUsed(ctx context.Context, code string) error

	// Stock Management
	CheckTicketAvailability(ctx context.Context, tierID uuid.UUID, quantity int32) (bool, error) 
    DecrementTicketStockTx(ctx context.Context, tx *sqlx.Tx, tierID uuid.UUID, qty int32) error
    IncrementTicketStockTx(ctx context.Context, tx *sqlx.Tx, tierID uuid.UUID, qty int32) error

	// Analytics
	GetEventWithStats(ctx context.Context, eventID uuid.UUID) (*EventWithStats, error)
}

// IMPLEMENTATION

// postgresEventRepository implements EventRepository for PostgreSQL
type postgresEventRepository struct {
	db *sqlx.DB
}

// NewPostgresEventRepository creates a new PostgreSQL event repository instance
func NewPostgresEventRepository(db *sqlx.DB) EventRepository {
	return &postgresEventRepository{db: db}
}


func (r *postgresEventRepository) MarkTicketAsUsed(ctx context.Context, code string) error {
    query := `
        UPDATE tickets 
        SET is_used = true, 
            status = 'used', 
            updated_at = NOW() 
        WHERE code = $1 
          AND is_used = false 
          AND status = 'active'
    `
    result, err := r.db.ExecContext(ctx, query, code)
    if err != nil {
        return err
    }

    rows, _ := result.RowsAffected()
    if rows == 0 {
        // This is the safety catch for double-entry
        return fmt.Errorf("ticket cannot be used: either already scanned or not active")
    }
    return nil
}