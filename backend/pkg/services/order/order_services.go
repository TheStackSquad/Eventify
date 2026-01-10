// backend/pkg/services/order/order_services.go

package order

import (
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"net/http" // Added for PaystackClientImpl
	"os"
	"fmt"
	"strings"
	"encoding/json"
    "io"

	"eventify/backend/pkg/models"
	repoevent "eventify/backend/pkg/repository/event"
	repoorder "eventify/backend/pkg/repository/order"

	"github.com/google/uuid"
)

// --- INTERFACES ---

type PricingService interface {
	CalculateAuthoritativeOrder(ctx context.Context, req *models.OrderInitializationRequest) (*models.Order, error)
}

// PaystackClient defines the Paystack client interface for external API calls
type PaystackClient interface {
	VerifyTransaction(ctx context.Context, reference string) (*models.PaystackVerificationResponse, error)
}

// OrderService defines the application service interface for order processing
type OrderService interface {
	InitializePendingOrder(
		ctx context.Context,
		req *models.OrderInitializationRequest,
		userID *uuid.UUID,
		guestID string,
	) (*models.Order, error)

	GetOrderByReference(
		ctx context.Context,
		reference string,
		userID *uuid.UUID,
		guestID string,
	) (*models.Order, error)

	VerifyAndProcess(
		ctx context.Context,
		reference string,
		guestID string,
	) (*models.Order, error)

	VerifyWebhookSignature(
		payload []byte,
		signature string,
	) bool

	ProcessWebhook(
		ctx context.Context,
		payload *models.PaystackWebhook,
		signature string,
	) error
}

// --- STRUCTS (Implementations) ---

// PaystackClientImpl is the concrete implementation for calling the Paystack API
type PaystackClientImpl struct {
	SecretKey string
	HTTPClient *http.Client
}

// OrderServiceImpl implements the OrderService interface
type OrderServiceImpl struct {
	OrderRepo repoorder.OrderRepository
	EventRepo repoevent.EventRepository
	PricingService PricingService
	PaystackClient PaystackClient
	PaystackSecret string
}

// --- CONSTRUCTOR ---

// NewOrderService creates a new instance of OrderService
func NewOrderService(
	orderRepo repoorder.OrderRepository,
	eventRepo repoevent.EventRepository,
	pricingService PricingService,
	psClient PaystackClient,
) OrderService {
	// Get the Paystack secret key from environment
	paystackSecret := os.Getenv("PAYSTACK_SECRET_KEY")

	return &OrderServiceImpl{
		OrderRepo: orderRepo,
		EventRepo: eventRepo,
		PricingService: pricingService,
		PaystackClient: psClient,
		PaystackSecret: paystackSecret,
	}
}

// --- METHODS ---

// VerifyWebhookSignature verifies the HMAC signature from Paystack webhook
func (s *OrderServiceImpl) VerifyWebhookSignature(payload []byte, signature string) bool {
	// 1. Get the secret key
	secret := s.PaystackSecret
	if secret == "" {
		return false
	}

	// 2. Compute the HMAC signature using SHA512
	h := hmac.New(sha512.New, []byte(secret))
	h.Write(payload)
	computedSignature := h.Sum(nil)

	// 3. Convert computed signature to hex string
	computedSignatureHex := strings.ToLower(hex.EncodeToString(computedSignature))

	// 4. Compare the computed signature with the signature from the header
	return hmac.Equal([]byte(computedSignatureHex), []byte(signature))
}

// VerifyTransaction calls the Paystack API to verify a transaction reference.
func (c *PaystackClientImpl) VerifyTransaction(ctx context.Context, reference string) (*models.PaystackVerificationResponse, error) {
	// 1. Construct the API URL
    // Paystack Verification Endpoint: https://api.paystack.co/transaction/verify/{reference}
	url := fmt.Sprintf("https://api.paystack.co/transaction/verify/%s", reference)
    
    // 2. Create the request
    // We use http.NewRequestWithContext for context management (timeouts/cancellation)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create paystack verification request: %w", err)
	}

	// 3. Set required Authorization header
    // The secret key is stored in the struct field
	req.Header.Set("Authorization", "Bearer "+c.SecretKey)
	req.Header.Set("Content-Type", "application/json")

	// 4. Execute the request
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		// This handles network errors, timeouts (due to context), etc.
		return nil, fmt.Errorf("paystack verification request failed: %w", err)
	}
	defer resp.Body.Close()

	// 5. Handle non-200 HTTP status codes
	if resp.StatusCode != http.StatusOK {
		// Log the status code and body for debugging Paystack errors
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("paystack verification returned non-200 status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	// 6. Decode the JSON response
	var paystackResponse models.PaystackVerificationResponse
	if err := json.NewDecoder(resp.Body).Decode(&paystackResponse); err != nil {
		return nil, fmt.Errorf("failed to decode paystack verification response: %w", err)
	}

	// 7. Check the Paystack API status field
	if !paystackResponse.Status {
		return nil, fmt.Errorf("paystack verification failed: %s", paystackResponse.Message)
	}

	return &paystackResponse, nil
}