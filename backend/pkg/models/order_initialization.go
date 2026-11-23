// backend/pkg/models/order_initialization.go

package models

import (
	"errors"
	"fmt"
	"unicode/utf8"

	"github.com/google/uuid"
)

const MaxTicketsPerOrder int32 = 10

// Column limits of the orders table (varchar sizes). Longer input is refused here with a 400
// instead of failing the insert with a 500 (F220).
const (
	MaxEmailLen = 255
	MaxNameLen  = 255
	MaxPhoneLen = 20
)

type OrderInitializationRequest struct {
	Email     string                        `json:"email" binding:"required,email"`
	FirstName string                        `json:"firstName" binding:"required"`
	LastName  string                        `json:"lastName" binding:"required"`
	Phone     string                        `json:"phone"`
	Items     []OrderInitializationItem     `json:"items" binding:"required,min=1,dive"`
	UserID    *uuid.UUID                    `json:"userId,omitempty"`
	IdempotencyKey string `json:"-"` // set from the Idempotency-Key header, never from the body
}

type OrderInitializationItem struct {
	EventID      uuid.UUID `json:"eventId" binding:"required"`
	TicketTierID uuid.UUID `json:"ticketTierId" binding:"required"`
	Quantity     int32     `json:"quantity" binding:"required,min=1"`
}

// MaxTicketsPerOrder caps how many tickets one checkout can reserve. 
// Business rule: adjust as needed.

func (r *OrderInitializationRequest) Validate() error {
	if r.Email == "" {
		return errors.New("email is required")
	}
	if r.FirstName == "" {
		return errors.New("first name is required")
	}
	if r.LastName == "" {
		return errors.New("last name is required")
	}
	if len(r.Items) == 0 {
		return errors.New("at least one item is required")
	}
	if utf8.RuneCountInString(r.Email) > MaxEmailLen {
		return fmt.Errorf("email must be at most %d characters", MaxEmailLen)
	}
	if utf8.RuneCountInString(r.FirstName) > MaxNameLen {
		return fmt.Errorf("first name must be at most %d characters", MaxNameLen)
	}
	if utf8.RuneCountInString(r.LastName) > MaxNameLen {
		return fmt.Errorf("last name must be at most %d characters", MaxNameLen)
	}
	if utf8.RuneCountInString(r.Phone) > MaxPhoneLen {
		return fmt.Errorf("phone must be at most %d characters", MaxPhoneLen)
	}
	var total int32
	for i, item := range r.Items {
		if item.EventID == uuid.Nil {
			return fmt.Errorf("item %d: eventId is required", i)
		}
		if item.TicketTierID == uuid.Nil {
			return fmt.Errorf("item %d: ticketTierId is required", i)
		}
		if item.Quantity <= 0 {
			return fmt.Errorf("item %d: quantity must be positive", i)
		}
		if item.Quantity > MaxTicketsPerOrder {
			return fmt.Errorf("item %d: at most %d tickets per order", i, MaxTicketsPerOrder)
		}
		total += item.Quantity
		if total > MaxTicketsPerOrder {
			return fmt.Errorf("an order can contain at most %d tickets", MaxTicketsPerOrder)
		}
	}
	return nil
}