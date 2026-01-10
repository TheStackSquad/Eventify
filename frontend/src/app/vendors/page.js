// frontend/src/app/vendor/page.js
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useVendorListing } from "@/app/vendors/hooks/useVendorListing";

// Components
import VendorListingView from "@/components/vendorUI/vendorListingView";
import VendorEmptyState from "@/app/vendors/utils/vendorEmptyState";
import VendorLoadingState from "@/app/vendors/utils/vendorLoadingState";
import ErrorState from "@/components/vendorUI/errorState";

const VendorListingPage = () => {
  const router = useRouter();

  const {
    filters,
    vendors,
    totalVendorsCount,
    paginationInfo,
    hasMoreVendors,
    currentPage,
    pageSize,
    isLoading,
    isFetching,
    isError,
    error,
    isFirstPageLoading,
    hasData,
    shouldShowError,
    handleFilterChange,
    handleSearch,
    handleLoadMore,
    handleRetry,
    handleClearFiltersAndRetry,
  } = useVendorListing();

  const handleRegisterClick = () => {
    router.push("/dashboard");
  };

  // Debug logging - helpful for checking Arike Events data
  if (typeof window !== "undefined") {
    console.log("🎯 VendorListingPage Sync:", {
      hasData,
      count: vendors?.length,
      firstVendorName: vendors?.[0]?.name,
      isError,
    });
  }

  // 1. LOADING STATE
  if (isFirstPageLoading) {
    return <VendorLoadingState isFirstPage={true} />;
  }

  // 2. ERROR STATE (Now using your clean ErrorState component)
  if (shouldShowError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ErrorState onRetry={handleRetry} />
      </div>
    );
  }

  // 3. EMPTY STATE
  if (!hasData && !isLoading) {
    return (
      <VendorEmptyState
        filters={filters}
        onClearFilters={handleClearFiltersAndRetry}
        onBrowseAll={handleClearFiltersAndRetry}
      />
    );
  }

  // 4. MAIN VIEW
  return (
    <div className="min-h-screen">
      <VendorListingView
        vendors={vendors}
        filters={filters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onRegisterClick={handleRegisterClick}
        onLoadMore={handleLoadMore}
        isLoading={isFetching}
        isError={isError}
        pagination={{
          currentPage,
          hasMore: hasMoreVendors,
          totalCount: totalVendorsCount,
          pageSize,
          ...paginationInfo,
        }}
        showLoadMoreSpinner={isFetching && hasData}
      />
    </div>
  );
};

export default VendorListingPage;
