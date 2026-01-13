//frontend / src / components / homepage / CardSkeleton.js;

import React from "react";

// This component provides a stable placeholder layout while data is being fetched.
export default function CardSkeleton() {
  return (
    // The container should match the styling/dimensions of the actual ticket card
    <div className="p-4 bg-gray-800 rounded-xl shadow-lg border border-gray-700/50 animate-pulse transition duration-300">
      {/* 1. Image Placeholder */}
      <div className="w-full h-40 bg-gray-700 rounded-lg mb-4"></div>

      {/* 2. Title Placeholder */}
      <div className="h-5 bg-gray-700 rounded w-3/4 mb-2"></div>

      {/* 3. Sub-Title Placeholder */}
      <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>

      {/* 4. Details/Metadata Placeholder Group */}
      <div className="space-y-2">
        {/* Date/Time */}
        <div className="flex items-center">
          <div className="w-4 h-4 bg-gray-700 rounded-full mr-2"></div>
          <div className="h-3 bg-gray-700 rounded w-2/5"></div>
        </div>
        {/* Location */}
        <div className="flex items-center">
          <div className="w-4 h-4 bg-gray-700 rounded-full mr-2"></div>
          <div className="h-3 bg-gray-700 rounded w-3/5"></div>
        </div>
      </div>

      {/* 5. Button/Price Placeholder */}
      <div className="mt-4 flex justify-between items-center">
        <div className="h-6 bg-indigo-600/50 rounded-full w-1/3"></div>
        <div className="h-4 bg-gray-700 rounded w-1/4"></div>
      </div>
    </div>
  );
}