// backend/pkg/services/order/order_initialization.go

package order

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/eventify/backend/pkg/utils"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog/log"
)

// ============================================================================
// ORDER INITIALIZATION
// ============================================================================

/*
InitializePendingOrder creates an order, snapshots items, and reserves stock atomically.

This is the critical entry point for the checkout flow that:
1. Validates request and calculates authoritative pricing
2. Creates a pending order with unique reference
3. Snapshots item details (prevents price changes during checkout)
4. Reserves stock immediately to prevent overselling
5. Returns the order with reference for payment processing

Flow Summary:
Frontend → POST /orders/initialize → InitializePendingOrder → Paystack → VerifyAndProcess

Step-by-Step Process:
1. VALIDATION: Checks request structure and business rules
2. PRICING: Calculates final amounts using authoritative DB prices (not cached)
3. PREPARATION: Generates unique reference and sets timestamps
4. TRANSACTION: Atomic database operations:
   a. Save order record
   b. Save order items (with snapshot of prices/tier details)
   c. Reserve stock (decrement available tickets)
5. RETURN: Order with reference for Paystack payment

Idempotency Note:
- Each call generates a new unique reference
- Stock is reserved immediately (not after payment)
- If payment fails, stock is released via expiration job

Parameters:
  - ctx:    Context for cancellation/timeout
  - req:    Order initialization request from frontend
  - userID: Optional authenticated user ID
  - guestID: Guest identifier for anonymous users

Returns:
  - *models.Order: Created order with reference and calculated totals
  - error:         Validation or database error
*/



func (s *OrderServiceImpl) InitializePendingOrder(
    ctx context.Context,
    req *models.OrderInitializationRequest,
    userID *uuid.UUID,
    guestID string,
) (*models.Order, string, error) {
    // 1. REQUEST VALIDATION (Already strict via req.Validate())
    if err := req.Validate(); err != nil {
        return nil, "", fmt.Errorf("validation failed: %w", err)
    }

    // 2. AUTHORITATIVE PRICING CALCULATION
    // ENFORCEMENT: CalculateAuthoritativeOrder must return a fully populated 
    // models.Order including the Items slice with tier names and unit prices.
    pendingOrder, err := s.PricingService.CalculateAuthoritativeOrder(ctx, req)
    if err != nil {
        return nil, "", fmt.Errorf("pricing calculation failed: %w", err)
    }

    // 3. ORDER PREPARATION
    now := time.Now().UTC()
    reference := utils.GenerateUniqueTransactionReference()

    pendingOrder.Reference = reference
    pendingOrder.Status = models.OrderStatusPending
    pendingOrder.CustomerEmail = req.Email
    pendingOrder.CustomerFirstName = req.FirstName
    pendingOrder.CustomerLastName = req.LastName
    pendingOrder.CustomerPhone = models.ToNullString(req.Phone) // Using your helper
    pendingOrder.GuestID = sql.NullString{String: guestID, Valid: guestID != ""}
    pendingOrder.CreatedAt = now
    pendingOrder.UpdatedAt = now

    if userID != nil {
        pendingOrder.UserID = userID
    }

    // 4. ATOMIC DATABASE TRANSACTION
    err = s.OrderRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
        // 4a. SAVE PARENT ORDER RECORD
        orderID, err := s.OrderRepo.SavePendingOrderTx(ctx, tx, pendingOrder)
        if err != nil {
            return fmt.Errorf("failed to save order: %w", err)
        }
        pendingOrder.ID = orderID

        // 4b. SAVE ORDER ITEMS
        for i := range pendingOrder.Items {
            pendingOrder.Items[i].ID = uuid.New()
            pendingOrder.Items[i].OrderID = orderID
            // FIELD ACCOUNTABILITY: Ensure EventID is mapped from request if pricing missed it
            if pendingOrder.Items[i].EventID == uuid.Nil {
                 pendingOrder.Items[i].EventID = req.Items[i].EventID
            }
        }

        if err := s.OrderRepo.InsertOrderItemsTx(ctx, tx, pendingOrder); err != nil {
            return fmt.Errorf("failed to save order items: %w", err)
        }

        if err := s.applyStockReductionsTx(ctx, tx, pendingOrder); err != nil {
            return fmt.Errorf("failed to reserve stock: %w", err)
        }

        return nil
    })

    if err != nil {
        return nil, "", err 
    }

    // 5. EXTERNAL HANDSHAKE: Paystack with Metadata
    // ENFORCEMENT: We pass order_id and event_id in metadata to prevent "orphaned" sessions.
    metadata := map[string]string{
    "order_id": pendingOrder.ID.String(),
    "event_id": req.Items[0].EventID.String(),
}

    authURL, err := s.PaystackClient.InitializeTransaction(
        ctx, 
        pendingOrder.CustomerEmail, 
        int64(pendingOrder.FinalTotal), 
        pendingOrder.Reference,
        metadata,

    )
    
    if err != nil {
        return nil, "", fmt.Errorf("payment gateway initialization failed: %w", err)
    }

    return pendingOrder, authURL, nil
}

// ============================================================================
// STOCK CLEANUP
// ============================================================================

/*
ReleaseExpiredStock identifies abandoned orders and returns tickets to available pool.

This function is typically called by a cron job every 1-5 minutes to:
1. Find pending orders older than expiry threshold (e.g., 15 minutes)
2. Mark them as EXPIRED
3. Release reserved stock back to ticket_tiers
4. Prevent stock from being permanently locked by abandoned carts

Why this is necessary:
- Stock is reserved in InitializePendingOrder (before payment)
- If user abandons checkout, stock remains reserved
- This job cleans up those reservations

Implementation Notes:
- Requires corresponding repository methods
- Should handle concurrent execution safely
- Logs count of processed orders for monitoring
*/
func (s *OrderServiceImpl) ReleaseExpiredStock(
	ctx context.Context,
	expiryDuration time.Duration,
) (int, error) {
	threshold := time.Now().UTC().Add(-expiryDuration)
	var count int

	log.Info().Time("threshold", threshold).Msg("Running stock release worker")

	// Implementation would typically:
	// 1. Get expired pending orders (status='PENDING', created_at < threshold)
	// 2. For each order in transaction:
	//    a. Update status to 'EXPIRED'
	//    b. Increment ticket_tiers stock for each item
	// 3. Return count of processed orders

	return count, nil
}

// ============================================================================
// ORDER RETRIEVAL WITH AUTH
// ============================================================================

/*
GetOrderByReference retrieves an order with authorization logic.

This function ensures proper access control for both:
1. Authenticated users (can access their own orders)
2. Guest users (can access orders with matching guest ID)

Authorization Rules:
- Authenticated user: Can access orders where order.UserID matches their ID
- Guest user: Can access orders where order.GuestID matches their session ID
- No access: If neither condition matches

Used by:
- Payment verification endpoint
- Order status checking
- Ticket retrieval
*/
func (s *OrderServiceImpl) GetOrderByReference(
	ctx context.Context,
	reference string,
	userID *uuid.UUID,
	guestID string,
) (*models.Order, error) {
	order, err := s.OrderRepo.GetOrderByReference(ctx, reference)
	if err != nil || order == nil {
		return nil, err
	}

	// AUTHENTICATED USER ACCESS
	if order.UserID != nil && userID != nil && *order.UserID == *userID {
		return order, nil
	}

	// GUEST USER ACCESS
	if order.GuestID.Valid && order.GuestID.String == guestID && guestID != "" {
		return order, nil
	}

	return nil, errors.New("unauthorized access to order")
}