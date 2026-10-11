// frontend/src/components/for-you/topRatedVendorsGrid.jsx

"use client";

import VendorCard from "@/components/vendorUI/components/cards/vendorCard";
import VendorCardSkeleton from "@/components/vendorUI/components/cards/vendorCardSkeleton";
import EmptyState from "./emptyState";

const TopRatedVendorsGrid = ({ vendors, isLoading = false }) => {
  // Helper functions for VendorCard
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <VendorCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (!vendors || vendors.length === 0) {
    return (
      <EmptyState
        icon="award"
        title="No Top-Rated Vendors Yet"
        description="Top-rated vendors with excellent reviews will appear here. Be the first to leave a review!"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {vendors.map((vendor) => (
        <VendorCard
          key={vendor.id}
          vendor={vendor}
          formatNumber={formatNumber}
          getRatingPercentage={getRatingPercentage}
        />
      ))}
    </div>
  );
};

export default TopRatedVendorsGrid;
