// frontend/src/components/for-you/categorySpotlight.jsx

"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import Link from "next/link";
import VendorCard from "@/components/vendorUI/components/cards/vendorCard";
import EmptyState from "./emptyState";

const CategorySpotlight = ({ categoryName, vendors }) => {
  const scrollContainerRef = useRef(null);

  const scroll = (direction) => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 350;
    const newPosition =
      scrollContainerRef.current.scrollLeft +
      (direction === "left" ? -scrollAmount : scrollAmount);

    scrollContainerRef.current.scrollTo({
      left: newPosition,
      behavior: "smooth",
    });
  };

  // Helper functions for VendorCard
  const formatNumber = (num) => {
    if (!num) return "0";
    return num.toLocaleString();
  };

  const getRatingPercentage = (rating) => {
    if (!rating) return 0;
    return (rating / 5) * 100;
  };

  // Empty state (though parent page.js already filters out empty categories)
  if (!vendors || vendors.length === 0) {
    return (
      <EmptyState
        icon="folder"
        title={`No ${categoryName} Vendors Yet`}
        description={`${categoryName} vendors will appear here soon. Check back later!`}
      />
    );
  }

  return (
    <div>
      {/* Desktop: Grid Layout */}
      <div className="hidden lg:grid grid-cols-4 gap-6">
        {vendors.slice(0, 8).map((vendor) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            formatNumber={formatNumber}
            getRatingPercentage={getRatingPercentage}
          />
        ))}
      </div>

      {/* Mobile/Tablet: Horizontal Scroll */}
      <div className="lg:hidden relative group">
        {/* Left Arrow */}
        <button
          onClick={() => scroll("left")}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-10 h-10 items-center justify-center bg-white rounded-full shadow-lg hover:shadow-xl transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {vendors.map((vendor) => (
            <div
              key={vendor.id}
              className="flex-none w-[85%] sm:w-[45%] snap-center"
            >
              <VendorCard
                vendor={vendor}
                formatNumber={formatNumber}
                getRatingPercentage={getRatingPercentage}
              />
            </div>
          ))}

          {/* Spacer */}
          <div className="flex-none w-4" />
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll("right")}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-10 h-10 items-center justify-center bg-white rounded-full shadow-lg hover:shadow-xl transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      {/* View All Link */}
      {vendors.length >= 8 && (
        <div className="mt-6 text-center">
          <Link
            href={`/vendor?category=${categoryName.toLowerCase()}`}
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold text-sm transition-colors group"
          >
            View All {categoryName} Vendors
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      )}
    </div>
  );
};

export default CategorySpotlight;
