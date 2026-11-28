// frontend/src/app/vendor/vendorListingPage.js

"use client";

import React, { useState, useDeferredValue, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useVendors } from "@/utils/hooks/useVendorData";
import { VENDOR_DEFAULTS } from "@/utils/constants/globalConstants";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import VendorListingView from "@/components/vendorUI/components/lists/vendorListingView";
import HeroUI from "@/components/vendorUI/components/layout/heroUI";

const INITIAL_FILTERS = VENDOR_DEFAULTS.INITIAL_STATE.filters;
const INITIAL_PAGINATION = {
  currentPage: 1,
  pageSize: 12,
};

const VendorListingPage = () => {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(INITIAL_PAGINATION.currentPage);
  const router = useRouter();

  // Defer search/category/location so typing stays responsive on long lists
  const deferredSearch = useDeferredValue(filters.search || "");
  const deferredCategory = useDeferredValue(filters.category);
  const deferredLocation = useDeferredValue(filters.location);

  const requestParams = useMemo(
    () => ({
      search: deferredSearch,
      category: deferredCategory,
      location: deferredLocation,
      sortBy: filters.sortBy,
      page,
      limit: INITIAL_PAGINATION.pageSize,
    }),
    [deferredSearch, deferredCategory, deferredLocation, filters.sortBy, page],
  );

  const { data, isLoading, isFetching, isPlaceholderData, isError, error } =
    useVendors(requestParams);

  // Pages loaded so far for the CURRENT filters. "Load more" appends the next page.
  const filtersKey = [
    deferredSearch,
    deferredCategory ?? "",
    deferredLocation ?? "",
    filters.sortBy ?? "",
  ].join("|");
  const [loaded, setLoaded] = useState({ key: filtersKey, pages: {} });

  useEffect(() => {
    // useVendors keeps the previous response while the next one loads; never file that one.
    if (!data?.vendors || isPlaceholderData) return;
    // File the response under the page the SERVER says it is, not the one we asked for.
    const servedPage = data.pagination?.currentPage ?? page;
    setLoaded((prev) => ({
      key: filtersKey,
      pages: {
        ...(prev.key === filtersKey ? prev.pages : {}),
        [servedPage]: data.vendors,
      },
    }));
  }, [data, isPlaceholderData, page, filtersKey]);

  const vendors = useMemo(() => {
    const pages = loaded.key === filtersKey ? loaded.pages : {};
    const merged = Object.keys(pages)
      .map(Number)
      .sort((a, b) => a - b)
      .flatMap((n) => pages[n]);
    if (merged.length === 0) return data?.vendors || [];
    const seen = new Set(); // a vendor can shift pages if rankings change between requests
    return merged.filter((v) => (seen.has(v.id) ? false : seen.add(v.id)));
  }, [loaded, filtersKey, data]);

  const totalCount = data?.pagination?.totalCount || 0;
  const hasData = vendors.length > 0;
  const hasMoreVendors =
    data?.pagination?.hasMore ??
    page * INITIAL_PAGINATION.pageSize < totalCount;
  const isFirstPageLoading = isLoading && !hasData;

  // Show that the UI is catching up to the user's input
  const isAnyFilterPending =
    filters.search !== deferredSearch ||
    filters.category !== deferredCategory ||
    filters.location !== deferredLocation;
  const generalLoading = isFetching || isAnyFilterPending;

  const handleFilterChange = (newFilters) => {
    setPage(1); // a new search or filter starts again from page 1
    setFilters((prev) => ({ ...prev, ...newFilters }));
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
    router.push("/dashboard");
  };

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
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50">
        <div className="text-center max-w-md bg-white p-8 rounded-2xl shadow-sm">
          <div className="text-6xl mb-4">😞</div>
          <h2 className="text-2xl font-bold text-red-600 mb-3">
            Unable to Load Vendors
          </h2>
          <p className="text-gray-600 mb-2">
            {error?.message || "An error occurred while fetching vendors."}
          </p>
          <div className="mt-6 space-y-3">
            <button
              onClick={handleRetry}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              Try Again
            </button>
            <button
              onClick={() => handleFilterChange(INITIAL_FILTERS)}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <HeroUI />

      <main className="mx-auto max-w-7xl py-8 px-4 sm:px-6 lg:px-8">
        <VendorListingView
          vendors={vendors}
          filters={filters}
          onFilterChange={handleFilterChange}
          onSearch={handleSearch}
          onRegisterClick={handleRegisterClick}
          onLoadMore={handleLoadMore}
          isLoading={generalLoading}
          isSearchPending={isAnyFilterPending}
          isError={isError}
          pagination={{
            currentPage: page,
            hasMore: hasMoreVendors,
            totalCount,
          }}
        />
      </main>
    </div>
  );
};

export default VendorListingPage;
