// frontend/src/components/modal/analytics/utils/analyticsHelpers.js

/**
 * Get color class based on percentage performance
 */
export const getColorByPercentage = (percentage) => {
  if (percentage >= 70) return "bg-green-500";
  if (percentage >= 40) return "bg-yellow-500";
  return "bg-red-500";
};

/**
 * Get status badge component
 */
export const getStatusBadge = (status) => {
  const configs = {
    upcoming: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      label: "UPCOMING",
    },
    ongoing: {
      bg: "bg-green-100 animate-pulse",
      text: "text-green-700",
      label: "LIVE",
    },
    ended: {
      bg: "bg-gray-100",
      text: "text-gray-700",
      label: "ENDED",
    },
  };

  const config = configs[status] || configs.upcoming;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
};

/**
 * Get popularity badge for tiers
 */
export const getPopularityBadge = (popularity) => {
  const configs = {
    high: { bg: "bg-green-500", label: "High Demand" },
    medium: { bg: "bg-yellow-500", label: "Medium" },
    low: { bg: "bg-gray-400", label: "Low" },
  };

  const config = configs[popularity] || configs.low;

  return (
    <span
      className={`${config.bg} text-white text-xs font-bold px-2 py-1 rounded-full`}
    >
      {config.label}
    </span>
  );
};
