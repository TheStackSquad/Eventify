// backend/pkg/services/order/order_services.go

package order

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
	"io"
	"net/http"
	"os"
	"strings"

	"eventify/backend/pkg/models"
	repoevent "eventify/backend/pkg/repository/event"
	repoorder "eventify/backend/pkg/repository/order"

	"github.com/google/uuid"
)

// ============================================================================
// INTERFACES
// ============================================================================

// PricingService calculates order totals using authoritative DB prices
type PricingService interface {
	CalculateAuthoritativeOrder(ctx context.Context, req *models.OrderInitializationRequest) (*models.Order, error)
}

// PaystackClient handles external Paystack API communications
type PaystackClient interface {
	InitializeTransaction(ctx context.Context, email string, amountKobo int64, reference string) (string, error)
	VerifyTransaction(ctx context.Context, reference string) (*models.PaystackVerificationResponse, error)
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

// PaystackClientImpl implements PaystackClient using HTTP client
type PaystackClientImpl struct {
	SecretKey  string
	HTTPClient *http.Client
	FrontendBaseURL string
}

// OrderServiceImpl implements OrderService orchestrating order flow
type OrderServiceImpl struct {
	OrderRepo      repoorder.OrderRepository
	EventRepo      repoevent.EventRepository
	PricingService PricingService
	PaystackClient PaystackClient
	PaystackSecret string
}

// NewOrderService creates a new order service instance
func NewOrderService(
	orderRepo repoorder.OrderRepository,
	eventRepo repoevent.EventRepository,
	pricingService PricingService,
	psClient PaystackClient,
) OrderService {
	return &OrderServiceImpl{
		OrderRepo:      orderRepo,
		EventRepo:      eventRepo,
		PricingService: pricingService,
		PaystackClient: psClient,
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

// ============================================================================
// PAYSTACK CLIENT IMPLEMENTATION
// ============================================================================

/*
InitializeTransaction creates a Paystack hosted payment page session.

Flow:
1. Convert order amount to Kobo (1 NGN = 100 Kobo)
2. POST to Paystack /transaction/initialize
3. Return authorization_url for redirect

Example Paystack Response:
{
  "status": true,
  "message": "Authorization URL created",
  "data": {
    "authorization_url": "https://checkout.paystack.com/xxx",
    "access_code": "xxxx",
    "reference": "order_123"
  }
}
*/
// InitializeTransaction creates a new Paystack transaction with callback URL
func (c *PaystackClientImpl) InitializeTransaction(ctx context.Context, email string, amountKobo int64, reference string) (string, error) {
	url := "https://api.paystack.co/transaction/initialize"

	// Construct callback URL - Paystack will redirect here after payment
	callbackURL := fmt.Sprintf("%s/checkout/confirmation", c.FrontendBaseURL)

	payload := map[string]interface{}{
		"email":        email,
		"amount":       amountKobo,
		"reference":    reference,
		"callback_url": callbackURL, // ✅ This ensures redirect after payment
		"metadata": map[string]interface{}{ // Optional but recommended for tracking
			"custom_fields": []map[string]interface{}{
				{
					"display_name": "Order Reference",
					"variable_name": "order_reference",
					"value":         reference,
				},
			},
		},
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal paystack initialization payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return "", fmt.Errorf("failed to create paystack initialization request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.SecretKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("paystack initialization request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("paystack initialization returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var res struct {
		Status  bool   `json:"status"`
		Message string `json:"message"`
		Data    struct {
			AuthorizationURL string `json:"authorization_url"`
			AccessCode       string `json:"access_code"`
			Reference        string `json:"reference"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", fmt.Errorf("failed to decode paystack initialization response: %w", err)
	}

	if !res.Status {
		return "", fmt.Errorf("paystack initialization error: %s", res.Message)
	}

	return res.Data.AuthorizationURL, nil
}

/*
VerifyTransaction confirms payment status with Paystack API.

Flow:
1. GET from Paystack /transaction/verify/{reference}
2. Parse response into structured model
3. Validate Paystack's internal status field

Critical Data Returned:
- data.status: "success", "failed", "abandoned"
- data.amount: Amount paid in Kobo (must match order total)
- data.paid_at: Payment timestamp
- data.channel: Payment method (card, bank, etc.)
*/
// VerifyTransaction verifies a Paystack transaction by reference
func (c *PaystackClientImpl) VerifyTransaction(ctx context.Context, reference string) (*models.PaystackVerificationResponse, error) {
	url := fmt.Sprintf("https://api.paystack.co/transaction/verify/%s", reference)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create paystack verification request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.SecretKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("paystack verification request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("paystack verification returned non-200 status code %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var paystackResponse models.PaystackVerificationResponse
	if err := json.NewDecoder(resp.Body).Decode(&paystackResponse); err != nil {
		return nil, fmt.Errorf("failed to decode paystack verification response: %w", err)
	}

	if !paystackResponse.Status {
		return nil, fmt.Errorf("paystack verification failed: %s", paystackResponse.Message)
	}

	return &paystackResponse, nil
}