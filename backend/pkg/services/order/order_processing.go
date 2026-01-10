// backend/pkg/services/order/order_processing.go

package order

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"eventify/backend/pkg/models"
	repoorder "eventify/backend/pkg/repository/order"
	"eventify/backend/pkg/utils"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

var (
    ErrAlreadyProcessed = errors.New("order already processed")
    ErrOrderNotPending  = errors.New("order is not in pending status")
    ErrUnauthorized     = errors.New("unauthorized access to order")
)

// Payment verification and processing
func (s *OrderServiceImpl) VerifyAndProcess(
    ctx context.Context,
    reference string,
    guestID string,
) (*models.Order, error) {
    order, err := s.OrderRepo.GetOrderByReference(ctx, reference)
    if err != nil {
        return nil, fmt.Errorf("order not found for reference %s: %w", reference, err)
    }

    if _, authErr := s.GetOrderByReference(ctx, reference, order.UserID, guestID); authErr != nil {
        return nil, fmt.Errorf("authorization failed for order %s: %w", reference, authErr)
    }

    // ✅ If already processed, return order WITHOUT error (idempotent success)
    if order.Status == models.OrderStatusSuccess {
        log.Info().
            Str("ref", reference).
            Str("processed_by", order.ProcessedBy.String).
            Msg("Order already processed - idempotent verification")
        return order, nil // ✅ Success, not error
    }

    if order.Status == models.OrderStatusFailed || order.Status == models.OrderStatusFraud {
        return order, fmt.Errorf("order is in %s state and cannot be verified", order.Status)
    }

    resp, err := s.PaystackClient.VerifyTransaction(ctx, reference)
    if err != nil {
        return nil, fmt.Errorf("paystack verification failed: %w", err)
    }

    order, err = s.finalizeOrder(ctx, order, resp.Data, "verification")
    
    // ✅ Handle race condition case (webhook processed between our checks)
    if err != nil && errors.Is(err, ErrAlreadyProcessed) {
        log.Info().
            Str("ref", reference).
            Msg("Order processed by webhook during verification")
        return order, nil // ✅ Success
    }

    return order, err
}

// Webhook processing
func (s *OrderServiceImpl) ProcessWebhook(
    ctx context.Context,
    payload *models.PaystackWebhook,
    signature string,
) error {
    data := payload.Data
    if data == nil {
        return errors.New("webhook data is nil")
    }

    order, err := s.OrderRepo.GetOrderByReference(ctx, data.Reference)
    if err != nil {
        log.Warn().Str("reference", data.Reference).Err(err).
            Msg("Order not found during webhook")
        return nil // ✅ Don't fail webhook for missing orders
    }

    _, err = s.finalizeOrder(ctx, order, data, "webhook")
    
    // ✅ Idempotency - webhook called multiple times is OK
    if err != nil && errors.Is(err, ErrAlreadyProcessed) {
        log.Info().
            Str("ref", data.Reference).
            Msg("Webhook received for already processed order")
        return nil // ✅ Success
    }

    return err
}

