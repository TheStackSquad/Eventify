// frontend/src/components/vendorUI/vendorCardSkeleton.js
"use client";

const VendorCardSkeleton = () => {
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-md border border-gray-100 overflow-hidden animate-pulse">
      {/* Image Skeleton */}
      <div className="h-44 sm:h-48 md:h-52 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 relative">
        {/* Shimmer effect */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Badge placeholders */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 w-16 h-6 bg-gray-300 rounded-full" />
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 w-16 h-6 bg-gray-300 rounded-full" />
        <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 w-20 h-6 bg-gray-300 rounded-lg" />
      </div>

      {/* Content Skeleton */}
      <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
        {/* Title */}
        <div className="h-5 sm:h-6 bg-gray-200 rounded w-3/4" />

        {/* Location */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 rounded" />
          <div className="h-4 bg-gray-200 rounded flex-1" />
        </div>

        {/* Rating Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-14 bg-gray-200 rounded-lg" />
            <div className="h-4 w-12 bg-gray-200 rounded" />
          </div>
          <div className="h-7 w-16 bg-gray-200 rounded-lg" />
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 sm:h-2 bg-gray-200 rounded-full" />

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-gray-100">
          <div className="h-6 w-20 bg-gray-200 rounded" />
          <div className="h-6 w-16 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
};

export default VendorCardSkeleton;
