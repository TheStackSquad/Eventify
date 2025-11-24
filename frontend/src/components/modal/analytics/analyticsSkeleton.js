// frontend/src/components/modal/analytics/AnalyticsSkeleton.js

import React from "react";

export default function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Key Metrics Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-200 rounded-xl h-32 flex flex-col justify-between p-5"
          >
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 bg-gray-300 rounded-xl" />
              <div className="w-16 h-4 bg-gray-300 rounded" />
            </div>
            <div className="space-y-2">
              <div className="w-20 h-3 bg-gray-300 rounded" />
              <div className="w-32 h-8 bg-gray-300 rounded" />
              <div className="w-24 h-3 bg-gray-300 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Sections Skeleton */}
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden"
        >
          {/* Section Header */}
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-gray-300 rounded" />
              <div className="w-40 h-5 bg-gray-300 rounded" />
            </div>
            <div className="w-5 h-5 bg-gray-300 rounded" />
          </div>
        </div>
      ))}

      {/* Loading Text */}
      <div className="text-center py-8">
        <div className="inline-block w-6 h-6 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin mb-3" />
        <p className="text-gray-600 font-medium">Loading analytics data...</p>
      </div>
    </div>
  );
}
