// backend/pkg/models/order_initialization.go

package models

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
)

type OrderInitializationRequest struct {
	Email     string                        `json:"email" binding:"required,email"`
	FirstName string                        `json:"firstName" binding:"required"`
	LastName  string                        `json:"lastName" binding:"required"`
	Phone     string                        `json:"phone"`
	Items     []OrderInitializationItem     `json:"items" binding:"required,min=1,dive"`
	UserID    *uuid.UUID                    `json:"userId,omitempty"`
}

type OrderInitializationItem struct {
	EventID      uuid.UUID `json:"eventId" binding:"required"`
//	TicketTierID uuid.UUID `json:"ticketTierId" binding:"required"`
	TierName     string    `json:"tierName" binding:"required"`
	Quantity     int32     `json:"quantity" binding:"required,min=1"`
}

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

	for i, item := range r.Items {
		if item.EventID == uuid.Nil {
			return fmt.Errorf("item %d: eventId is required", i)
		}
		// if item.TicketTierID == uuid.Nil {
		// 	return fmt.Errorf("item %d: ticketTierId is required", i)
		// }
		 if item.TierName == "" {
            return fmt.Errorf("item %d: tierName is required", i)
        }
		if item.Quantity <= 0 {
			return fmt.Errorf("item %d: quantity must be positive", i)
		}
	}

	return nil
}