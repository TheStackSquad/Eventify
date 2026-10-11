// backend/pkg/services/subscription/subscription_interface.go

package subscription

import (
	"context"

	"time"
	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
)

// InitiateResponse represents the combined data needed by the frontend 
// to redirect to Paystack and track the pending transaction.
type InitiateResponse struct {
    SubscriptionID   uuid.UUID `json:"subscriptionId"`
    AuthorizationURL string    `json:"authorizationUrl"`
    Reference        string    `json:"reference"`
    Tier             string    `json:"tier"`
    AmountKobo       int64     `json:"amountKobo"`
}


// WebhookPayload represents the structure of incoming data from Paystack webhooks.
type WebhookPayload struct {
	Event string      `json:"event"`
	Data  WebhookData `json:"data"`
}

// WebhookData contains the specific payment details within a webhook payload.
type WebhookData struct {
	Reference string            `json:"reference"`
	Status    string            `json:"status"`
	Amount    int64             `json:"amount"`
	Metadata  map[string]string `json:"metadata"`
}

// SubscriptionService defines the business logic contract for handling vendor payments.
type SubscriptionService interface {
	// InitiateSubscription starts the payment process. 
	// We include vendorID here to ensure the subscription is linked to the authenticated user.
	InitiateSubscription(ctx context.Context, vendorID uuid.UUID, req models.InitiateSubRequest) (*InitiateResponse, error)

	// GetMySubscription retrieves the current subscription status for a vendor.
	GetMySubscription(ctx context.Context, vendorID uuid.UUID) (*models.Subscription, error)

	// VerifyAndFinalize is called by the frontend after a successful redirect to confirm 
	// the payment with Paystack and update the vendor's tier atomically.
	VerifyAndFinalize(ctx context.Context, reference string, vendorID uuid.UUID) error

	// HandleWebhook processes asynchronous notifications from the payment provider.
	HandleWebhook(ctx context.Context, payload []byte, signature string) error

	// Background worker to expire old subscriptions
	StartExpiryWorker(ctx context.Context, checkInterval time.Duration)

}