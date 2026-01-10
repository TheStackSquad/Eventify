// frontend/src/app/vendor/page.js

"use client";
import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { fetchVendors } from "@/redux/action/vendorAction";
import {
  setVendorFilters,
  clearFetchError,
  setCurrentPage,
  clearVendorList,
} from "@/redux/reducer/vendorReducer";

import {
  selectPaginatedVendors,
  selectFetchStatus,
  selectFetchError,
  selectVendorFilters,
  selectPagination,
  selectTotalVendorsCount,
  selectHasMoreVendors,
} from "@/redux/selectors/vendorSelectors";

import { STATUS } from "@/utils/constants/globalConstants";

import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import VendorListingView from "@/components/vendorUI/vendorListingView";

const VendorListingPage = () => {
  const dispatch = useDispatch();

  // ✅ Track if initial fetch has happened
  const hasFetchedRef = useRef(false);

  // ✅ Track previous filter/pagination values
  const prevFiltersRef = useRef(null);
  const prevPageRef = useRef(null);

  // 🔑 Ref to hold the AbortController for active vendor fetch requests
  const vendorAbortControllerRef = useRef(null);

  // Selectors
  const vendors = useSelector(selectPaginatedVendors);
  const status = useSelector(selectFetchStatus);
  const error = useSelector(selectFetchError);
  const filters = useSelector(selectVendorFilters);
  const pagination = useSelector(selectPagination);
  const totalVendorsCount = useSelector(selectTotalVendorsCount);
  const hasMoreVendors = useSelector(selectHasMoreVendors);

  useEffect(() => {
    // Don't fetch if already loading
    if (status === STATUS.LOADING) {
      return;
    }

    const currentFiltersStr = JSON.stringify(filters);
    const currentPage = pagination.currentPage;

    // Check if filters or page changed
    const filtersChanged = prevFiltersRef.current !== currentFiltersStr;
    const pageChanged = prevPageRef.current !== currentPage;

    // Determine if we should fetch
    let shouldFetch = false;
    let reason = "";

    if (!hasFetchedRef.current && vendors.length === 0) {
      // Initial load
      shouldFetch = true;
      reason = "Initial load";
    } else if (filtersChanged && hasFetchedRef.current) {
      // Filters changed (but not initial load)
      shouldFetch = true;
      reason = "Filters changed";
    } else if (pageChanged && !filtersChanged && hasFetchedRef.current) {
      // Page changed for pagination (load more)
      shouldFetch = true;
      reason = "Page changed";
    }

    if (shouldFetch) {
      // 🔑 1. Abort any previous pending request
      if (vendorAbortControllerRef.current) {
        console.log("🛑 ABORTING previous vendor fetch.");
        vendorAbortControllerRef.current.abort();
      }

      // 🔑 2. Create a new controller and store it
      const controller = new AbortController();
      vendorAbortControllerRef.current = controller;

      console.log(`🚀 FETCHING VENDORS - ${reason}`, {
        page: currentPage,
        filters,
      });

      // 🔑 3. Dispatch the action with the signal
      dispatch(
        fetchVendors({
          ...filters,
          page: currentPage,
          limit: pagination.pageSize,
          signal: controller.signal, // Pass the signal to the Thunk
        })
      );

      // Update refs
      hasFetchedRef.current = true;
      prevFiltersRef.current = currentFiltersStr;
      prevPageRef.current = currentPage;
    } else {
      console.log("⏭️ SKIP FETCH", {
        hasFetched: hasFetchedRef.current,
        hasVendors: vendors.length > 0,
        filtersChanged,
        pageChanged,
      });
    }

    // 🔑 4. Cleanup on component unmount
    return () => {
      // We read the active controller from the persistent ref
      const currentController = vendorAbortControllerRef.current;

      if (currentController) {
        console.log("🧹 [CLEANUP] Aborting vendor fetch on unmount/re-render.");
        currentController.abort();
        vendorAbortControllerRef.current = null;
      }
    };
  }, [
    dispatch,
    filters,
    pagination.currentPage,
    pagination.pageSize,
    status,
    vendors.length, // Only used for initial load check
  ]);

  const handleFilterChange = (newFilters) => {
    console.log("🔄 Filter change:", newFilters);

    // Clear vendors and reset to page 1
    dispatch(clearVendorList());
    dispatch(setCurrentPage(1));
    dispatch(setVendorFilters(newFilters));

    // Reset the refs so fetch happens
    prevFiltersRef.current = null;
    prevPageRef.current = null;
  };

  const handleSearch = (searchTerm) => {
    console.log("🔍 Search:", searchTerm);
    handleFilterChange({ ...filters, search: searchTerm });
  };

  const handleLoadMore = () => {
    if (hasMoreVendors && status !== STATUS.LOADING) {
      console.log("⬇️ Load more - Page:", pagination.currentPage + 1);
      dispatch(setCurrentPage(pagination.currentPage + 1));
    }
  };

  const handleRetry = () => {
    console.log("🔄 Manual retry");

    dispatch(clearFetchError());
    dispatch(clearVendorList());

    // 🔑 Refactored: Reset refs to trigger fresh fetch via the main useEffect
    hasFetchedRef.current = false;
    prevFiltersRef.current = null;
    prevPageRef.current = null;

    // By changing state/refs, the main useEffect is triggered, which handles the abort and dispatch.
  };

  const handleRegisterClick = () => {
    console.log("📝 Register vendor clicked");
    // router.push('/vendor/register');
  };

  // ============================================
  // COMPUTED STATES
  // ============================================

  const isLoading = status === STATUS.LOADING;
  const hasData = vendors && vendors.length > 0;
  const isFirstPageLoading =
    isLoading && !hasData && pagination.currentPage === 1;
  const hasError = error && !hasData;

  // RENDER: LOADING STATE

  if (isFirstPageLoading) {
    return (
      <LoadingSpinner
        fullScreen={true}
        message="Discovering amazing vendors..."
        subMessage="Finding the best matches for you."
      />
    );
  }

  // RENDER: ERROR STATE

  if (hasError) {
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
          {error?.status && (
            <p className="text-sm text-gray-500 mb-6">Error: {error.status}</p>
          )}
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Try Again
            </button>
            <button
              onClick={() => {
                dispatch(clearFetchError());
                handleFilterChange({});
              }}
              className="w-full px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Clear Filters & Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: MAIN VIEW

  return (
    <div className="min-h-screen">
      <VendorListingView
        vendors={vendors || []}
        filters={filters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onRegisterClick={handleRegisterClick}
        onLoadMore={handleLoadMore}
        isLoading={isLoading}
        isError={!!error}
        pagination={{
          currentPage: pagination.currentPage,
          hasMore: hasMoreVendors,
          totalCount: totalVendorsCount,
        }}
      />
    </div>
  );
};

export default VendorListingPage;