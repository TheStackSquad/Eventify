// backend/pkg/services/order/order_processing.go

package order

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/eventify/backend/pkg/models"
	repoorder "github.com/eventify/backend/pkg/repository/order"
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

var verificationLocks sync.Map // Global cache to prevent duplicate processing

// verificationLock tracks in-flight verification requests
type verificationLock struct {
	mu        sync.Mutex
	inFlight  bool
	expiresAt time.Time
}

// ============================================================================
// PUBLIC API - PAYMENT VERIFICATION AND PROCESSING
// ============================================================================

/*
VerifyAndProcess handles payment verification with request deduplication and idempotency.

This is the main entry point for verifying Paystack payments after the checkout flow.
It ensures:
1. Only one request processes a given payment reference at a time
2. Returns cached results for duplicate requests (idempotent)
3. Validates authorization and order state
4. Calls Paystack API to confirm transaction status
5. Updates order, reduces stock, and generates tickets atomically

Flow:
1. Acquire lock for the payment reference
2. If another request is processing, wait briefly and return cached result
3. Verify transaction with Paystack
4. Update order status, reduce stock, generate tickets in a transaction
5. Release lock and cleanup

Parameters:
  - ctx:       Context for cancellation/timeout
  - reference: Paystack payment reference (unique per transaction)
  - guestID:   Optional guest identifier for authorization

Returns:
  - *models.Order: The processed order with tickets
  - error:        Processing error or nil on success
*/
func (s *OrderServiceImpl) VerifyAndProcess(
	ctx context.Context,
	reference string,
	guestID string,
) (*models.Order, error) {
	// 1. ACQUIRE DEDUPLICATION LOCK
	lockInterface, _ := verificationLocks.LoadOrStore(reference, &verificationLock{})
	lock := lockInterface.(*verificationLock)

	lock.mu.Lock()

	// 2. HANDLE DUPLICATE REQUESTS
	if lock.inFlight {
		lock.mu.Unlock()
		log.Info().Str("ref", reference).Msg("Duplicate verification request - polling for result")

		// Poll for 2.5 seconds maximum
		for i := 0; i < 5; i++ {
			time.Sleep(500 * time.Millisecond) // Wait for processing to complete
			
			order, err := s.OrderRepo.GetOrderByReference(ctx, reference)
			if err == nil && order.Status == models.OrderStatusSuccess {
				return order, nil // Pilot finished successfully!
			}
			
			// If order is in failed state, return immediately
			if err == nil && (order.Status == models.OrderStatusFailed || order.Status == models.OrderStatusFraud) {
				return order, fmt.Errorf("order is in %s state", order.Status)
			}
		}
		
		return nil, errors.New("verification is taking too long, please check your email")
	}

	// 3. MARK AS IN-FLIGHT
	lock.inFlight = true
	lock.expiresAt = time.Now().Add(30 * time.Second)
	lock.mu.Unlock()

	// 4. CLEANUP LOCK AFTER PROCESSING
	defer func() {
		lock.mu.Lock()
		lock.inFlight = false
		lock.mu.Unlock()

		// Async cleanup of expired locks
		go cleanupExpiredLocks()
	}()

	// 5. FETCH ORDER FROM DATABASE
	order, err := s.OrderRepo.GetOrderByReference(ctx, reference)
	if err != nil {
		return nil, fmt.Errorf("order not found for reference %s: %w", reference, err)
	}

	// 6. AUTHORIZATION CHECK
	if _, authErr := s.GetOrderByReference(ctx, reference, order.UserID, guestID); authErr != nil {
		return nil, fmt.Errorf("authorization failed for order %s: %w", reference, authErr)
	}

	// 7. IDEMPOTENCY CHECK: ALREADY PROCESSED
	if order.Status == models.OrderStatusSuccess {
		log.Info().
			Str("ref", reference).
			Str("processed_by", order.ProcessedBy.String).
			Msg("Order already processed - idempotent verification")
		return order, nil
	}

	// 8. CHECK FOR FAILED STATES
	if order.Status == models.OrderStatusFailed || order.Status == models.OrderStatusFraud {
		return order, fmt.Errorf("order is in %s state and cannot be verified", order.Status)
	}

	// 9. VERIFY WITH PAYSTACK API
	resp, err := s.PaystackClient.VerifyTransaction(ctx, reference)
	if err != nil {
		return nil, fmt.Errorf("paystack verification failed: %w", err)
	}

	// 10. FINALIZE ORDER (update DB, reduce stock, generate tickets)
	order, err = s.finalizeOrder(ctx, order, resp.Data, "verification")

	// 11. HANDLE RACE CONDITION (webhook processed first)
	if err != nil && errors.Is(err, ErrAlreadyProcessed) {
		log.Info().
			Str("ref", reference).
			Msg("Order processed by webhook during verification")
		return order, nil
	}

	return order, err
}

