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
// export const koboToNaira = (kobo) => {
//   const koboNum = Number(kobo);
//   if (isNaN(koboNum)) {
//     console.warn(`[currency] Invalid kobo value: ${kobo}`);
//     return 0;
//   }
//   return koboNum / 100;
// };

export const nairaToKobo = (naira) => {
  const nairaNum = Number(naira);
  if (isNaN(nairaNum)) {
    console.warn(`[currency] Invalid naira value: ${naira}`);
    return 0;
  }
  return Math.round(nairaNum * 100);
};

// ========== SERVICE FEE CALCULATION ==========
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

export const calculatePaystackFee = (totalAmountNaira) => {
  const amount = Number(totalAmountNaira);
  if (isNaN(amount) || amount <= 0) return 0;

  return Math.round(amount * PAYSTACK_PERCENTAGE + PAYSTACK_FLAT_FEE);
};

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

/**
 * Format price with full currency symbol and decimals
 * Use for detailed displays where exact amount matters
 */

/* ---------- internals ---------- */

const UNITS = [
  { size: 1e9, suffix: "B" },
  { size: 1e6, suffix: "M" },
  { size: 1e3, suffix: "K" },
];

// Returns a finite, non-negative number or null
const toValidAmount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// 1500 -> "1.5K", 200000 -> "200K", 999950 -> "1M", 1000000 -> "1M"
const compactValue = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  for (let i = 0; i < UNITS.length; i++) {
    const { size, suffix } = UNITS[i];
    if (abs >= size) {
      const scaled = Math.round((abs / size) * 10) / 10; // 1 decimal max
      // Rounding pushed us to 1000 of this unit -> promote (999.95K -> 1M)
      if (scaled >= 1000 && i > 0) return `${sign}1${UNITS[i - 1].suffix}`;
      return `${sign}${scaled}${suffix}`; // Number -> string drops trailing ".0"
    }
  }
  return n.toLocaleString("en-NG", { maximumFractionDigits: 2 });
};

const formatNairaFixed = (naira) => {
  try {
    return `₦${naira.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } catch {
    return `₦${naira.toFixed(2)}`;
  }
};

/* ---------- public API ---------- */

/** kobo -> naira (number) */
export const koboToNaira = (kobo) => Number(kobo) / 100;

/**
 * Kobo in, full naira out.
 * 15000 -> "₦150.00" | 150000 -> "₦1,500.00" | 4500000 -> "₦45,000.00"
 * 45000000 -> "₦450,000.00"
 */
export const formatPriceDetailed = (priceInKobo) => {
  const kobo = toValidAmount(priceInKobo);
  if (kobo === null) return "Price TBD";
  if (kobo === 0) return "FREE";
  return formatNairaFixed(koboToNaira(kobo));
};

/**
 * Kobo in, compact naira out (for cards).
 * 100000 -> "₦1K" | 20000000 -> "₦200K" | 95000000 -> "₦950K" | 100000000 -> "₦1M"
 * Returns null when there is no usable price, so the caller can render a placeholder.
 */
export const formatPriceCompact = (priceInKobo) => {
  const kobo = toValidAmount(priceInKobo);
  if (kobo === null || kobo === 0) return null;
  return `₦${compactValue(koboToNaira(kobo))}`;
};

/**
 * Naira in (NO guessing), full decimals.
 * 1500 -> "₦1,500.00"
 */
export const formatCurrency = (amountInNaira) => {
  const n = toValidAmount(amountInNaira);
  if (n === null) {
    console.warn(`[currency] Invalid amount: ${amountInNaira}`);
    return "₦0.00";
  }
  return formatNairaFixed(n);
};

/**
 * Plain counts (NO currency symbol): tickets, attendees, events.
 * 0 -> "0" | 1500 -> "1.5K" | 999999 -> "1M"
 */
export const formatNumber = (num) => {
  const n = Number(num);
  if (!Number.isFinite(n) || n === 0) return "0";
  return compactValue(n);
};
/**
 * Format price with K/M suffix and currency symbol
 * Use for: ticket revenue, sales figures, monetary amounts
 * Input should be in KOBO
 */
export const formatPrice = (priceInKobo) => {
  if (priceInKobo === 0) return "FREE";
  if (!priceInKobo) return "₦0";

  const naira = koboToNaira(priceInKobo);

  if (naira >= 1000000) {
    return `₦${(naira / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  } else if (naira >= 1000) {
    return `₦${(naira / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `₦${naira.toLocaleString()}`;
};

// ========== HELPER FUNCTIONS ==========

export const getNairaValue = (kobo) => {
  return koboToNaira(kobo);
};

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
