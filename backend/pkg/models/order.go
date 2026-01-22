//backend/pkg/models/order.go

package models

import (
	"database/sql"
	"encoding/json"
	"math"
	"time"

	"github.com/google/uuid"
)

const (
	VATRate              float64 = 0.075  // 7.5%
	TierThreshold        int64   = 500000 // ₦5,000 in Kobo
	SmallTicketRate      float64 = 0.10   // 10%
	PremiumTicketRate    float64 = 0.07   // 7%
	PremiumTicketFlatFee int64   = 5000   // ₦50 in Kobo
	PaystackPercentage   float64 = 0.015  // 1.5%
	PaystackFlatFee      int64   = 10000  // ₦100 in Kobo
)

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
	PaystackFee       int64          `json:"paystackFee" db:"paystack_fee"`
	AppProfit         int64          `json:"appProfit" db:"app_profit"`
	PaidAt            sql.NullTime   `json:"paidAt,omitempty" db:"paid_at"`
	ProcessedBy       sql.NullString `json:"processedBy,omitempty" db:"processed_by"`
	WebhookAttempts   int            `json:"webhookAttempts" db:"webhook_attempts"`
	CustomerEmail     string         `json:"customerEmail" db:"customer_email"`
	CustomerFirstName string         `json:"customerFirstName" db:"customer_first_name"`
	CustomerLastName  string         `json:"customerLastName" db:"customer_last_name"`
	CustomerPhone     sql.NullString `json:"customerPhone,omitempty" db:"customer_phone"`
	CreatedAt         time.Time      `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time      `db:"updated_at"`

	// --- Virtual Fields (Populated via JOINs for Email/Worker) ---
	// These solve your "undefined" compiler errors
	UserName   string `json:"userName,omitempty" db:"user_name"`
	UserEmail  string `json:"userEmail,omitempty" db:"user_email"`
	EventTitle string `json:"eventTitle,omitempty" db:"event_title"`

	// --- Relations ---
	Items []OrderItem `json:"items,omitempty" db:"-"`
}

// models/order_item.go

type OrderItem struct {
    ID             uuid.UUID `json:"id" db:"id"`
    OrderID        uuid.UUID `json:"orderId" db:"order_id"`
    EventID        uuid.UUID `json:"eventId" db:"event_id"`
    TicketTierID   uuid.UUID `json:"ticketTierId" db:"ticket_tier_id"`
    TierName       string    `json:"tierName" db:"tier_name"`
    Quantity       int32     `json:"quantity" db:"quantity"`
    UnitPrice      int64     `json:"unitPrice" db:"unit_price"`
    Subtotal       int64     `json:"subtotal" db:"subtotal"`
    EventTitle     string    `json:"eventTitle" db:"event_title"`
    EventThumbnail string    `json:"eventThumbnail" db:"event_thumbnail"`
    
    // Catch the COALESCE and JOIN fields from itemsQuery
    EventStartDate time.Time `json:"eventStartDate" db:"event_start_date"`
    EventEndDate   time.Time `json:"eventEndDate" db:"event_end_date"`
    EventCity      string    `json:"eventCity" db:"event_city"`
    EventState     string    `json:"eventState" db:"event_state"`
    EventVenue     string    `json:"eventVenue" db:"event_venue"`
    EventAddress   string    `json:"eventAddress" db:"event_address"`
    
    CreatedAt      time.Time `json:"createdAt" db:"created_at"`
}

// --- Financial Logic ---

func CalculateServiceFee(subtotalKobo int64) int64 {
	if subtotalKobo <= TierThreshold {
		return int64(math.Round(float64(subtotalKobo) * SmallTicketRate))
	}
	fee := (float64(subtotalKobo) * PremiumTicketRate) + float64(PremiumTicketFlatFee)
	return int64(math.Round(fee))
}

func CalculateVAT(subtotalKobo int64, serviceFeeKobo int64) int64 {
	if subtotalKobo <= TierThreshold {
		return 0 // Included in small ticket rate for low-cost tickets
	}
	return int64(math.Round(float64(serviceFeeKobo) * VATRate))
}

func CalculatePaystackFee(finalTotalKobo int64) int64 {
	// Paystack Nigeria: 1.5% + ₦100
	fee := (float64(finalTotalKobo) * PaystackPercentage) + float64(PaystackFlatFee)
	return int64(math.Round(fee))
}

// MarshalJSON cleans up sql.Null types for the frontend
func (o Order) MarshalJSON() ([]byte, error) {
	type Alias Order

	cleanStr := func(ns sql.NullString) *string {
		if ns.Valid {
			return &ns.String
		}
		return nil
	}

	var paidAt *time.Time
	if o.PaidAt.Valid {
		paidAt = &o.PaidAt.Time
	}

	return json.Marshal(&struct {
		GuestID        *string    `json:"guestId"`
		IPAddress      *string    `json:"ipAddress"`
		UserAgent      *string    `json:"userAgent"`
		PaymentChannel *string    `json:"paymentChannel"`
		ProcessedBy    *string    `json:"processedBy"`
		CustomerPhone  *string    `json:"customerPhone"`
		PaidAt         *time.Time `json:"paidAt"`
		Alias
	}{
		GuestID:        cleanStr(o.GuestID),
		IPAddress:      cleanStr(o.IPAddress),
		UserAgent:      cleanStr(o.UserAgent),
		PaymentChannel: cleanStr(o.PaymentChannel),
		ProcessedBy:    cleanStr(o.ProcessedBy),
		CustomerPhone:  cleanStr(o.CustomerPhone),
		PaidAt:         paidAt,
		Alias:          (Alias)(o),
	})
}