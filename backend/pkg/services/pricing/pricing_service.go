// backend/pkg/services/pricing/pricing_service.

package pricing

import (
	"context"
	"fmt"
	"errors"
	"github.com/eventify/backend/pkg/models"
	repoevent "github.com/eventify/backend/pkg/repository/event"
	"github.com/rs/zerolog/log"
)

type PricingService interface {
	CalculateAuthoritativeOrder(ctx context.Context, req *models.OrderInitializationRequest) (*models.Order, error)
}

type PricingServiceImpl struct {
	EventRepo repoevent.EventRepository
}

func NewPricingService(eventRepo repoevent.EventRepository) PricingService {
	return &PricingServiceImpl{
		EventRepo: eventRepo,
	}
}

func (s *PricingServiceImpl) CalculateAuthoritativeOrder(
	ctx context.Context,
	req *models.OrderInitializationRequest,
) (*models.Order, error) {
	log.Info().
		Str("email", req.Email).
		Int("item_count", len(req.Items)).
		Msg("Starting authoritative pricing calculation")
	var orderItems []models.OrderItem
	subtotalKobo := int64(0)
	for _, clientItem := range req.Items {
		// 1. Fetch live tier data using the UUID (TicketTierID)
		tierDetails, err := s.EventRepo.GetTierDetailsByID(ctx, clientItem.TicketTierID)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch pricing for tier %s: %w", clientItem.TicketTierID, err)
		}
		// 2. Validate stock availability
		if clientItem.Quantity > tierDetails.Available {
			return nil, fmt.Errorf("insufficient stock for %s: requested %d, only %d available", tierDetails.TierName, clientItem.Quantity, tierDetails.Available)
		}
		// 3. Calculate Item Subtotals
		unitPrice := int64(tierDetails.PriceKobo)
		quantity := int64(clientItem.Quantity)
		itemSubtotal := unitPrice * quantity
		if itemSubtotal < 0 {
			return nil, errors.New("price calculation overflow error")
		}
	orderItem := models.OrderItem{
			TicketTierID: tierDetails.TicketTierID,
			EventID:      tierDetails.EventID,
			EventTitle:   tierDetails.EventTitle,
			TierName:     tierDetails.TierName,
			Quantity:     clientItem.Quantity,
			UnitPrice:    unitPrice,
			Subtotal:     itemSubtotal,
		}
		orderItems = append(orderItems, orderItem)
		subtotalKobo += itemSubtotal
	}
	// 4. Authoritative Fee Calculation (Tiered Logic)
	serviceFeeKobo := models.CalculateServiceFee(subtotalKobo)
	vatKobo := models.CalculateVAT(subtotalKobo, serviceFeeKobo)
	finalTotalKobo := subtotalKobo + serviceFeeKobo + vatKobo
	// 5. Internal Financial Tracking (Paystack Cut & Platform Profit)
	paystackFeeKobo := models.CalculatePaystackFee(finalTotalKobo)
	appProfitKobo := (serviceFeeKobo + vatKobo) - paystackFeeKobo
	log.Info().
		Int64("subtotal", subtotalKobo).
		Int64("service_fee", serviceFeeKobo).
		Int64("vat", vatKobo).
		Int64("final_total", finalTotalKobo).
		Msg("Order totals calculated successfully")
	if finalTotalKobo < 0 {
		return nil, errors.New("negative total order amount calculated")
	}
	// 6. Build Final Order Object
	order := &models.Order{
		Subtotal:          subtotalKobo,
		ServiceFee:        serviceFeeKobo,
		VATAmount:         vatKobo,
		FinalTotal:        finalTotalKobo,
		PaystackFee:       paystackFeeKobo,
		AppProfit:         appProfitKobo,
		AmountPaid:        0, // Set to 0 until payment verification webhook
		Items:             orderItems,
		CustomerEmail:     req.Email,
		CustomerFirstName: req.FirstName,
		CustomerLastName:  req.LastName,
	}
	log.Info().
		Int("items", len(orderItems)).
		Int64("final_amount", order.FinalTotal).
		Msg("Authoritative order calculation complete")
	return order, nil
}