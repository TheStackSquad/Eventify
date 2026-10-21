// backend/pkg/services/order/order_services.go
package order

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/eventify/backend/pkg/models"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog/log"

	repoevent "github.com/eventify/backend/pkg/repository/event"
	repoorder "github.com/eventify/backend/pkg/repository/order"
	"github.com/eventify/backend/pkg/services/paystack"
	"github.com/eventify/backend/pkg/utils"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrInvalidOrder              = errors.New("invalid order")
	ErrCheckoutBusy              = errors.New("checkout is busy, please retry")
	ErrPaymentGatewayUnavailable = errors.New("payment gateway unavailable")
	ErrOrderNotFound             = errors.New("order not found")
)

// INTERFACES

type PricingService interface {
	CalculateAuthoritativeOrder(ctx context.Context, req *models.OrderInitializationRequest) (*models.Order, error)
}

type OrderService interface {
	InitializePendingOrder(ctx context.Context, req *models.OrderInitializationRequest, userID *uuid.UUID, guestID string) (*models.Order, string, error)
	GetOrderByReference(ctx context.Context, reference string, userID *uuid.UUID, guestID string) (*models.Order, error)
	VerifyAndProcess(ctx context.Context, reference string, guestID string) (*models.Order, error)
	ProcessWebhook(ctx context.Context, webhook *models.PaystackWebhook, signature string) error
	VerifyWebhookSignature(body []byte, signature string) bool
	StartStockReleaseWorker(ctx context.Context, interval time.Duration, expiry time.Duration)
}

// IMPLEMENTATION

type OrderServiceImpl struct {
	OrderRepo       repoorder.OrderRepository
	EventRepo       repoevent.EventRepository
	PricingService  PricingService
	PaystackClient  paystack.Client
	FrontendBaseURL string
	PaystackSecret  string
}

func NewOrderService(
	orderRepo repoorder.OrderRepository,
	eventRepo repoevent.EventRepository,
	pricingService PricingService,
	psClient paystack.Client,
) OrderService {
	return &OrderServiceImpl{
		OrderRepo:       orderRepo,
		EventRepo:       eventRepo,
		PricingService:  pricingService,
		PaystackClient:  psClient,
		FrontendBaseURL: os.Getenv("FRONTEND_BASE_URL"),
		PaystackSecret:  os.Getenv("PAYSTACK_SECRET_KEY"),
	}
}

func (s *OrderServiceImpl) VerifyWebhookSignature(body []byte, signature string) bool {
	return paystack.VerifyWebhookSignature(body, signature, s.PaystackSecret)
}

// InitializePendingOrder handles validation, stock reservation, and payment link generation
func (s *OrderServiceImpl) InitializePendingOrder(
	ctx context.Context,
	req *models.OrderInitializationRequest,
	userID *uuid.UUID,
	guestID string,
) (*models.Order, string, error) {
	// 1. REQUEST VALIDATION
	// 1. validation
	if err := req.Validate(); err != nil {
		return nil, "", fmt.Errorf("%w: %w", ErrInvalidOrder, err)
	}

	// 2. AUTHORITATIVE PRICING CALCULATION
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
	pendingOrder.CustomerPhone = models.ToNullString(req.Phone)
	pendingOrder.GuestID = sql.NullString{String: guestID, Valid: guestID != ""}
	pendingOrder.CreatedAt = now
	pendingOrder.UpdatedAt = now

	if userID != nil {
		pendingOrder.UserID = userID
	}

	// 4. ATOMIC DATABASE TRANSACTION (Stock Reservation)
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
		}

		if err := s.OrderRepo.InsertOrderItemsTx(ctx, tx, pendingOrder); err != nil {
			return fmt.Errorf("failed to save order items: %w", err)
		}

		// 4c. RESERVE STOCK
		if err := s.applyStockReductionsTx(ctx, tx, pendingOrder); err != nil {
			return fmt.Errorf("failed to reserve stock: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, "", err
	}

	// 5. EXTERNAL HANDSHAKE
	callbackURL := fmt.Sprintf("%s/checkout/confirmation", s.FrontendBaseURL)
	metadata := map[string]string{
		"payment_type": "ticket_purchase",
		"order_id":     pendingOrder.ID.String(),
		"reference":    pendingOrder.Reference,
	}

	authURL, err := s.PaystackClient.InitializeTransaction(
		ctx,
		pendingOrder.CustomerEmail,
		int64(pendingOrder.FinalTotal),
		pendingOrder.Reference,
		metadata,
		callbackURL,
	)

	if err != nil {
		// Note: We don't rollback the DB here. If Paystack fails, the order stays 'pending'
		// and the StockReleaseWorker will recover the stock after the timeout.
		return nil, "", fmt.Errorf("payment gateway initialization failed: %w", err)
	}

	return pendingOrder, authURL, nil
}

func (s *OrderServiceImpl) GetOrderByReference(
	ctx context.Context,
	reference string,
	userID *uuid.UUID,
	guestID string,
) (*models.Order, error) {
	order, err := s.OrderRepo.GetOrderByReference(ctx, reference)
	if err != nil {
		return nil, fmt.Errorf("loading order %s: %w", reference, err)
	}
	if order == nil {
		return nil, fmt.Errorf("%w: reference %s", ErrOrderNotFound, reference)
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

// isTransientDBError: lock wait exceeded (55P03), deadlock (40P01), serialization failure (40001), or timeout.
func isTransientDBError(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "55P03", "40P01", "40001":
			return true
		}
	}
	return errors.Is(err, context.DeadlineExceeded)
}

// releaseFailedInitialization returns the tickets right away when Paystack never produced a
// payment link (nobody can pay for this order) instead of holding them for 15 minutes.
func (s *OrderServiceImpl) releaseFailedInitialization(order *models.Order) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := s.OrderRepo.RunInTransaction(ctx, func(tx *sqlx.Tx) error {
		moved, err := s.OrderRepo.TransitionPendingOrderTx(ctx, tx, order.ID, models.OrderStatusFailed)
		if err != nil || !moved {
			return err
		}
		return s.releaseReservedStockTx(ctx, tx, order)
	})

	if err != nil {
		log.Error().
			Err(err).
			Str("ref", order.Reference).
			Msg("Could not release stock after gateway failure; the reaper will reclaim it")
	}
}
