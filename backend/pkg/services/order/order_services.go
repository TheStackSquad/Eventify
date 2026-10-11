// backend/pkg/services/order/order_services.go
package order

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"
	"errors"
	"github.com/rs/zerolog/log"
	
	"github.com/eventify/backend/pkg/models"

	repoevent "github.com/eventify/backend/pkg/repository/event"
	repoorder "github.com/eventify/backend/pkg/repository/order"
	"github.com/eventify/backend/pkg/services/paystack"
	"github.com/eventify/backend/pkg/utils"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
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
	if err := req.Validate(); err != nil {
		return nil, "", fmt.Errorf("validation failed: %w", err)
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

func (s *OrderServiceImpl) ReleaseExpiredStock(ctx context.Context, expiryDuration time.Duration) (int, error) {
    log.Info().Dur("expiry", expiryDuration).Msg("Running stock release worker")
    s.CleanupExpiredOrders(ctx, expiryDuration)
    return 0, nil
}
