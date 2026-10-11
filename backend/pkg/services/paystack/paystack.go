// backend/pkg/services/paystack/paystack.go
package paystack

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/eventify/backend/pkg/models"
)

// ---------------------------------------------------------------------------
// Client interface — both order and subscription inject this
// ---------------------------------------------------------------------------

// Client handles all external Paystack API communications.
type Client interface {
	InitializeTransaction(ctx context.Context, email string, amountKobo int64, reference string, metadata map[string]string, callbackURL string) (string, error)
	VerifyTransaction(ctx context.Context, reference string) (*models.PaystackVerificationResponse, error)
}

// ---------------------------------------------------------------------------
// Client implementation
// ---------------------------------------------------------------------------

// ClientImpl is the concrete HTTP client that talks to Paystack.
type ClientImpl struct {
	SecretKey  string
	HTTPClient *http.Client
}

// NewClient constructs a PaystackClient with the provided secret key.
// Pass nil for httpClient to use http.DefaultClient.
func NewClient(secretKey string, httpClient *http.Client) Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &ClientImpl{
		SecretKey:  secretKey,
		HTTPClient: httpClient,
	}
}

// ---------------------------------------------------------------------------
// InitializeTransaction
// ---------------------------------------------------------------------------

// initializeRequest is the body we POST to Paystack /transaction/initialize.
type initializeRequest struct {
	Email       string            `json:"email"`
	Amount      int64             `json:"amount"`
	Reference   string            `json:"reference"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	CallbackURL string            `json:"callback_url,omitempty"`
}

// initializeResponse is what Paystack returns from /transaction/initialize.
type initializeResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		AuthorizationURL string `json:"authorization_url"`
		Reference        string `json:"reference"`
	} `json:"data"`
}

func (c *ClientImpl) InitializeTransaction(ctx context.Context, email string, amountKobo int64, reference string, metadata map[string]string, callbackURL string) (string, error) {
	url := "https://api.paystack.co/transaction/initialize"

	body := initializeRequest{
		Email:       email,
		Amount:      amountKobo,
		Reference:   reference,
		Metadata:    metadata,
		CallbackURL: callbackURL,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("paystack initialize: failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return "", fmt.Errorf("paystack initialize: failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.SecretKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("paystack initialize: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("paystack initialize: returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var paystackResp initializeResponse
	if err := json.NewDecoder(resp.Body).Decode(&paystackResp); err != nil {
		return "", fmt.Errorf("paystack initialize: failed to decode response: %w", err)
	}

	if !paystackResp.Status {
		return "", fmt.Errorf("paystack initialize: %s", paystackResp.Message)
	}

	return paystackResp.Data.AuthorizationURL, nil
}

// ---------------------------------------------------------------------------
// VerifyTransaction
// ---------------------------------------------------------------------------

func (c *ClientImpl) VerifyTransaction(ctx context.Context, reference string) (*models.PaystackVerificationResponse, error) {
	url := fmt.Sprintf("https://api.paystack.co/transaction/verify/%s", reference)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("paystack verify: failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.SecretKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("paystack verify: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("paystack verify: returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var paystackResponse models.PaystackVerificationResponse
	if err := json.NewDecoder(resp.Body).Decode(&paystackResponse); err != nil {
		return nil, fmt.Errorf("paystack verify: failed to decode response: %w", err)
	}

	if !paystackResponse.Status {
		return nil, fmt.Errorf("paystack verify: %s", paystackResponse.Message)
	}

	return &paystackResponse, nil
}

// ---------------------------------------------------------------------------
// VerifyWebhookSignature — standalone function, no struct dependency.
// Both order and subscription call this directly.
// ---------------------------------------------------------------------------

// VerifyWebhookSignature validates the HMAC SHA512 signature Paystack
// attaches to webhook POST requests. secretKey is your Paystack secret key.
func VerifyWebhookSignature(payload []byte, signature string, secretKey string) bool {
	if secretKey == "" {
		return false
	}

	h := hmac.New(sha512.New, []byte(secretKey))
	h.Write(payload)
	computedSignature := strings.ToLower(hex.EncodeToString(h.Sum(nil)))

	return hmac.Equal([]byte(computedSignature), []byte(strings.ToLower(signature)))
}