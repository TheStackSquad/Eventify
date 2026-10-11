// backend/pkg/services/order/order_processing.go
package order

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/eventify/backend/pkg/utils"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

// ============================================================================
// ERRORS
// ============================================================================

var (
	ErrAlreadyProcessed = errors.New("order already processed")
	ErrOrderNotPending  = errors.New("order is not in pending status")
	ErrUnauthorized     = errors.New("unauthorized access to order")
)

// ============================================================================
// REQUEST DEDUPLICATION
// ============================================================================

var verificationLocks sync.Map // Prevents duplicate processing

// verificationLock tracks in-flight verification requests
type verificationLock struct {
	mu        sync.Mutex
	inFlight  bool
	expiresAt time.Time
}

// ============================================================================
// PUBLIC API - PAYMENT VERIFICATION AND PROCESSING
// ============================================================================

// VerifyAndProcess handles payment verification with request deduplication and idempotency
func (s *OrderServiceImpl) VerifyAndProcess(ctx context.Context, reference string, guestID string) (*models.Order, error) {
	// Acquire deduplication lock
	lockInterface, _ := verificationLocks.LoadOrStore(reference, &verificationLock{})
	lock := lockInterface.(*verificationLock)

	lock.mu.Lock()

	// Handle duplicate requests
	if lock.inFlight {
		lock.mu.Unlock()
		log.Info().Str("ref", reference).Msg("Duplicate verification request - polling for result")

		// Poll for 2.5 seconds maximum
		for i := 0; i < 5; i++ {
			time.Sleep(500 * time.Millisecond)

			order, err := s.OrderRepo.GetOrderByReference(ctx, reference)
			if err == nil && order.Status == models.OrderStatusSuccess {
				return order, nil
			}

			if err == nil && (order.Status == models.OrderStatusFailed || order.Status == models.OrderStatusFraud) {
				return order, fmt.Errorf("order is in %s state", order.Status)
			}
		}

		return nil, errors.New("verification is taking too long, please check your email")
	}

	// Mark as in-flight
	lock.inFlight = true
	lock.expiresAt = time.Now().Add(30 * time.Second)
	lock.mu.Unlock()

	// Cleanup lock after processing
	defer func() {
		lock.mu.Lock()
		lock.inFlight = false
		lock.mu.Unlock()

		go cleanupExpiredLocks() // Async cleanup
	}()

	// Fetch order from database
	order, err := s.OrderRepo.GetOrderByReference(ctx, reference)
	if err != nil {
		return nil, fmt.Errorf("order not found for reference %s: %w", reference, err)
	}

	if order == nil {
		return nil, fmt.Errorf("order not found for reference: %s", reference)
	}

	// Authorization check
	if _, authErr := s.GetOrderByReference(ctx, reference, order.UserID, guestID); authErr != nil {
		return nil, authErr
	}

	// Idempotency check: already processed
	if order.Status == models.OrderStatusSuccess {
		log.Info().Str("ref", reference).Str("processed_by", order.ProcessedBy.String).Msg("Order already processed - idempotent verification")
		return order, nil
	}

	// Check for failed states
	if order.Status == models.OrderStatusFailed || order.Status == models.OrderStatusFraud {
		return order, fmt.Errorf("order is in %s state and cannot be verified", order.Status)
	}

	// Verify with Paystack API
	resp, err := s.PaystackClient.VerifyTransaction(ctx, reference)
	if err != nil {
		return nil, fmt.Errorf("paystack verification failed: %w", err)
	}

	// Finalize order
	order, err = s.finalizeOrder(ctx, order, resp.Data, "verification")

	// Handle race condition (webhook processed first)
	if err != nil && errors.Is(err, ErrAlreadyProcessed) {
		log.Info().Str("ref", reference).Msg("Order processed by webhook during verification")
		return order, nil
	}

	return order, err
}

// ============================================================================
// WEBHOOK PROCESSING
// ============================================================================

