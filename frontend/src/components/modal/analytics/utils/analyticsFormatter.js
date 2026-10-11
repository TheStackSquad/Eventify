// frontend/src/components/modal/analytics/utils/analyticsFormatters.js

/**
 * Convert kobo to Naira and format as currency
 */
export const formatCurrency = (kobo) => {
  if (kobo == null) return "₦0";
  const naira = kobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(naira);
};

/**
 * Format percentage with optional decimal places
 */
export const formatPercentage = (value, decimals = 1) => {
  if (value == null) return "0%";
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format days until event with context
 */
export const formatDaysUntil = (days) => {
  if (days == null) return "Unknown";
  if (days < 0) return `Ended ${Math.abs(days)} days ago`;
  if (days === 0) return "Event is TODAY! 🎉";
  if (days === 1) return "Tomorrow! 🚀";
  if (days <= 7) return `${days} days away`;
  if (days <= 30) return `${Math.ceil(days / 7)} weeks away`;
  return `${Math.ceil(days / 30)} months away`;
};

/**
 * Format large numbers with suffixes (1.2K, 1.5M)
 */
export const formatCompactNumber = (num) => {
  if (num == null) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};
