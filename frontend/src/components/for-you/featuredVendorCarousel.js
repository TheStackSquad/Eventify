// frontend/src/components/for-you/featuredVendorsCarousel.js

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import VendorCard from "@/components/vendorUI/components/cards/vendorCard";
import VendorCardSkeleton from "@/components/vendorUI/components/cards/vendorCardSkeleton";
import EmptyState from "./emptyState";

const FeaturedVendorsCarousel = ({ vendors, isLoading = false }) => {
  const scrollContainerRef = useRef(null);

  const scroll = (direction) => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 400;
    const newPosition =
      scrollContainerRef.current.scrollLeft +
      (direction === "left" ? -scrollAmount : scrollAmount);

    scrollContainerRef.current.scrollTo({
      left: newPosition,
      behavior: "smooth",
    });
  };

  // Helper functions for VendorCard (if not already global)
  const formatNumber = (num) => {
    if (!num) return "0";
    return num.toLocaleString();
  };

  const getRatingPercentage = (rating) => {
    if (!rating) return 0;
    return (rating / 5) * 100;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <VendorCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (!vendors || vendors.length === 0) {
    return (
      <EmptyState
        icon="sparkles"
        title="No Featured Vendors Yet"
        description="Featured vendors will appear here once they upgrade their listings. Check back soon!"
      />
    );
  }

  return (
    <div className="relative group">
      {/* Left Arrow - Hidden on mobile, visible on desktop */}
      <button
        onClick={() => scroll("left")}
        className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 items-center justify-center bg-white rounded-full shadow-xl hover:shadow-2xl transition-all opacity-0 group-hover:opacity-100 hover:scale-110 border border-gray-100"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-6 h-6 text-gray-700" />
      </button>

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-4"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {vendors.map((vendor) => (
          <div
            key={vendor.id}
            className="flex-none w-[85%] sm:w-[45%] lg:w-[calc(25%-18px)] snap-center"
          >
            <VendorCard
              vendor={vendor}
              formatNumber={formatNumber}
              getRatingPercentage={getRatingPercentage}
            />
          </div>
        ))}

        {/* Spacer to ensure last card can scroll into view */}
        <div className="flex-none w-4 lg:w-0" />
      </div>

      {/* Right Arrow - Hidden on mobile, visible on desktop */}
      <button
        onClick={() => scroll("right")}
        className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 items-center justify-center bg-white rounded-full shadow-xl hover:shadow-2xl transition-all opacity-0 group-hover:opacity-100 hover:scale-110 border border-gray-100"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-6 h-6 text-gray-700" />
      </button>

      {/* Scroll Indicator Dots - Mobile Only */}
      <div className="flex lg:hidden justify-center gap-2 mt-4">
        {vendors.slice(0, 5).map((_, index) => (
          <div key={index} className="w-2 h-2 rounded-full bg-gray-300" />
        ))}
      </div>
    </div>
  );
};

export default FeaturedVendorsCarousel;
