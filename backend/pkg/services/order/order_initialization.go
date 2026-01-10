// backend/pkg/services/order/order_initialization.go

package order

import (
	"context"
	"errors"
	"fmt"
	"time"

	"eventify/backend/pkg/models"
	"eventify/backend/pkg/utils"

	"github.com/google/uuid"
)

// Order initialization and retrieval methods
func (s *OrderServiceImpl) InitializePendingOrder(
	ctx context.Context,
	req *models.OrderInitializationRequest,
	userID *uuid.UUID,
	guestID string,
) (*models.Order, error) {
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	pendingOrder, err := s.PricingService.CalculateAuthoritativeOrder(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("pricing calculation failed: %w", err)
	}

	reference := utils.GenerateUniqueTransactionReference()

	pendingOrder.Reference = reference
	pendingOrder.Status = models.OrderStatusPending
	pendingOrder.CustomerEmail = req.Email
	pendingOrder.CustomerFirstName = req.FirstName
	pendingOrder.CustomerLastName = req.LastName
	pendingOrder.CustomerPhone = models.ToNullString(req.Phone)
	pendingOrder.GuestID = guestID
	pendingOrder.CreatedAt = time.Now().UTC()
	pendingOrder.UpdatedAt = time.Now().UTC()

	// FIX: Added missing closing brace and fixed assignment
	if userID != nil {
		pendingOrder.UserID = userID
	}

	orderID, err := s.OrderRepo.SavePendingOrder(ctx, pendingOrder)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize payment: %w", err)
	}

	pendingOrder.ID = orderID
	return pendingOrder, nil
}


func (s *OrderServiceImpl) GetOrderByReference(
    ctx context.Context,
    reference string,
    userID *uuid.UUID,
    guestID string,
) (*models.Order, error) {
    order, err := s.OrderRepo.GetOrderByReference(ctx, reference)
    if err != nil || order == nil {
        return nil, err
    }

    // Authenticated user access
    if order.UserID != nil && userID != nil && *order.UserID == *userID {
        return order, nil
    }

    // Guest user access
    if order.GuestID != "" && order.GuestID == guestID {
		return order, nil
	}

    return nil, errors.New("unauthorized access to order")
}