// frontend/src/components/vendorUI/vendorCardSkeleton.js

"use client";

const VendorCardSkeleton = () => {
  return (
    <div className="h-full animate-pulse overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Image (same ratio as the card) */}
      <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="absolute left-3 top-3 h-6 w-20 rounded-full bg-gray-300" />
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-gray-200" />
          <div className="h-5 w-3/4 rounded bg-gray-200" />
          <div className="h-4 w-1/2 rounded bg-gray-200" />
        </div>

        {/* Score bar */}
        <div className="h-1 w-full rounded-full bg-gray-200" />

        {/* Rating + price */}
        <div className="flex min-h-[2.5rem] items-center justify-between border-t border-gray-100 pt-3">
          <div className="h-5 w-20 rounded bg-gray-200" />
          <div className="h-6 w-24 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
};

export default VendorCardSkeleton;
