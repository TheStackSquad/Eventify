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
	VATRate              float64 = 0.075 // 7.5%
	TierThreshold        int64   = 500000 // ₦5,000 in Kobo
	SmallTicketRate      float64 = 0.10   // 10%
	PremiumTicketRate    float64 = 0.07   // 7%
	PremiumTicketFlatFee int64   = 5000   // ₦50 in Kobo
	// Paystack specific constants
    PaystackPercentage   float64 = 0.015  // 1.5%
    PaystackFlatFee      int64   = 10000  // ₦100 in Kobo
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
	OrderStatusExpired    OrderStatus = "expired"
)

// --- Order Struct ---
type Order struct {
	ID                uuid.UUID      `json:"id" db:"id"`
	UserID            *uuid.UUID     `json:"userId,omitempty" db:"user_id"`
	GuestID           sql.NullString `json:"guestId,omitempty" db:"guest_id"`
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
    PaystackFee   int64 `json:"paystackFee" db:"paystack_fee"`
    AppProfit     int64 `json:"appProfit" db:"app_profit"`
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
// backend/pkg/models/order.go

type OrderItem struct {
	ID           uuid.UUID `json:"id" db:"id"`
	OrderID      uuid.UUID `json:"orderId" db:"order_id"`
	EventID      uuid.UUID `json:"eventId" db:"event_id"`
	TicketTierID uuid.UUID `json:"ticketTierId" db:"ticket_tier_id"`
	TierName     string    `json:"tierName" db:"tier_name"`
	Quantity     int32     `json:"quantity" db:"quantity"`
	UnitPrice    int64     `json:"unitPrice" db:"unit_price"`
	Subtotal     int64     `json:"subtotal" db:"subtotal"`
	EventTitle   string    `json:"eventTitle" db:"event_title"`
	
	EventStartDate time.Time `json:"eventStartDate" db:"event_start_date"`
	EventEndDate   time.Time `json:"eventEndDate" db:"event_end_date"`
	EventCity      string    `json:"eventCity" db:"event_city"`
	EventState     string    `json:"eventState" db:"event_state"`
	EventVenue     string    `json:"eventVenue" db:"event_venue"`
	EventAddress   string    `json:"eventAddress" db:"event_address"`
	EventThumbnail string    `json:"eventThumbnail" db:"event_thumbnail"`
}

// --- Calculation Helpers ---
func CalculateServiceFee(subtotalKobo int64) int64 {
    if subtotalKobo <= TierThreshold {
        return int64(math.Round(float64(subtotalKobo) * SmallTicketRate))
    }
    fee := (float64(subtotalKobo) * PremiumTicketRate) + float64(PremiumTicketFlatFee)
    return int64(math.Round(fee))
}

func CalculateVAT(subtotalKobo int64, serviceFeeKobo int64) int64 {
    if subtotalKobo <= TierThreshold {
        return 0 // Included in small ticket rate
    }
    return int64(math.Round(float64(serviceFeeKobo) * VATRate))
}

func CalculatePaystackFee(finalTotalKobo int64) int64 {
    fee := (float64(finalTotalKobo) * PaystackPercentage) + float64(PaystackFlatFee)
    return int64(math.Round(fee))
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