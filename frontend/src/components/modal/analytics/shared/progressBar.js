// frontend/src/components/modal/analytics/shared/progressBar.js

import React from "react";
import { getColorByPercentage } from "../utils/analyticsHelpers";

export default function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  size = "md",
}) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const color = getColorByPercentage(percentage);

  const heights = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm font-bold text-gray-900">
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full bg-gray-200 rounded-full overflow-hidden ${heights[size]}`}
      >
        <div
          className={`${color} ${heights[size]} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