// ProcessWebhook handles Paystack webhook callbacks for payment events
func (s *OrderServiceImpl) ProcessWebhook(ctx context.Context, payload *models.PaystackWebhook, signature string) error {
	data := payload.Data
	if data == nil {
		return errors.New("webhook data is nil")
	}

	// Fetch order by reference
	order, err := s.OrderRepo.GetOrderByReference(ctx, data.Reference)
	if err != nil {
		log.Warn().Str("reference", data.Reference).Err(err).Msg("Order not found during webhook")
		return nil
	}

	if order == nil {
		log.Warn().Str("reference", data.Reference).Msg("Order not found for webhook reference — skipping")
		return nil
	}

	// Process order idempotently
	_, err = s.finalizeOrder(ctx, order, data, "webhook")

	// Handle idempotent success
	if err != nil && errors.Is(err, ErrAlreadyProcessed) {
		log.Info().Str("ref", data.Reference).Msg("Webhook received for already processed order")
		return nil
	}

	return err
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

// finalizeOrder atomically processes a verified payment
func (s *OrderServiceImpl) finalizeOrder(ctx context.Context, order *models.Order, data *models.PaystackData, processedBy string) (*models.Order, error) {
	// Status validation (idempotency guard)
	if order.Status != models.OrderStatusPending {
		log.Info().Str("ref", order.Reference).Str("status", string(order.Status)).Str("attempted_by", processedBy).Msg("Order already processed; skipping finalization.")
		return order, ErrAlreadyProcessed
	}

	// Load relations for email payload
	if err := s.OrderRepo.LoadOrderRelations(ctx, order); err != nil {
		log.Error().Err(err).Str("ref", order.Reference).Msg("Failed to hydrate order relations")
		return order, fmt.Errorf("failed to load order details: %w", err)
	}

	// Payment status check
	if data.Status != "success" {
		log.Warn().Str("ref", order.Reference).Msg("Transaction failed upstream.")
		_ = s.OrderRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
			_ = s.OrderRepo.UpdateOrderStatusTx(ctx, tx, order.ID, models.OrderStatusFailed)
			return s.releaseReservedStockTx(ctx, tx, order)
		})
		return order, errors.New("transaction verification failed")
	}

	// Amount validation (fraud detection)
	if int64(data.Amount) != order.FinalTotal {
		log.Warn().Int64("expected", order.FinalTotal).Int64("received", int64(data.Amount)).Str("reference", order.Reference).Msg("Amount mismatch detected.")
		_ = s.OrderRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
			_ = s.OrderRepo.UpdateOrderStatusTx(ctx, tx, order.ID, models.OrderStatusFraud)
			return s.releaseReservedStockTx(ctx, tx, order)
		})
		return order, fmt.Errorf("AmountMismatch: expected %d, received %d", order.FinalTotal, data.Amount)
	}

	// Prepare order data
	order.AmountPaid = int64(data.Amount)
	order.ServiceFee = int64(data.Fees)
	order.PaymentChannel = models.ToNullString(data.Channel)

	var paidAt time.Time
	if data.PaidAt != "" {
		if t, err := time.Parse("2006-01-02T15:04:05.000Z", data.PaidAt); err == nil {
			paidAt = t
		} else {
			paidAt, _ = time.Parse(time.RFC3339, data.PaidAt)
		}
	}
	if !paidAt.IsZero() {
		order.PaidAt = models.ToNullTime(&paidAt)
	}

	order.Status = models.OrderStatusSuccess
	order.ProcessedBy = models.ToNullString(processedBy)
	order.UpdatedAt = time.Now().UTC()

	// Generate tickets
	tickets, err := s.generateTicketsForOrder(ctx, order)
	if err != nil {
		return order, fmt.Errorf("failed to generate tickets: %w", err)
	}

	// Atomic transaction (Tickets + Order + Email Outbox)
	err = s.OrderRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
		if err := s.OrderRepo.UpdateOrderToPaidTx(ctx, tx, order); err != nil {
			return err
		}

		if err := s.OrderRepo.InsertTicketsTx(ctx, tx, order, tickets); err != nil {
			return err
		}

		// Build rich email payload
		ticketCodes := make([]string, len(tickets))
		for i, t := range tickets {
			ticketCodes[i] = t.Code
		}

		firstItem := order.Items[0]
		payload := map[string]interface{}{
			"user_name":    order.CustomerFirstName,
			"event_title":  firstItem.EventTitle,
			"event_venue":  func() string {
    if firstItem.EventVenue != nil {
        return *firstItem.EventVenue
    }
    return "TBD"
}(),
			"event_date": func() string {
    if firstItem.EventStartDate != nil {
        return firstItem.EventStartDate.Format("Monday, Jan 02, 2006")
    }
    return "TBD"
}(),
			"order_ref":    order.Reference,
			"total_amount": order.FinalTotal,
			"ticket_codes": ticketCodes,
		}

		payloadBytes, _ := json.Marshal(payload)

		outboxEntry := &models.EmailOutbox{
			RecipientEmail: order.CustomerEmail,
			Subject:        fmt.Sprintf("Your Tickets: %s", firstItem.EventTitle),
			TemplateType:   "TICKET_DELIVERY",
			Payload:        payloadBytes,
			Status:         "pending",
		}

		return s.OrderRepo.QueueEmailTx(ctx, tx, outboxEntry)
	})

	if err != nil {
		return order, fmt.Errorf("atomic finalization failed: %w", err)
	}

	log.Info().Str("ref", order.Reference).Msg("Order and Email successfully queued")
	return order, nil
}

