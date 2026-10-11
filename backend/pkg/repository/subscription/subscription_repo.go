// backend/pkg/repository/subscription/subscription_repo.go
package subscription

import (
	"context"
	"time"

	"github.com/eventify/backend/pkg/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// SubscriptionRepository defines subscription data access

type SubscriptionRepository interface {
	Create(ctx context.Context, sub *models.Subscription) (uuid.UUID, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status models.SubscriptionStatus) error
	UpdateAfterPayment(ctx context.Context, id uuid.UUID, params PaymentUpdateParams) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Subscription, error)
	GetByReference(ctx context.Context, reference string) (*models.Subscription, error)
	IncrementWebhookAttempts(ctx context.Context, reference string) error
	GetExpired(ctx context.Context) ([]models.Subscription, error)
	RunInTransaction(ctx context.Context, fn func(tx *sqlx.Tx) error) error

	GetNeedingPaymentEmail(ctx context.Context) ([]EmailRecipient, error)
	GetNeedingReminder7D(ctx context.Context) ([]EmailRecipient, error)
	GetNeedingReminder3D(ctx context.Context) ([]EmailRecipient, error)
	GetNeedingReminder1D(ctx context.Context) ([]EmailRecipient, error)
	GetNeedingExpiredNotice(ctx context.Context) ([]EmailRecipient, error)
	GetActiveByVendorID(ctx context.Context, vendorID uuid.UUID) (*models.Subscription, error)
	
	UpdateEmailTracking(ctx context.Context, params EmailTrackingParams) error
}

// PaymentUpdateParams groups payment update fields
type PaymentUpdateParams struct {
	Status           models.SubscriptionStatus
	PaymentReference string
	PaymentMethod    string
	LastPaymentDate  time.Time
	NextPaymentDate  time.Time
	ExpiresAt        time.Time
}

// EmailRecipient contains enriched data needed for sending emails
type EmailRecipient struct {
	SubscriptionID uuid.UUID `db:"subscription_id"`
	VendorID       uuid.UUID `db:"vendor_id"`
	VendorName     string    `db:"vendor_name"`
	UserID         uuid.UUID `db:"user_id"`
	UserEmail      string    `db:"user_email"`
	UserName       string    `db:"user_name"`
	Tier           string    `db:"tier"`
	ExpiresAt      time.Time `db:"expires_at"`
	PriceKobo      int64     `db:"price"`
	Currency       string    `db:"currency"`
}

// EmailTrackingParams groups email timestamp updates (follows PaymentUpdateParams pattern)
type EmailTrackingParams struct {
	SubscriptionID       uuid.UUID
	PaymentSuccessSentAt *time.Time
	Reminder7DSentAt     *time.Time
	Reminder3DSentAt     *time.Time
	Reminder1DSentAt     *time.Time
	ExpiredNoticeSentAt  *time.Time
}

type subscriptionRepository struct {
	db *sqlx.DB
}

// NewSubscriptionRepository creates a subscription repository
func NewSubscriptionRepository(db *sqlx.DB) SubscriptionRepository {
	return &subscriptionRepository{db: db}
}
