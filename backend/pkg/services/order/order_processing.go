// backend/pkg/services/order/order_processing.go
package order

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	repoevent "github.com/eventify/backend/pkg/repository/event"
	repoorder "github.com/eventify/backend/pkg/repository/order"

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
	//ErrOrderNotFound       = errors.New("order not found")
	ErrAmountMismatch      = errors.New("AmountMismatch")
	ErrPaymentNotCompleted = errors.New("payment not completed")
	ErrOrderNotFulfilled   = errors.New("payment received but the order is not fulfilled")
	ErrPaymentFailedUpstream = errors.New("transaction verification failed")
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

// applyStockReductionsTx reduces available ticket stock for purchased items
type tierQty struct {
	TierID   uuid.UUID
	Quantity int32
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
		return nil, fmt.Errorf("%w: reference %s: %w", ErrOrderNotFound, reference, err)
	}

	if order == nil {
		return nil, fmt.Errorf("%w: reference %s", ErrOrderNotFound, reference)
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
	// Verify with Paystack API
	resp, err := s.PaystackClient.VerifyTransaction(ctx, reference)
	if err != nil {
		return nil, fmt.Errorf("paystack verification failed: %w", err)
	}
	if resp == nil || resp.Data == nil {
		return nil, errors.New("paystack verification returned no data")
	}

	// Never declare an unpaid transaction failed from the verify path. Paystack reports
	// these statuses while the customer is still on the payment page. Only the webhook
	// may mark a payment failed.
	if order.Status == models.OrderStatusPending && isUnpaidInFlight(resp.Data.Status) {
		return order, fmt.Errorf("%w: paystack status %q", ErrPaymentNotCompleted, resp.Data.Status)
	}

	order, err = s.finalizeOrder(ctx, order, resp.Data, "verification")

	// Lost the race (webhook finished first), or the order was already closed:
	// re-read and report what really happened.
	if err != nil && errors.Is(err, ErrAlreadyProcessed) {
		return s.resolveAlreadyProcessed(ctx, reference, resp.Data.Status == "success")
	}

	return order, err
}

func isUnpaidInFlight(status string) bool {
	switch status {
	case "abandoned", "pending", "ongoing", "processing", "queued":
		return true
	}
	return false
}

