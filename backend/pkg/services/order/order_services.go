// backend/pkg/services/order/order_services.go

package order

import (
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"time"
	"os"
	"strings"

	"github.com/eventify/backend/pkg/models"
	repoevent "github.com/eventify/backend/pkg/repository/event"
	repoorder "github.com/eventify/backend/pkg/repository/order"
	paystack "github.com/eventify/backend/pkg/services/paystack"

	"github.com/google/uuid"
)
import (
    
)
// ============================================================================
// INTERFACES
// ============================================================================

// PricingService calculates order totals using authoritative DB prices
type PricingService interface {
	CalculateAuthoritativeOrder(ctx context.Context, req *models.OrderInitializationRequest) (*models.Order, error)
}

// OrderService defines the core order processing operations
type OrderService interface {
	InitializePendingOrder(
		ctx context.Context,
		req *models.OrderInitializationRequest,
		userID *uuid.UUID,
		guestID string,
	) (*models.Order, string, error)

	GetOrderByReference(
		ctx context.Context,
		reference string,
		userID *uuid.UUID,
		guestID string,
	) (*models.Order, error)

	VerifyAndProcess(ctx context.Context, reference string, guestID string) (*models.Order, error)
	ProcessWebhook(ctx context.Context, webhook *models.PaystackWebhook, signature string) error
	VerifyWebhookSignature(body []byte, signature string) bool
	StartStockReleaseWorker(ctx context.Context, interval time.Duration, expiry time.Duration)

}

// ============================================================================
// IMPLEMENTATIONS
// ============================================================================

// OrderServiceImpl implements OrderService orchestrating order flow
type OrderServiceImpl struct {
	OrderRepo      repoorder.OrderRepository
	EventRepo      repoevent.EventRepository
	PricingService PricingService
	PaystackClient  paystack.Client
	PaystackSecret string
}

// NewOrderService creates a new order service instance
func NewOrderService(
	orderRepo repoorder.OrderRepository,
	eventRepo repoevent.EventRepository,
	pricingService PricingService,
	paystackClient paystack.Client,
) OrderService {
	return &OrderServiceImpl{
		OrderRepo:      orderRepo,
		EventRepo:      eventRepo,
		PricingService: pricingService,
		PaystackClient: paystackClient,
		PaystackSecret: os.Getenv("PAYSTACK_SECRET_KEY"),
	}
}

// ============================================================================
// WEBHOOK SECURITY
// ============================================================================

// VerifyWebhookSignature validates HMAC SHA512 signature from Paystack
func (s *OrderServiceImpl) VerifyWebhookSignature(payload []byte, signature string) bool {
	if s.PaystackSecret == "" {
		return false
	}

	h := hmac.New(sha512.New, []byte(s.PaystackSecret))
	h.Write(payload)
	computedSignature := strings.ToLower(hex.EncodeToString(h.Sum(nil)))

	return hmac.Equal([]byte(computedSignature), []byte(signature))
}
