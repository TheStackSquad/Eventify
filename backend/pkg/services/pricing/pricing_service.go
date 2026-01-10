// backend/pkg/services/pricing/pricing_service.

package pricing

import (
	"context"
	"fmt"
	"errors"
	"eventify/backend/pkg/models"
	repoevent "eventify/backend/pkg/repository/event"
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
		tierDetails, err := s.EventRepo.GetTierDetails(ctx, clientItem.EventID, clientItem.TierName)
		if err != nil {
			log.Error().
				Err(err).
				Str("event_id", clientItem.EventID.String()).
				Str("tier_name", clientItem.TierName).
				Msg("Failed to fetch tier details")
			return nil, fmt.Errorf("failed to fetch pricing for event %s tier %s: %w",
				clientItem.EventID.String(), clientItem.TierName, err)
		}
		if clientItem.Quantity > tierDetails.Available {
			log.Warn().
				Str("event_id", clientItem.EventID.String()).
				Str("tier_name", clientItem.TierName).
				Int32("requested", clientItem.Quantity).
				Int32("available", tierDetails.Available).
				Msg("Insufficient stock")
			return nil, fmt.Errorf(
				"insufficient stock for %s - %s: requested %d, only %d available",
				tierDetails.EventTitle,
				tierDetails.TierName,
				clientItem.Quantity,
				tierDetails.Available,
			)
		}
		unitPrice := int64(tierDetails.PriceKobo)
		quantity := int64(clientItem.Quantity)
		itemSubtotal := unitPrice * quantity
		if itemSubtotal < 0 {
			return nil, errors.New("price calculation overflow error")
		}
		log.Info().
			Str("event_title", tierDetails.EventTitle).
			Str("tier_name", tierDetails.TierName).
			Int64("unit_price_kobo", unitPrice).
			Int64("quantity", quantity).
			Int64("item_subtotal_kobo", itemSubtotal).
			Int32("stock_available", tierDetails.Available).
			Msg("Item priced and validated")
		orderItem := models.OrderItem{
			TicketTierID: tierDetails.TicketTierID,
			EventID:      clientItem.EventID,
			TierName:     clientItem.TierName,
			Quantity:     clientItem.Quantity,
			UnitPrice:    unitPrice,
			Subtotal:     itemSubtotal,
		}
		orderItems = append(orderItems, orderItem)
		subtotalKobo += itemSubtotal
	}
	serviceFeeKobo := models.CalculateServiceFee(subtotalKobo)
	vatKobo := models.CalculateVAT(serviceFeeKobo)
	finalTotalKobo := subtotalKobo + serviceFeeKobo + vatKobo
	log.Info().
		Int64("subtotal_kobo", subtotalKobo).
		Int64("service_fee_kobo", serviceFeeKobo).
		Int64("vat_kobo", vatKobo).
		Int64("final_total_kobo", finalTotalKobo).
		Msg("Order totals calculated")
	if finalTotalKobo < 0 {
		return nil, errors.New("negative total order amount calculated")
	}
	order := &models.Order{
		Subtotal:         subtotalKobo,
		ServiceFee:       serviceFeeKobo,
		VATAmount:        vatKobo,
		FinalTotal:       finalTotalKobo,
		AmountPaid:       0,
		Items:            orderItems,
		CustomerEmail:    req.Email,
		CustomerFirstName: req.FirstName,
		CustomerLastName:  req.LastName,
	}
	log.Info().
		Int("total_items", len(orderItems)).
		Int64("amount_kobo", order.FinalTotal).
		Msg("Authoritative order calculation complete")
	return order, nil
}