// resolveAlreadyProcessed re-reads an order that another request finished and reports
// what actually happened to it, instead of trusting stale in-memory state.
func (s *OrderServiceImpl) resolveAlreadyProcessed(ctx context.Context, reference string, paidUpstream bool) (*models.Order, error) {
	fresh, err := s.OrderRepo.GetOrderByReference(ctx, reference)
	if err != nil {
		return nil, fmt.Errorf("re-reading order %s after concurrent processing: %w", reference, err)
	}
	if fresh == nil {
		return nil, fmt.Errorf("%w: reference %s", ErrOrderNotFound, reference)
	}

	switch string(fresh.Status) {
	case "success":
		if err := s.OrderRepo.LoadOrderRelations(ctx, fresh); err != nil {
			log.Warn().Err(err).Str("ref", reference).Msg("Could not hydrate order relations on idempotent verify")
		}
		log.Info().Str("ref", reference).Str("processed_by", fresh.ProcessedBy.String).Msg("Order already fulfilled; verification is idempotent")
		return fresh, nil
	case "pending", "processing":
		return fresh, fmt.Errorf("%w: order is still %s", ErrPaymentNotCompleted, fresh.Status)
	default: // failed, fraud, expired, refunded
		if paidUpstream {
			log.Error().Str("ref", reference).Str("order_status", string(fresh.Status)).
				Msg("PAID_BUT_NOT_FULFILLED: Paystack reports success but the order is closed; needs refund or manual fulfilment")
			return fresh, fmt.Errorf("%w: order is %s", ErrOrderNotFulfilled, fresh.Status)
		}
		return fresh, fmt.Errorf("order is in %s state and cannot be verified", fresh.Status)
	}
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
		if err := s.OrderRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
			moved, err := s.OrderRepo.TransitionPendingOrderTx(ctx, tx, order.ID, models.OrderStatusFailed)
			if err != nil || !moved {
				return err
			}
			return s.releaseReservedStockTx(ctx, tx, order)
		}); err != nil {
			log.Error().Err(err).Str("ref", order.Reference).Msg("Failed to close order after upstream failure")
		}
		return order, ErrPaymentFailedUpstream
	}

	// Amount validation (fraud detection)
	if int64(data.Amount) != order.FinalTotal {
		log.Warn().Int64("expected", order.FinalTotal).Int64("received", int64(data.Amount)).Str("reference", order.Reference).Msg("Amount mismatch detected.")
		_ = s.OrderRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
			_ = s.OrderRepo.UpdateOrderStatusTx(ctx, tx, order.ID, models.OrderStatusFraud)
			return s.releaseReservedStockTx(ctx, tx, order)
		})
		return order, fmt.Errorf("%w: expected %d, received %d", ErrAmountMismatch, order.FinalTotal, data.Amount)
	}

	// Prepare order data
	order.AmountPaid = int64(data.Amount)
	//order.ServiceFee = int64(data.Fees)
	if data.Fees > 0 {
		order.PaystackFee = int64(data.Fees)
		order.AppProfit = order.ServiceFee + order.VATAmount - order.PaystackFee
	}
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
			"user_name":   order.CustomerFirstName,
			"event_title": firstItem.EventTitle,
			"event_venue": func() string {
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

		// return s.OrderRepo.QueueEmailTx(ctx, tx, outboxEntry)
		return s.OrderRepo.QueueEmailOnceTx(ctx, tx, outboxEntry, "ticket:"+order.Reference)
	})

	if err != nil {
		// Lost the race: another request finalized this order between our status check
		// and our UPDATE. Nothing was written; the transaction rolled back.
		if errors.Is(err, repoorder.ErrOrderNotPending) {
			log.Info().Str("ref", order.Reference).Str("attempted_by", processedBy).Msg("Order finalized concurrently by another request")
			return order, ErrAlreadyProcessed
		}
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

// sortedTierQuantities merges items per tier and sorts by tier ID. Every transaction that
// touches several tiers must lock them in this same order, or two orders can deadlock.
func sortedTierQuantities(items []models.OrderItem) []tierQty {
	byTier := make(map[uuid.UUID]int32, len(items))
	for _, it := range items {
		byTier[it.TicketTierID] += it.Quantity
	}
	out := make([]tierQty, 0, len(byTier))
	for id, q := range byTier {
		out = append(out, tierQty{id, q})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].TierID.String() < out[j].TierID.String() })
	return out
}

func (s *OrderServiceImpl) applyStockReductionsTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error {
	for _, tq := range sortedTierQuantities(order.Items) {
		if err := s.EventRepo.DecrementTicketStockTx(ctx, tx, tq.TierID, tq.Quantity); err != nil {
			ev := log.Error()
			if errors.Is(err, repoevent.ErrNotEnoughStock) {
				ev = log.Warn() // a normal sold-out is not an error
			}
			ev.Err(err).Str("tier_id", tq.TierID.String()).Int32("quantity", tq.Quantity).Msg("OrderService: could not reserve stock")
			return fmt.Errorf("stock reduction failed for tier %s: %w", tq.TierID, err)
		}
	}
	return nil
}

// releaseReservedStockTx restores stock for failed/abandoned orders using deterministic sorting
// releaseReservedStockTx restores stock for failed or abandoned orders, locking tiers in a fixed order.
func (s *OrderServiceImpl) releaseReservedStockTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error {
	for _, tq := range sortedTierQuantities(order.Items) {
		if err := s.EventRepo.IncrementTicketStockTx(ctx, tx, tq.TierID, tq.Quantity); err != nil {
			log.Error().Err(err).Str("tier_id", tq.TierID.String()).Int32("qty", tq.Quantity).Msg("Failed to restore stock for abandoned/failed order")
			return fmt.Errorf("failed to restore stock for tier %s: %w", tq.TierID, err)
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

// IsRetryable reports whether Paystack should redeliver a webhook that ended in err.
// A failed payment, a wrong amount or an already-handled order cannot be fixed by a
// retry; anything else (database, network) can.
func IsRetryable(err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, ErrAmountMismatch), errors.Is(err, ErrPaymentFailedUpstream), errors.Is(err, ErrAlreadyProcessed):
		return false
	default:
		return true
	}
}