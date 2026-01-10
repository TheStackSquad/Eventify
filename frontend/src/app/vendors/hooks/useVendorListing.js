// frontend/src/app/vendors/hooks/useVendorListing.js

import { useState, useCallback, useMemo, useEffect } from "react";
import { useVendors } from "@/utils/hooks/useVendorData";

const DEFAULT_PAGE_SIZE = 12;
const DEFAULT_PAGE = 1;

export function useVendorListing(initialFilters = {}) {
  // State for filters and pagination
  const [filters, setFilters] = useState(initialFilters);
  const [currentPage, setCurrentPage] = useState(DEFAULT_PAGE);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);

  // Combine filters with pagination for the query
  const queryFilters = useMemo(
    () => ({
      ...filters,
      page: currentPage,
      limit: pageSize,
    }),
    [filters, currentPage, pageSize]
  );

  // Use React Query hook
  const vendorsQuery = useVendors(queryFilters, {
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      // Don't retry on 404 or Auth errors
      if (error?.status === 404 || error?.status === 401) return false;
      return failureCount < 2;
    },
  });

  // --- DEBUG LOGS ---
  useEffect(() => {
    if (vendorsQuery.isError) {
      console.error("❌ Vendor Query Error:", {
        status: vendorsQuery.error?.status,
        message: vendorsQuery.error?.message,
        data: vendorsQuery.error?.response?.data,
      });
    }
    if (vendorsQuery.data) {
      console.log("📥 Raw API Data Received:", vendorsQuery.data);
    }
  }, [vendorsQuery.isError, vendorsQuery.error, vendorsQuery.data]);
  // ------------------

  // Extract data defensively
  // Since your API currently returns a raw array, we check for that specifically
  const { vendors, paginationInfo, totalVendorsCount } = useMemo(() => {
    const rawData = vendorsQuery.data;

    // Case 1: API returns a raw array: [...]
    if (Array.isArray(rawData)) {
      return {
        vendors: rawData,
        paginationInfo: { totalCount: rawData.length },
        totalVendorsCount: rawData.length,
      };
    }

    // Case 2: API returns wrapped object: { vendors: [...], pagination: {...} }
    if (rawData?.vendors) {
      return {
        vendors: rawData.vendors,
        paginationInfo: rawData.pagination || {},
        totalVendorsCount:
          rawData.pagination?.totalCount || rawData.vendors.length,
      };
    }

    // Default: Empty state
    return {
      vendors: [],
      paginationInfo: {},
      totalVendorsCount: 0,
    };
  }, [vendorsQuery.data]);

  // Check if there are more vendors to load
  const hasMoreVendors = useMemo(() => {
    if (totalVendorsCount === 0) return false;
    const totalPages = Math.ceil(totalVendorsCount / pageSize);
    return currentPage < totalPages;
  }, [totalVendorsCount, pageSize, currentPage]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters) => {
    console.log("🔄 Filter change requested:", newFilters);
    setFilters(newFilters);
    setCurrentPage(DEFAULT_PAGE);
  }, []);

  // Handle search
  const handleSearch = useCallback(
    (searchTerm) => {
      handleFilterChange({ ...filters, search: searchTerm });
    },
    [filters, handleFilterChange]
  );

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (hasMoreVendors && !vendorsQuery.isFetching) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasMoreVendors, vendorsQuery.isFetching]);

  const handleRetry = useCallback(() => {
    vendorsQuery.refetch();
  }, [vendorsQuery]);

  const handleClearFiltersAndRetry = useCallback(() => {
    setFilters({});
    setCurrentPage(DEFAULT_PAGE);
    vendorsQuery.refetch();
  }, [vendorsQuery]);

  // Computed states for the UI
  const isFirstPageLoading =
    vendorsQuery.isLoading && currentPage === DEFAULT_PAGE;
  const hasData = Array.isArray(vendors) && vendors.length > 0;


  const shouldShowError = vendorsQuery.isError && !hasData;

  // Log computed state for final check
  console.log("📊 UI State:", {
    hasData,
    isFirstPageLoading,
    shouldShowError,
    vendorCount: vendors.length,
  });

  return {
    filters,
    currentPage,
    pageSize,
    vendors,
    totalVendorsCount,
    paginationInfo,
    hasMoreVendors,
    isLoading: vendorsQuery.isLoading,
    isFetching: vendorsQuery.isFetching,
    isError: vendorsQuery.isError,
    error: vendorsQuery.error,
    isFirstPageLoading,
    hasData,
    shouldShowError,
    handleFilterChange,
    handleSearch,
    handleLoadMore,
    handleRetry,
    handleClearFiltersAndRetry,
    setCurrentPage,
    setFilters,
    query: vendorsQuery,
  };
}
