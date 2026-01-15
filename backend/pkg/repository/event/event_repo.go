// backend/pkg/repository/event/event_repo.go

package event

import (
	"context"
	"time"

	"eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ============================================================================
// MODELS & TYPES
// ============================================================================

type TierDetails struct {
	EventID      uuid.UUID `db:"event_id"`
	EventTitle   string    `db:"event_title"`
	TicketTierID uuid.UUID `db:"ticket_tier_id"`
	TierName     string    `db:"tier_name"`
	PriceKobo    int32     `db:"price_kobo"`
	TotalStock   int32     `db:"total_stock"`
	SoldCount    int32     `db:"sold_count"`
	Available    int32     `db:"available"`
}

type EventFilters struct {
	OrganizerID *uuid.UUID
	EventType   *models.EventType
	Category    *string
	City        *string
	State       *string
	Country     *string
	StartDate   *time.Time // Events starting after this date
	EndDate     *time.Time // Events ending before this date
	IsDeleted   bool
	Limit       int
	Offset      int
}

type EventWithStats struct {
	*models.Event
	TotalRevenue     float64
	TotalTicketsSold int32
}

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

type EventRepository interface {
	// Event CRUD
	GetEventByID(ctx context.Context, eventID uuid.UUID, userID *uuid.UUID) (*models.Event, error)
	GetEvents(ctx context.Context, filters EventFilters) ([]*models.Event, error)
	CreateEvent(ctx context.Context, tx *sqlx.Tx, event *models.Event) (uuid.UUID, error)
	UpdateEvent(ctx context.Context, event *models.Event) error
	SoftDeleteEvent(ctx context.Context, eventID uuid.UUID) error
	
	// Ticket tier operations
	GetTierDetails(ctx context.Context, eventID uuid.UUID, tierName string) (*TierDetails, error)
	GetEventTicketTiers(ctx context.Context, eventID uuid.UUID) ([]models.TicketTier, error)
	CreateTicketTier(ctx context.Context, tx *sqlx.Tx, tier *models.TicketTier) error
    CreateTicketTiers(ctx context.Context, tx *sqlx.Tx, tiers []models.TicketTier) error
	
	// Stock management
	DecrementTicketStockTx(ctx context.Context, tx *sqlx.Tx, eventID uuid.UUID, tierName string, quantity int32) error
	IncrementTicketStockTx(ctx context.Context, tx *sqlx.Tx, eventID uuid.UUID, tierName string, quantity int32) error
	CheckTicketAvailability(ctx context.Context, eventID uuid.UUID, tierName string, quantity int) (bool, error)
	
	// Analytics
	GetEventWithStats(ctx context.Context, eventID uuid.UUID) (*EventWithStats, error)
}

// ============================================================================
// IMPLEMENTATION STRUCT
// ============================================================================

type postgresEventRepository struct {
	db *sqlx.DB
}

func NewPostgresEventRepository(db *sqlx.DB) EventRepository {
	return &postgresEventRepository{db: db}
}