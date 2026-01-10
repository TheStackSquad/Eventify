// backend/pkg/services/event/event_tickets.go

package event

import (
	"context"
	"errors"
	"fmt"
	"github.com/google/uuid"
)

func (s *eventService) CheckTicketAvailability(ctx context.Context, eventID uuid.UUID, tierName string, quantity int) error {
	available, err := s.eventRepo.CheckTicketAvailability(ctx, eventID, tierName, quantity)
	if err != nil {
		return err
	}
	if !available {
		return errors.New("insufficient tickets available")
	}
	return nil
}

func (s *eventService) ReserveTickets(ctx context.Context, eventID uuid.UUID, tierName string, quantity int) error {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	err = s.eventRepo.DecrementTicketStockTx(ctx, tx, eventID, tierName, int32(quantity))
	if err != nil {
		return err
	}

	return tx.Commit()
}