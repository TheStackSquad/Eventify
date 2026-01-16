// frontend/src/utils/currency.js

// ========== CONSTANTS ==========
const VAT_RATE = 0.075; // 7.5% VAT on service fees only
const PAYSTACK_PERCENTAGE = 0.015; // 1.5%
const PAYSTACK_FLAT_FEE = 100; // ₦100

// Fee tiers based on ticket price
const TIER_THRESHOLD = 5000; // ₦5,000 threshold

// Small ticket fees (≤ ₦5,000): 10% flat (VAT included)
const SMALL_TICKET_RATE = 0.1;

// Premium ticket fees (> ₦5,000): 7% + ₦50 + VAT
const PREMIUM_TICKET_RATE = 0.07;
const PREMIUM_TICKET_FLAT = 50;

// ========== CORE CONVERSION FUNCTIONS ==========
export const koboToNaira = (kobo) => {
  const koboNum = Number(kobo);
  if (isNaN(koboNum)) {
    console.warn(`[currency] Invalid kobo value: ${kobo}`);
    return 0;
  }
  return koboNum / 100;
};

export const nairaToKobo = (naira) => {
  const nairaNum = Number(naira);
  if (isNaN(nairaNum)) {
    console.warn(`[currency] Invalid naira value: ${naira}`);
    return 0;
  }
  return Math.round(nairaNum * 100);
};

// ========== SERVICE FEE CALCULATION ==========
/**
 * Calculate service fee based on ticket price
 * Small tickets (≤₦5,000): 10% flat (VAT included)
 * Premium tickets (>₦5,000): 7% + ₦50 + VAT on fee
 *
 * @param {number} ticketPriceNaira - Ticket price in Naira
 * @returns {object} - { serviceFee, vat, totalFee }
 */
export const calculateServiceFee = (ticketPriceNaira) => {
  const price = Number(ticketPriceNaira);

  if (isNaN(price) || price <= 0) {
    return { serviceFee: 0, vat: 0, totalFee: 0 };
  }

  if (price <= TIER_THRESHOLD) {
    // Small tickets: 10% flat (VAT already included)
    const totalFee = Math.round(price * SMALL_TICKET_RATE);
    return {
      serviceFee: totalFee,
      vat: 0, // VAT included in the 10%
      totalFee: totalFee,
      tier: "small",
    };
  } else {
    // Premium tickets: 7% + ₦50, then add VAT on the service fee
    const serviceFee =
      Math.round(price * PREMIUM_TICKET_RATE) + PREMIUM_TICKET_FLAT;
    const vat = Math.round(serviceFee * VAT_RATE);
    const totalFee = serviceFee + vat;

    return {
      serviceFee: serviceFee,
      vat: vat,
      totalFee: totalFee,
      tier: "premium",
    };
  }
};

/**
 * Calculate Paystack processing fees
 * 1.5% + ₦100 on total amount charged
 */
export const calculatePaystackFee = (totalAmountNaira) => {
  const amount = Number(totalAmountNaira);
  if (isNaN(amount) || amount <= 0) return 0;

  return Math.round(amount * PAYSTACK_PERCENTAGE + PAYSTACK_FLAT_FEE);
};

/**
 * Calculate complete order breakdown
 * @param {number} ticketPriceNaira - Base ticket price in Naira
 * @param {number} quantity - Number of tickets (default 1)
 * @returns {object} Complete pricing breakdown
 */
export const calculateOrderTotals = (ticketPriceNaira, quantity = 1) => {
  const price = Number(ticketPriceNaira);
  const qty = Number(quantity);

  if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) {
    return {
      ticketPrice: 0,
      quantity: 0,
      subtotal: 0,
      serviceFee: 0,
      vat: 0,
      totalFees: 0,
      finalTotal: 0,
      paystackFee: 0,
      appProfit: 0,
      tier: "unknown",
    };
  }

  // Calculate per-ticket fees
  const feeBreakdown = calculateServiceFee(price);

  // Calculate totals
  const subtotal = price * qty;
  const totalServiceFees = feeBreakdown.serviceFee * qty;
  const totalVAT = feeBreakdown.vat * qty;
  const totalFees = feeBreakdown.totalFee * qty;
  const finalTotal = subtotal + totalFees;

  // Calculate Paystack fee (on final total)
  const paystackFee = calculatePaystackFee(finalTotal);

  // App profit = total fees collected - Paystack fees
  const appProfit = totalFees - paystackFee;

  return {
    ticketPrice: price,
    quantity: qty,
    subtotal: subtotal,
    serviceFee: totalServiceFees,
    vat: totalVAT,
    totalFees: totalFees,
    finalTotal: finalTotal,
    paystackFee: paystackFee,
    appProfit: appProfit,
    tier: feeBreakdown.tier,
    // In kobo for API
    subtotalKobo: nairaToKobo(subtotal),
    finalTotalKobo: nairaToKobo(finalTotal),
  };
};

