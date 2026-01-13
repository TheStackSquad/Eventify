// backend/pkg/models/order.go

package models

import (
	"database/sql"
	"math"
	"time"

	"github.com/google/uuid"
)

type NullUUID sql.Null[uuid.UUID]

// --- Financial Constants ---
const (
	ServiceFeeRate float64 = 0.05
	VATRate        float64 = 0.075
)

// --- Order Statuses ---
type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "pending"
	OrderStatusProcessing OrderStatus = "processing"
	OrderStatusSuccess    OrderStatus = "success"
	OrderStatusFailed     OrderStatus = "failed"
	OrderStatusRefunded   OrderStatus = "refunded"
	OrderStatusFraud      OrderStatus = "fraud"
)

// --- Order Struct ---
type Order struct {
	ID                uuid.UUID      `json:"id" db:"id"`
	UserID            *uuid.UUID     `json:"userId,omitempty" db:"user_id"`
	GuestID           sql.NullString `json:"guestId,omitempty" db:"guest_id"` // ✅ FIXED: Changed from string to sql.NullString
	Reference         string         `json:"reference" db:"reference"`
	Status            OrderStatus    `json:"status" db:"status"`
	IPAddress         sql.NullString `json:"ipAddress,omitempty" db:"ip_address"`
	UserAgent         sql.NullString `json:"userAgent,omitempty" db:"user_agent"`
	Subtotal          int64          `json:"subtotal" db:"subtotal"`
	ServiceFee        int64          `json:"serviceFee" db:"service_fee"`
	VATAmount         int64          `json:"vatAmount" db:"vat_amount"`
	FinalTotal        int64          `json:"finalTotal" db:"final_total"`
	AmountPaid        int64          `json:"amountPaid" db:"amount_paid"`
	PaymentChannel    sql.NullString `json:"paymentChannel,omitempty" db:"payment_channel"`
	PaidAt            sql.NullTime   `json:"paidAt,omitempty" db:"paid_at"`
	ProcessedBy       sql.NullString `json:"processedBy,omitempty" db:"processed_by"`
	WebhookAttempts   int            `json:"webhookAttempts" db:"webhook_attempts"`
	CustomerEmail     string         `json:"customerEmail" db:"customer_email"`
	CustomerFirstName string         `json:"customerFirstName" db:"customer_first_name"`
	CustomerLastName  string         `json:"customerLastName" db:"customer_last_name"`
	CustomerPhone     sql.NullString `json:"customerPhone,omitempty" db:"customer_phone"`
	CreatedAt         time.Time      `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time      `json:"updatedAt" db:"updated_at"`
	Items             []OrderItem    `json:"items,omitempty" db:"-"`
	Payments          []PaymentRecord `json:"payments,omitempty" db:"-"`
}

// --- OrderItem Struct ---
type OrderItem struct {
	ID           uuid.UUID `json:"id" db:"id"`
	OrderID      uuid.UUID `json:"orderId" db:"order_id"`
	EventTitle   string    `json:"eventTitle" db:"event_title"`
	EventID      uuid.UUID `json:"eventId" db:"event_id"`
	TicketTierID uuid.UUID `json:"ticketTierId" db:"ticket_tier_id"`
	TierName     string    `json:"tierName" db:"tier_name"`
	Quantity     int32     `json:"quantity" db:"quantity"`
	UnitPrice    int64     `json:"unitPrice" db:"unit_price"`
	Subtotal     int64     `json:"subtotal" db:"subtotal"`
}

// --- Calculation Helpers ---
func CalculateServiceFee(subtotal int64) int64 {
	if subtotal <= 0 {
		return 0
	}
	fee := float64(subtotal) * ServiceFeeRate
	return int64(math.Round(fee))
}

func CalculateVAT(taxableAmount int64) int64 {
	if taxableAmount <= 0 {
		return 0
	}
	tax := float64(taxableAmount) * VATRate
	return int64(math.Round(tax))
}

// --- sql.Null Helpers ---
func ToNullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

func ToNullTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{Valid: false}
	}
	return sql.NullTime{Time: *t, Valid: true}
}

func ToNullUUID(id uuid.UUID) NullUUID {
	if id == uuid.Nil {
		return NullUUID{Valid: false}
	}
	return NullUUID{V: id, Valid: true}
}

func (n NullUUID) Ptr() *uuid.UUID {
	if n.Valid {
		return &n.V
	}
	return nil
}