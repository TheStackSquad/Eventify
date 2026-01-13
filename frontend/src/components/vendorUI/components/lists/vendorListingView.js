// frontend/src/components/vendorUI/vendorListingView.js
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Building2, Loader2 } from "lucide-react";

// Import split components
import VendorCard from "@/components/vendorUI/components/cards/vendorCard";
import SearchWithSuggestions from "@/components/vendorUI/components/search/searchWithSuggestion";
import LoadingState from "@/components/vendorUI/components/states/loadingState";
import ErrorState from "@/components/vendorUI/components/states/errorState";
import EmptyState from "@/components/vendorUI/components/states/emptyState";
import { formatNumber } from "@/utils/currency";

const VendorListingView = ({
  vendors,
  isLoading,
  isError,
  filters = {},
  onRegisterClick,
  onFilterChange,
  onSearch,
  onVendorClick,
  onLoadMore, // NEW: Pagination handler
  pagination = {
    // NEW: Pagination info
    currentPage: 1,
    hasMore: false,
    totalCount: 0,
  },
}) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(filters.search || "");
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const vendorCount = vendors.length;
  const { currentPage, hasMore, totalCount } = pagination;

  // // Format price in Naira
  // const formatPrice = (price) => {
  //   if (!price || price === 0) return "Contact for price";

  //   if (price >= 1000000) {
  //     return `₦${(price / 1000000).toFixed(1)}M+`;
  //   } else if (price >= 1000) {
  //     return `₦${(price / 1000).toFixed(0)}k+`;
  //   }
  //   return `₦${price}+`;
  // };

  // Calculate rating percentage (assuming pvsScore is out of 100)
  const getRatingPercentage = (pvsScore) => {
    return Math.min(100, Math.max(0, pvsScore));
  };

  // Handle search submission
  const handleSearchSubmit = (term) => {
    onSearch?.(term);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion.label);
    onSearch?.(suggestion.value);
  };

  // Handle vendor card click
  const handleVendorClick = (vendor) => {
    if (onVendorClick) {
      onVendorClick(vendor);
    }
  };

  // Handle load more with loading state
  const handleLoadMoreClick = async () => {
    if (onLoadMore && !isLoadingMore) {
      setIsLoadingMore(true);
      try {
        await onLoadMore();
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  // Handle retry
  const handleRetry = () => {
    window.location.reload();
  };

  // Render Loading State
  if (isLoading && vendorCount === 0) {
    return <LoadingState />;
  }

  // Render Error State
  if (isError) {
    return <ErrorState onRetry={handleRetry} />;
  }

  // Render No Results State
  const hasVendors = vendorCount > 0;
  if (!hasVendors) {
    return <EmptyState onRegisterClick={onRegisterClick} />;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Search and Filter Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 p-6 bg-white rounded-2xl shadow-lg border border-gray-100">
          {/* Enhanced Search with Suggestions */}
          <SearchWithSuggestions
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSearchSubmit={handleSearchSubmit}
            onSuggestionClick={handleSuggestionClick}
            vendors={vendors}
          />

          {/* Filters and CTA */}
          <div className="flex items-center space-x-4 w-full md:w-auto justify-end">
            {/* Filter Button */}
            <button
              onClick={() => {
                /* Placeholder for filter logic */
              }}
              className="flex items-center space-x-2 px-5 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl shadow-sm hover:bg-gray-50 transition duration-150 hover:shadow-md hover:border-indigo-200"
              aria-label="Open filter options"
            >
              <SlidersHorizontal className="w-5 h-5" />
              <span className="hidden sm:inline">Filters</span>
            </button>

            {/* Registration CTA */}
            <button
              onClick={onRegisterClick}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition duration-150 transform hover:scale-[1.02] active:scale-[0.98] hover:from-indigo-700 hover:to-purple-700 flex items-center space-x-2"
            >
              <Building2 className="w-4 h-4" />
              <span>Register Business</span>
            </button>
          </div>
        </div>

        {/* Results Count and Grid */}
        <div className="pt-4 space-y-6">
          {/* Results Count - Enhanced with pagination info */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col space-y-2">
              <p className="text-xl font-medium text-gray-800">
                Showing{" "}
                <span className="font-bold text-indigo-600">{vendorCount}</span>{" "}
                {vendorCount === 1 ? "vendor" : "vendors"}
                {totalCount > vendorCount && (
                  <span className="text-gray-600">
                    {" "}
                    of <span className="font-semibold">{totalCount}</span> total
                  </span>
                )}
                {searchTerm && (
                  <span className="text-gray-600">
                    {" "}
                    for &quot;
                    <span className="font-semibold">{searchTerm}</span>&quot;
                  </span>
                )}
              </p>
              {currentPage > 1 && (
                <p className="text-sm text-gray-500">
                  Page {currentPage} •{" "}
                  {hasMore ? "Scroll to load more" : "All vendors loaded"}
                </p>
              )}
            </div>
          </div>

          {/* Vendor Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {vendors.map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                formatNumber={formatNumber}
                getRatingPercentage={getRatingPercentage}
                onVendorClick={handleVendorClick}
              />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-8">
              <button
                onClick={handleLoadMoreClick}
                disabled={isLoadingMore}
                className="px-8 py-3 bg-white text-indigo-600 border border-indigo-300 rounded-xl shadow-md hover:shadow-lg transition duration-150 hover:bg-indigo-50 hover:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-semibold"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading More...</span>
                  </>
                ) : (
                  <span>Load More Vendors</span>
                )}
              </button>
            </div>
          )}

          {/* End of Results Message */}
          {!hasMore && vendorCount > 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">
                🎉 You&apos;ve seen all {totalCount} vendors!
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Can&apos;t find what you&apos;re looking for? Try adjusting your
                search filters.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default VendorListingView;
