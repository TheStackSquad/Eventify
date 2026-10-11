//frontend/src/components/vendorUI/vendorStats.js
import React from "react";

const VendorStats = ({ count }) => {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-200">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Live Results</span>
        </div>
        <span className="text-gray-300">|</span>
        <p className="text-gray-700">
          <span className="font-bold text-indigo-600 text-lg">{count}</span>{" "}
          <span className="text-gray-600">
            {count === 1 ? "service provider" : "service providers"} found
          </span>
        </p>
      </div>

      {/* Optional: Sort/View toggle could go here */}
      <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
        <span>Sorted by relevance</span>
      </div>
    </div>
  );
};

export default VendorStats;