// ============================================================================
// WEBHOOK PROCESSING
// ============================================================================

/*
ProcessWebhook handles Paystack webhook callbacks for payment events.

Webhooks are asynchronous notifications from Paystack about transaction status.
They can arrive:
1. Before user returns to the site (pre-verification)
2. After successful verification (idempotent)
3. Multiple times for the same transaction (idempotent)

This function ensures:
- Idempotent processing (duplicate webhooks are safe)
- Doesn't fail for missing orders (prevents webhook retries)
- Updates order status atomically
*/
func (s *OrderServiceImpl) ProcessWebhook(
	ctx context.Context,
	payload *models.PaystackWebhook,
	signature string,
) error {
	data := payload.Data
	if data == nil {
		return errors.New("webhook data is nil")
	}

	// Fetch order by Paystack reference
	order, err := s.OrderRepo.GetOrderByReference(ctx, data.Reference)
	if err != nil {
		log.Warn().Str("reference", data.Reference).Err(err).
			Msg("Order not found during webhook")
		return nil // Don't fail webhook - prevents retry loops
	}

	// Process order (idempotent - safe for duplicates)
	_, err = s.finalizeOrder(ctx, order, data, "webhook")

	// Handle idempotent success
	if err != nil && errors.Is(err, ErrAlreadyProcessed) {
		log.Info().
			Str("ref", data.Reference).
			Msg("Webhook received for already processed order")
		return nil // Success - webhook processed safely
	}

	return err
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/*
finalizeOrder atomically processes a verified payment.

This is the core business logic that:
1. Validates transaction data matches order
2. Updates order status to "success"
3. Reduces ticket stock
4. Generates tickets
5. Executes all DB operations in a single transaction

Atomicity ensures:
- Either ALL operations succeed, or NONE do
- No partial updates (e.g., stock reduced but no tickets)
- Race condition protection via database constraints

Parameters:
  - ctx:         Context
  - order:       Order to process
  - data:        Paystack transaction data
  - processedBy: Source of processing ("webhook" or "verification")

Returns:
  - *models.Order: Updated order
  - error:        Processing error or nil on success
*/
func (s *OrderServiceImpl) finalizeOrder(
	ctx context.Context,
	order *models.Order,
	data *models.PaystackData,
	processedBy string,
) (*models.Order, error) {
	// 1. STATUS VALIDATION (idempotency guard)
	if order.Status != models.OrderStatusPending {
		log.Info().
			Str("ref", order.Reference).
			Str("status", string(order.Status)).
			Str("attempted_by", processedBy).
			Msg("Order not in pending status")
		return order, ErrAlreadyProcessed
	}

	// 2. PAYMENT STATUS CHECK
    if data.Status != "success" {
        log.Warn().Str("ref", order.Reference).Msg("Transaction failed upstream.")
        
        // ATOMIC RECOVERY: Mark failed AND release stock in one transaction
        _ = s.OrderRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
            _ = s.OrderRepo.UpdateOrderStatusTx(ctx, tx, order.ID, models.OrderStatusFailed)
            return s.releaseReservedStockTx(ctx, tx, order) // Implement this to increment stock back
        })
        
        return order, errors.New("transaction verification failed")
    }

	// 3. AMOUNT VALIDATION (fraud detection)
	if int64(data.Amount) != order.FinalTotal {
		log.Warn().
			Int64("expected", order.FinalTotal).
			Int64("received", int64(data.Amount)).
			Str("reference", order.Reference).
			Msg("Amount mismatch detected.")
		_ = s.OrderRepo.UpdateOrderStatus(ctx, order.ID, models.OrderStatusFraud)
		return order, fmt.Errorf("AmountMismatch: expected %d, received %d", order.FinalTotal, data.Amount)
	}

	// 4. UPDATE ORDER WITH PAYMENT DETAILS
	order.AmountPaid = int64(data.Amount)
	order.ServiceFee = int64(data.Fees)
	order.PaymentChannel = models.ToNullString(data.Channel)

	// 5. PARSE PAYMENT TIMESTAMP
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

	// 6. SET ORDER STATUS
	order.Status = models.OrderStatusSuccess
	order.ProcessedBy = models.ToNullString(processedBy)
	order.UpdatedAt = time.Now().UTC()

	// 7. GENERATE TICKETS (in-memory, not saved yet)
	tickets, err := s.generateTicketsForOrder(ctx, order)
    if err != nil {
        return order, fmt.Errorf("failed to generate tickets: %w", err)
    }

	// 8. ATOMIC TRANSACTION
	err = s.OrderRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
		// 8a. Update order status (with idempotency check)
		if err := s.OrderRepo.UpdateOrderToPaidTx(ctx, tx, order); err != nil {
			return err
		}

		// 8b. Insert generated tickets
		if err := s.OrderRepo.InsertTicketsTx(ctx, tx, order, tickets); err != nil {
			return err
		}

		return nil // All operations succeeded
	})

	// 9. HANDLE TRANSACTION RESULT
	if err != nil {
		// Database-level idempotency (race condition caught)
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

	// 10. SUCCESS
	log.Info().
		Str("ref", order.Reference).
		Str("processed_by", processedBy).
		Msg("Order finalized successfully")

	return order, nil
}

