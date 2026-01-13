// frontend/src/app/vendor/page.js

"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useVendors } from "@/utils/hooks/useVendorData";
import { VENDOR_DEFAULTS } from "@/utils/constants/globalConstants";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import VendorListingView from "@/components/vendorUI/components/lists/vendorListingView";

const INITIAL_FILTERS = VENDOR_DEFAULTS.INITIAL_STATE.filters;
const INITIAL_PAGINATION = {
  currentPage: 1,
  pageSize: 12,
};

const VendorListingPage = () => {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(INITIAL_PAGINATION.currentPage);
  const router = useRouter();

  const requestParams = {
    ...filters,
    page: page,
    limit: INITIAL_PAGINATION.pageSize,
  };

  const { data, isLoading, isFetching, isError, error } =
    useVendors(requestParams);

  const vendors = data?.vendors || [];
  const totalCount = data?.pagination?.totalCount || 0;
  const hasData = vendors.length > 0;
  const hasMoreVendors = page * INITIAL_PAGINATION.pageSize < totalCount;

  const handleFilterChange = (newFilters) => {
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  };

  const handleSearch = (searchTerm) => {
    handleFilterChange({ search: searchTerm });
  };

  const handleLoadMore = () => {
    if (hasMoreVendors && !isFetching) {
      setPage((prevPage) => prevPage + 1);
    }
  };

  const handleRetry = () => {
    setPage(1);
    setFilters(INITIAL_FILTERS);
  };

  const handleRegisterClick = () => {
    console.log("📝 Register vendor clicked");
    // Redirect to dashboard
    router.push("/dashboard");
  };

  const isFirstPageLoading = isLoading && !hasData;
  const generalLoading = isFetching;

  if (isFirstPageLoading) {
    return (
      <LoadingSpinner
        fullScreen={true}
        message="Discovering amazing vendors..."
        subMessage="Finding the best matches for you."
      />
    );
  }

  if (isError && !hasData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">😞</div>
          <h2 className="text-2xl font-bold text-red-600 mb-3">
            Unable to Load Vendors
          </h2>
          <p className="text-gray-600 mb-2">
            {error?.message || "An error occurred"}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Error: {error?.status || "UNKNOWN"}
          </p>
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Try Again
            </button>
            <button
              onClick={() => handleFilterChange(INITIAL_FILTERS)}
              className="w-full px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Clear Filters & Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <VendorListingView
        vendors={vendors}
        filters={filters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onRegisterClick={handleRegisterClick}
        onLoadMore={handleLoadMore}
        isLoading={generalLoading}
        isError={isError}
        pagination={{
          currentPage: page,
          hasMore: hasMoreVendors,
          totalCount: totalCount,
        }}
      />
    </div>
  );
};

export default VendorListingPage;
