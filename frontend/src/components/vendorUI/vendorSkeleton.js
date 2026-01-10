// frontend/src/components/vendorUI/vendorSkeleton.js
"use client";

import React from "react";

const VendorSkeleton = () => {
  const ShimmerBase =
    "relative overflow-hidden bg-gray-200 before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent";

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
      {/* Hero Image Skeleton */}
      <div className={`h-64 md:h-80 w-full ${ShimmerBase}`} />

      <div className="p-6 md:p-10">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
          <div className="w-full space-y-3">
            {/* Category Tag Skeleton */}
            <div className={`h-6 w-24 rounded-full ${ShimmerBase}`} />
            {/* Name Skeleton */}
            <div className={`h-12 w-3/4 rounded-xl ${ShimmerBase}`} />
            {/* Location Skeleton */}
            <div className={`h-5 w-1/3 rounded-lg ${ShimmerBase}`} />
          </div>
          {/* Rating Box Skeleton */}
          <div
            className={`h-20 w-32 rounded-2xl hidden md:block ${ShimmerBase}`}
          />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-24 rounded-2xl border border-gray-50 ${ShimmerBase}`}
            />
          ))}
        </div>

        {/* Description Skeleton */}
        <div className="space-y-3">
          <div className={`h-8 w-40 rounded-lg ${ShimmerBase}`} />
          <div className={`h-4 w-full rounded ${ShimmerBase}`} />
          <div className={`h-4 w-full rounded ${ShimmerBase}`} />
          <div className={`h-4 w-2/3 rounded ${ShimmerBase}`} />
        </div>
      </div>
    </div>
  );
};

export default VendorSkeleton;