// ========== FORMATTING FUNCTIONS ==========
export const formatPrice = (priceInKobo) => {
  // Handle edge cases
  if (priceInKobo === 0) return "FREE";
  if (priceInKobo === null || priceInKobo === undefined) return "Price TBD";

  const koboNum = Number(priceInKobo);
  if (isNaN(koboNum) || koboNum < 0) return "Price TBD";

  // Convert to naira
  const naira = koboToNaira(koboNum);

  // Format based on value
  if (naira >= 1000000) {
    // For millions: ₦1.5M
    return `₦${(naira / 1000000).toFixed(1)}M`;
  } else if (naira >= 1000) {
    // For thousands: ₦35K
    return `₦${(naira / 1000).toFixed(1)}K`;
  } else if (naira === Math.floor(naira)) {
    // Whole numbers without .00
    return `₦${naira.toLocaleString()}`;
  } else {
    // Numbers with decimals
    return `₦${naira.toFixed(2)}`;
  }
};

export const formatPriceDetailed = (priceInKobo) => {
  if (priceInKobo === 0) return "FREE";
  if (priceInKobo === null || priceInKobo === undefined) return "Price TBD";

  const koboNum = Number(priceInKobo);
  if (isNaN(koboNum) || koboNum < 0) return "Price TBD";

  const naira = koboToNaira(koboNum);
  return `₦${naira.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatCurrency = (amount) => {
  const amountNum = Number(amount);
  if (isNaN(amountNum)) {
    console.warn(`[currency] Invalid amount: ${amount}`);
    return "₦0";
  }

  // Check if amount looks like kobo (large numbers typical for ticket prices)
  const isLikelyKobo = amountNum > 1000 && amountNum % 100 === 0;
  const nairaValue = isLikelyKobo ? koboToNaira(amountNum) : amountNum;

  return nairaValue.toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatNumber = (num) => {
  if (typeof num !== "number" || isNaN(num)) return "0";
  if (num >= 1000000) {
    return `₦${(num / 1000000).toFixed(1)}M+`;
  } else if (num >= 1000) {
    return `₦${(num / 1000).toFixed(0)}k+`;
  }
  return num.toLocaleString();
};

// ========== HELPER FUNCTIONS ==========
/**
 * Get naira value from kobo
 */
export const getNairaValue = (kobo) => {
  return koboToNaira(kobo);
};

/**
 * Get display-friendly price range from ticket array
 */
export const getPriceRange = (tickets) => {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return { min: null, max: null, formatted: "Price TBD" };
  }

  const pricesInNaira = tickets
    .filter((t) => t && typeof t.price_kobo === "number")
    .map((t) => koboToNaira(t.price_kobo));

  if (pricesInNaira.length === 0) {
    return { min: null, max: null, formatted: "Price TBD" };
  }

  const min = Math.min(...pricesInNaira);
  const max = Math.max(...pricesInNaira);

  let formatted;
  if (min === 0 && max === 0) {
    formatted = "FREE";
  } else if (min === max) {
    formatted = formatPrice(min * 100); // Convert back to kobo for formatPrice
  } else {
    formatted = `${formatPrice(min * 100)} - ${formatPrice(max * 100)}`;
  }

  return { min, max, formatted };
};

/**
 * Get fee tier information for display
 */
export const getFeeTier = (ticketPriceNaira) => {
  const price = Number(ticketPriceNaira);

  if (isNaN(price) || price <= 0) {
    return "Invalid price";
  }

  if (price <= TIER_THRESHOLD) {
    return "10% service fee (includes VAT)";
  } else {
    return "7% + ₦50 service fee + VAT";
  }
};

/**
 * Calculate VAT amount (for premium tickets only)
 * Small tickets have VAT included in the 10%
 */
export const calculateVAT = (serviceFeeAmount) => {
  return Math.round(serviceFeeAmount * VAT_RATE);
};

// ========== EXPORT CONSTANTS ==========
export {
  VAT_RATE,
  PAYSTACK_PERCENTAGE,
  PAYSTACK_FLAT_FEE,
  TIER_THRESHOLD,
  SMALL_TICKET_RATE,
  PREMIUM_TICKET_RATE,
  PREMIUM_TICKET_FLAT,
};