// Private helper methods for order processing
func (s *OrderServiceImpl) finalizeOrder(
    ctx context.Context,
    order *models.Order,
    data *models.PaystackData,
    processedBy string,
) (*models.Order, error) {
    // ✅ Use sentinel error
    if order.Status != models.OrderStatusPending {
        log.Info().
            Str("ref", order.Reference).
            Str("status", string(order.Status)).
            Str("attempted_by", processedBy).
            Msg("Order not in pending status")
        return order, ErrAlreadyProcessed
    }

    if data.Status != "success" {
        log.Warn().
            Str("ref", order.Reference).
            Str("status", data.Status).
            Msg("Transaction failed upstream.")
        _ = s.OrderRepo.UpdateOrderStatus(ctx, order.ID, models.OrderStatusFailed)
        return order, errors.New("transaction verification failed with status: " + data.Status)
    }

   if int64(data.Amount) != order.FinalTotal { // FIX 1: Cast data.Amount to int64 for comparison
		log.Warn().
			Int64("expected", order.FinalTotal).
			Int64("received", int64(data.Amount)). // Cast here for logging consistency
			Str("reference", order.Reference).
			Msg("Amount mismatch detected.")
		_ = s.OrderRepo.UpdateOrderStatus(ctx, order.ID, models.OrderStatusFraud)
		return order, fmt.Errorf("AmountMismatch: expected %d, received %d", order.FinalTotal, data.Amount)
	}

	order.AmountPaid = int64(data.Amount)     // FIX 2: Cast data.Amount to int64 for assignment
	order.ServiceFee = int64(data.Fees)       // FIX 3: Cast data.Fees to int64 for assignment
	order.PaymentChannel = models.ToNullString(data.Channel)

    // Parse Paystack's PaidAt timestamp
    var paidAt time.Time
    if data.PaidAt != "" {
        t, err := time.Parse("2006-01-02T15:04:05.000Z", data.PaidAt)
        if err != nil {
            t, err = time.Parse(time.RFC3339, data.PaidAt)
            if err != nil {
                log.Warn().Err(err).Str("paid_at", data.PaidAt).
                    Msg("Failed to parse PaidAt from Paystack")
            } else {
                paidAt = t
            }
        } else {
            paidAt = t
        }
    }

    if !paidAt.IsZero() {
        order.PaidAt = models.ToNullTime(&paidAt)
    }

    order.Status = models.OrderStatusSuccess
    order.ProcessedBy = models.ToNullString(processedBy)
    order.UpdatedAt = time.Now().UTC()

    tickets, err := s.generateTicketsForOrder(ctx, order)
    if err != nil {
        return order, fmt.Errorf("failed to generate tickets: %w", err)
    }

    // ✅ Execute atomic transaction
    err = s.OrderRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
        // Update order status (with idempotency check)
        if err := s.OrderRepo.UpdateOrderToPaidTx(ctx, tx, order); err != nil {
            return err
        }

        // Apply stock reductions
        if err := s.applyStockReductionsTx(ctx, tx, order); err != nil {
            if strings.Contains(err.Error(), "insufficient stock") {
                log.Warn().Err(err).Str("ref", order.Reference).
                    Msg("Stock exhaustion during finalization")
                return fmt.Errorf("tickets no longer available: %w", err)
            }
            return err
        }

        // Insert tickets
        if err := s.OrderRepo.InsertTicketsTx(ctx, tx, order, tickets); err != nil {
            return err
        }

        return nil // ✅ All operations succeeded
    })

    // ✅ Handle transaction result OUTSIDE the transaction function
    if err != nil {
        // Check for database-level idempotency (status check failed)
        if strings.Contains(err.Error(), "status was not 'pending'") || 
           strings.Contains(err.Error(), "already processed") {
            log.Info().
                Str("ref", order.Reference).
                Msg("Database idempotency check caught race condition")
            return order, ErrAlreadyProcessed
        }
        
        log.Error().Err(err).Str("ref", order.Reference).Msg("Transaction failed")
        return order, fmt.Errorf("atomic finalization failed: %w", err)
    }

    // ✅ Success
    log.Info().
        Str("ref", order.Reference).
        Str("processed_by", processedBy).
        Msg("Order finalized successfully")
    
    return order, nil
}

func (s *OrderServiceImpl) generateTicketsForOrder(
	ctx context.Context,
	order *models.Order,
) ([]models.Ticket, error) {
	now := time.Now().UTC()
	var tickets []models.Ticket
	ticketIndex := 0

	for _, item := range order.Items {
		for i := int32(0); i < item.Quantity; i++ {
			ticket := models.Ticket{
				ID:           uuid.New(),
				Code:         utils.GenerateUniqueTicketCode(order.Reference, ticketIndex),
				OrderID:      order.ID,
				EventID:      item.EventID,
				TicketTierID: item.TicketTierID,
				Status:       models.TicketStatusActive,
				IsUsed:       false,
				CreatedAt:    now,
				UpdatedAt:    now,
			}

			if order.UserID != nil { 
				 ticket.UserID = order.UserID 
}

			tickets = append(tickets, ticket)
			ticketIndex++
		}
	}

	return tickets, nil
}

func (s *OrderServiceImpl) applyStockReductionsTx(
	ctx context.Context,
	tx *sqlx.Tx,
	order *models.Order,
) error {
	reductions := make(map[uuid.UUID]repoorder.StockReduction)

	for _, item := range order.Items {
		key := item.TicketTierID

		if r, ok := reductions[key]; ok {
			r.Quantity += item.Quantity
			reductions[key] = r
			continue
		}

		reductions[key] = repoorder.StockReduction{
			EventID:      item.EventID,
			TicketTierID: item.TicketTierID,
			TierName:     item.TierName,
			Quantity:     item.Quantity,
		}
	}

	for _, r := range reductions {
		err := s.EventRepo.DecrementTicketStockTx(
			ctx,
			tx,
			r.EventID,
			r.TierName,
			r.Quantity,
		)
		if err != nil {
			return fmt.Errorf("stock reduction failed for tier %s: %w", r.TierName, err)
		}
	}

	return nil
}

// StockExhaustionError represents insufficient stock during order processing
type StockExhaustionError struct {
	TierName   string
	Requested  int32
	Available  int32
}

func (e *StockExhaustionError) Error() string {
	return fmt.Sprintf("insufficient stock for %s: requested %d, only %d available",
		e.TierName, e.Requested, e.Available)
}