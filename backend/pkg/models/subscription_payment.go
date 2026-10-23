//backend/pkg/models/subscription_payment.go

package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type PaymentStatus string

const (
	PaymentInitiated   PaymentStatus = "initiated"
	PaymentApplied     PaymentStatus = "applied"
	PaymentFailed      PaymentStatus = "failed"
	PaymentNeedsReview PaymentStatus = "needs_review"
)

// SubscriptionPayment is one Paystack transaction attempt (the ledger row).
type SubscriptionPayment struct {
	Reference       string           `db:"reference" json:"reference"`
	VendorID        uuid.UUID        `db:"vendor_id" json:"vendorId"`
	SubscriptionID  uuid.NullUUID    `db:"subscription_id" json:"subscriptionId"`
	Tier            SubscriptionTier `db:"tier" json:"tier"`
	AmountKobo      int64            `db:"amount_kobo" json:"amountKobo"`
	Currency        string           `db:"currency" json:"currency"`
	Status          PaymentStatus    `db:"status" json:"status"`
	PaidAmountKobo  sql.NullInt64    `db:"paid_amount_kobo" json:"-"`
	PaidCurrency    sql.NullString   `db:"paid_currency" json:"-"`
	Channel         sql.NullString   `db:"channel" json:"-"`
	ReviewReason    sql.NullString   `db:"review_reason" json:"-"`
	WebhookAttempts int              `db:"webhook_attempts" json:"-"`
	PaidAt          sql.NullTime     `db:"paid_at" json:"-"`
	AppliedAt       sql.NullTime     `db:"applied_at" json:"-"`
	CreatedAt       time.Time        `db:"created_at" json:"createdAt"`
	UpdatedAt       time.Time        `db:"updated_at" json:"updatedAt"`
}