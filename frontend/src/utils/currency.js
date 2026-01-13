// frontend/src/utils/currency.js
const VAT_RATE = 0.075;
const SERVICE_FEE = 500;

const TIER_ONE_CAP = 2500;
const TIER_TWO_CAP = 10000;
const TIER_THREE_CAP = 50000;

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

// ========== EXISTING FUNCTIONS (Keep as is) ==========

export const calculateServiceFee = (subtotal) => {
  if (subtotal <= TIER_ONE_CAP) {
    return 200;
  } else if (subtotal <= TIER_TWO_CAP) {
    return Math.round(subtotal * 0.08);
  } else if (subtotal <= TIER_THREE_CAP) {
    return Math.round(subtotal * 0.06);
  } else {
    return Math.round(subtotal * 0.04);
  }
};

export const calculateVAT = (amount) => {
  return Math.round(amount * VAT_RATE);
};

export const calculateOrderTotals = (subtotal) => {
  const subtotalNaira = Number(subtotal);

  const serviceFee = calculateServiceFee(subtotalNaira);
  const taxableAmount = subtotalNaira + serviceFee;
  const vatAmount = calculateVAT(taxableAmount);
  const finalTotalNaira = subtotalNaira + serviceFee + vatAmount;

  return {
    subtotal: subtotalNaira,
    serviceFee,
    vatAmount,
    finalTotal: finalTotalNaira,
    amountInKobo: nairaToKobo(finalTotalNaira),
  };
};

export const getFeeTier = (subtotal) => {
  if (subtotal <= TIER_ONE_CAP) {
    return "Flat ₦200 fee";
  } else if (subtotal <= TIER_TWO_CAP) {
    return "8% service fee";
  } else if (subtotal <= TIER_THREE_CAP) {
    return "6% service fee";
  } else {
    return "4% service fee";
  }
};

export const formatNumber = (num) => {
  if (typeof num !== "number" || isNaN(num)) return "0";

  if (num >= 1000000) {
    //return (num / 1000000).toFixed(1) + "M";
    return `₦${(num / 1000000).toFixed(1)}M+`;
  } else if (num >= 1000) {
    //return (num / 1000).toFixed(1) + "K";
    return `₦${(num / 1000).toFixed(0)}k+`;
  }
  return num.toLocaleString();
};

// Export constants
export { VAT_RATE, SERVICE_FEE };
