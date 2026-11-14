// frontend/src/app/checkout/utils/calculateCartTotals.js

import { calculateServiceFee } from "@/utils/currency";

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
      itemCount: 0,
    };
  }

 let totalSubtotal = 0;
 let totalServiceFee = 0;
 let totalVAT = 0;
 let hasCalculationError = false;
 let calculationError = null;
 const itemsBreakdown = [];
 const tiers = new Set();

 cartItems.forEach((item) => {
   const rawPrice = item?.price;
   const pricePerTicket =
     rawPrice === null || rawPrice === undefined || rawPrice === ""
       ? NaN
       : Number(rawPrice);

   if (!Number.isFinite(pricePerTicket) || pricePerTicket < 0) {
     hasCalculationError = true;
     calculationError =
       "One or more tickets in your cart have an invalid price. Please review your cart before paying.";
     return;
   }
const itemQuantity = item.quantity != null ? item.quantity : 1;
const itemSubtotal = pricePerTicket * itemQuantity;

const feeCalc = calculateServiceFee(pricePerTicket);
const itemServiceFee = feeCalc.serviceFee * itemQuantity;
const itemVAT = feeCalc.vat * itemQuantity;

tiers.add(feeCalc.tier);

totalSubtotal += itemSubtotal;
totalServiceFee += itemServiceFee;
totalVAT += itemVAT;

  itemsBreakdown.push({
    cartId: item.cartId || item.id,
    eventTitle: item.eventTitle,
    tierName: item.tierName,
    pricePerTicket: pricePerTicket,
    quantity: itemQuantity,
    subtotal: itemSubtotal,
    serviceFee: itemServiceFee,
    vat: itemVAT,
    totalFees: itemServiceFee + itemVAT,
    tier: feeCalc.tier,
  });
 });

  const totalFees = totalServiceFee + totalVAT;
  const finalTotal = totalSubtotal + totalFees;
  const finalTotalKobo = Math.round(finalTotal * 100);

 return {
   subtotal: totalSubtotal,
   serviceFee: totalServiceFee,
   vat: totalVAT,
   totalFees: totalFees,
   finalTotal: finalTotal,
   finalTotalKobo: finalTotalKobo,
   itemsBreakdown: itemsBreakdown,
   hasMixedTiers: tiers.size > 1,
   hasCalculationError,
   calculationError,
   itemCount: cartItems.reduce(
     (sum, item) => sum + (item.quantity != null ? item.quantity : 1),
     0,
   ),
 };
};

export const formatOrderMetadata = (cartTotals, customerInfo, cartItems) => {
  // ✅ FIX: Build a cartId → cartItem lookup instead of relying on array index.
  // The previous version used cartItems[index] which broke silently if cartItems
  // was passed in a different order than the one used for calculateCartTotals.
  const cartItemById = Object.fromEntries(
    cartItems.map((item) => [item.cartId || item.id, item]),
  );

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
    items: cartTotals.itemsBreakdown.map((item) => {
      // ✅ FIX: Match by cartId — order-independent and explicit.
      const cartItem = cartItemById[item.cartId] || {};
      return {
        event_title: item.eventTitle,
        tier_name: item.tierName,
        price_per_ticket: item.pricePerTicket,
        quantity: item.quantity,
        subtotal: item.subtotal,
        service_fee: item.serviceFee,
        vat: item.vat,
        tier: item.tier,
        ...cartItem,
      };
    }),
  };
};
