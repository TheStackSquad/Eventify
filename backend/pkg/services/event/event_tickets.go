// backend/pkg/services/event/event_tickets.go

package event

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// CheckTicketAvailability checks if a specific tier has enough inventory
func (s *eventService) CheckTicketAvailability(
	ctx context.Context,
	tierID uuid.UUID,
	quantity int32,
) (bool, error) {
	return s.eventRepo.CheckTicketAvailability(ctx, tierID, quantity)
}

// ReserveTickets handles the transactional decrement of stock
func (s *eventService) ReserveTickets(
	ctx context.Context,
	tierID uuid.UUID,
	quantity int32,
) error {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Decrement stock using tier ID
	err = s.eventRepo.DecrementTicketStockTx(ctx, tx, tierID, quantity)
	if err != nil {
		return fmt.Errorf("failed to reserve tickets: %w", err)
	}

	return tx.Commit()
}