/*
generateTicketsForOrder creates ticket records for each purchased item.

For each item in the order, creates N tickets (where N = quantity).
Each ticket gets:
- Unique code for validation
- References to order, event, and ticket tier
- User association (if logged in)
*/
func (s *OrderServiceImpl) generateTicketsForOrder(
	ctx context.Context,
	order *models.Order,
) ([]models.Ticket, error) {
	now := time.Now().UTC()
	var tickets []models.Ticket
	ticketIndex := 0

	// Loop through each order item
	for _, item := range order.Items {
		// Create one ticket per quantity
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

			// Associate with user if logged in
			if order.UserID != nil {
				ticket.UserID = order.UserID
			}

			tickets = append(tickets, ticket)
			ticketIndex++
		}
	}

	return tickets, nil
}

/*
applyStockReductionsTx reduces available ticket stock for purchased items.

Groups reductions by ticket tier to minimize database calls.
Critical for preventing over-selling (ensures stock consistency).
*/
func (s *OrderServiceImpl) applyStockReductionsTx(
	ctx context.Context,
	tx *sqlx.Tx,
	order *models.Order,
) error {
	// Group reductions by ticket tier ID
	reductions := make(map[uuid.UUID]repoorder.StockReduction)

	for _, item := range order.Items {
		key := item.TicketTierID

		if r, ok := reductions[key]; ok {
			// Aggregate multiple items of same tier
			r.Quantity += item.Quantity
			reductions[key] = r
			continue
		}

		// First reduction for this tier
		reductions[key] = repoorder.StockReduction{
			EventID:      item.EventID,
			TicketTierID: item.TicketTierID,
			TierName:     item.TierName,
			Quantity:     item.Quantity,
		}
	}

	// Apply each reduction
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

/*
cleanupExpiredLocks removes old locks from the verification cache.

Runs asynchronously to clean up memory. Locks expire after 30 seconds
to prevent memory leaks from abandoned requests.
*/
func cleanupExpiredLocks() {
	now := time.Now()
	verificationLocks.Range(func(key, value interface{}) bool {
		lock := value.(*verificationLock)
		lock.mu.Lock()
		// Remove if expired and not in-flight
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

/*
StockExhaustionError indicates insufficient ticket stock during processing.

Used to differentiate stock issues from other errors.
Contains detailed information for logging and client feedback.
*/
type StockExhaustionError struct {
	TierName  string
	Requested int32
	Available int32
}

func (e *StockExhaustionError) Error() string {
	return fmt.Sprintf("insufficient stock for %s: requested %d, only %d available",
		e.TierName, e.Requested, e.Available)
}

func (s *OrderServiceImpl) releaseReservedStockTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error {
    for _, item := range order.Items {
        // We use an INCREMENT query in the repository
        err := s.EventRepo.IncrementTicketStockTx(ctx, tx, item.EventID, item.TierName, item.Quantity)
        if err != nil {
            return err
        }
    }
    return nil
}