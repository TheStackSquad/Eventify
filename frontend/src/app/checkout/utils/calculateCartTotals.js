// frontend/src/app/checkout/utils/calculateCartTotals.js

import {
  calculateServiceFee,
  koboToNaira,
  nairaToKobo,
} from "@/utils/currency";

export const calculateCartTotals = (cartItems) => {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return {
      subtotal: 0,
      serviceFee: 0,
      vat: 0,
      totalFees: 0,
      finalTotal: 0,
      finalTotalKobo: 0,
      itemsBreakdown: [],
      hasMixedTiers: false,
    };
  }

  let totalSubtotal = 0;
  let totalServiceFee = 0;
  let totalVAT = 0;
  const itemsBreakdown = [];
  const tiers = new Set();

  // Calculate fees for each item
  cartItems.forEach((item) => {
    const pricePerTicketNaira = koboToNaira(item.price);
    const itemQuantity = item.quantity || 1;
    const itemSubtotal = pricePerTicketNaira * itemQuantity;

    // Calculate service fee for this ticket price
    const feeCalc = calculateServiceFee(pricePerTicketNaira);

    // Multiply by quantity
    const itemServiceFee = feeCalc.serviceFee * itemQuantity;
    const itemVAT = feeCalc.vat * itemQuantity;
    const itemTotalFees = feeCalc.totalFee * itemQuantity;

    // Track tier
    tiers.add(feeCalc.tier);

    // Accumulate totals
    totalSubtotal += itemSubtotal;
    totalServiceFee += itemServiceFee;
    totalVAT += itemVAT;

    // Store breakdown for this item
    itemsBreakdown.push({
      cartId: item.cartId || item.id,
      eventTitle: item.eventTitle,
      tierName: item.tierName,
      pricePerTicket: pricePerTicketNaira,
      quantity: itemQuantity,
      subtotal: itemSubtotal,
      serviceFee: itemServiceFee,
      vat: itemVAT,
      totalFees: itemTotalFees,
      tier: feeCalc.tier,
    });
  });

  const totalFees = totalServiceFee + totalVAT;
  const finalTotal = totalSubtotal + totalFees;

  return {
    subtotal: totalSubtotal,
    serviceFee: totalServiceFee,
    vat: totalVAT,
    totalFees: totalFees,
    finalTotal: finalTotal,
    finalTotalKobo: nairaToKobo(finalTotal),
    itemsBreakdown: itemsBreakdown,
    hasMixedTiers: tiers.size > 1, // True if cart has both small and premium tickets
    itemCount: cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0),
  };
};

/**
 * Format breakdown for metadata/API submission
 */
export const formatOrderMetadata = (cartTotals, customerInfo, cartItems) => {
  return {
    customer_info: {
      firstName: customerInfo.firstName,
      lastName: customerInfo.lastName,
      email: customerInfo.email,
      phone: customerInfo.phone,
      city: customerInfo.city,
      state: customerInfo.state,
      country: customerInfo.country,
    },
    order_breakdown: {
      subtotal: cartTotals.subtotal,
      service_fee: cartTotals.serviceFee,
      vat_amount: cartTotals.vat,
      total_fees: cartTotals.totalFees,
      final_total: cartTotals.finalTotal,
      item_count: cartTotals.itemCount,
      has_mixed_tiers: cartTotals.hasMixedTiers,
    },
    items: cartTotals.itemsBreakdown.map((item, index) => ({
      event_title: item.eventTitle,
      tier_name: item.tierName,
      price_per_ticket: item.pricePerTicket,
      quantity: item.quantity,
      subtotal: item.subtotal,
      service_fee: item.serviceFee,
      vat: item.vat,
      tier: item.tier,
      // Include original cart item data
      ...cartItems[index],
    })),
  };
};
