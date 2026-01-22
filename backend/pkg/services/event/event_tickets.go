// backend/pkg/services/event/event_tickets.go

package event

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/eventify/backend/pkg/utils"
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

// ValidateAndCheckInTicket handles the industry-grade "Gate Check"
func (s *eventService) ValidateAndCheckInTicket(
    ctx context.Context, 
    ticketCode string,
) error {
    // 1. FAST PATH: Cryptographic Signature Verification
    // This catches fake tickets immediately without a DB hit.
    if !utils.VerifyTicketOffline(ticketCode) {
        return fmt.Errorf("security alert: invalid ticket signature for code %s", ticketCode)
    }

    // 2. DATABASE PATH: Mark as used
    // This uses the atomic update we discussed: it only works if is_used = false.
    err := s.eventRepo.MarkTicketAsUsed(ctx, ticketCode)
    if err != nil {
        // Here we handle "Already Used", "Not Found", or "Canceled"
        return fmt.Errorf("gate check failed: %w", err)
    }

    return nil
}