// generateTicketsForOrder creates ticket records for each purchased item
func (s *OrderServiceImpl) generateTicketsForOrder(ctx context.Context, order *models.Order) ([]models.Ticket, error) {
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
				Status:       models.TicketSubStatusActive,
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

// applyStockReductionsTx reduces available ticket stock for purchased items
func (s *OrderServiceImpl) applyStockReductionsTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error {
	reductions := make(map[uuid.UUID]int32)

	for _, item := range order.Items {
		reductions[item.TicketTierID] += item.Quantity
	}

	for tierID, quantity := range reductions {
		err := s.EventRepo.DecrementTicketStockTx(ctx, tx, tierID, quantity)
		if err != nil {
			log.Error().Err(err).Str("tier_id", tierID.String()).Int32("quantity", quantity).Msg("OrderService: Failed to decrement stock during order processing")
			return fmt.Errorf("stock reduction failed for tier %s: %w", tierID, err)
		}
	}

	return nil
}

// releaseReservedStockTx restores stock for failed/abandoned orders
func (s *OrderServiceImpl) releaseReservedStockTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error {
	for _, item := range order.Items {
		err := s.EventRepo.IncrementTicketStockTx(ctx, tx, item.TicketTierID, item.Quantity)
		if err != nil {
			log.Error().Err(err).Str("tier_id", item.TicketTierID.String()).Int32("qty", item.Quantity).Msg("Failed to restore stock for abandoned/failed order")
			return fmt.Errorf("failed to restore stock for tier %s: %w", item.TicketTierID, err)
		}
	}

	log.Info().Str("order_ref", order.Reference).Int("items_restored", len(order.Items)).Msg("Inventory successfully restored for failed/expired order")
	return nil
}

// cleanupExpiredLocks removes old locks from the verification cache
func cleanupExpiredLocks() {
	now := time.Now()
	verificationLocks.Range(func(key, value interface{}) bool {
		lock := value.(*verificationLock)
		lock.mu.Lock()
		if now.After(lock.expiresAt) && !lock.inFlight {
			verificationLocks.Delete(key)
		}
		lock.mu.Unlock()
		return true
	})
}

// ============================================================================
// CUSTOM ERROR TYPE
// ============================================================================

// StockExhaustionError indicates insufficient ticket stock during processing
type StockExhaustionError struct {
	TierName  string
	Requested int32
	Available int32
}

func (e *StockExhaustionError) Error() string {
	return fmt.Sprintf("insufficient stock for tier %s: requested %d, available %d", e.TierName, e.Requested, e.Available)
}