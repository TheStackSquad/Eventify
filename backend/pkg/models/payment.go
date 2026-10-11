// backend/pkg/models/payment.go

package models

import (
	"database/sql"
	"time"
	"github.com/google/uuid"
)

type PaymentRecord struct {
	ID               uuid.UUID        `json:"id" db:"id"`
	OrderID          uuid.UUID        `json:"orderId" db:"order_id" binding:"required"`
	GatewayTxID      sql.Null[int64]  `json:"gatewayTxId" db:"gateway_tx_id"`
	GatewayReference string           `json:"gatewayReference" db:"gateway_reference" binding:"required"`
	AmountPaid       int64            `json:"amountPaid" db:"amount_paid"`
	FeesPaid         int64            `json:"feesPaid" db:"fees_paid"`
	Currency         string           `json:"currency" db:"currency"`
	Status           string           `json:"status" db:"status"`
	GatewayResponse  string           `json:"gatewayResponse" db:"gateway_response"`
	Channel          string           `json:"channel" db:"channel"`
	IPAddress        sql.NullString   `json:"ipAddress" db:"ip_address"`
	PaidAt           sql.NullTime     `json:"paidAt" db:"paid_at"`
	CreatedAt        time.Time        `json:"createdAt" db:"created_at"`
	UpdatedAt        time.Time        `json:"updatedAt" db:"updated_at"`
}