// frontend/src/hooks/useVendorAnalytics.js

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  fetchVendorAnalyticsApi,
  checkAnalyticsHealthApi,
} from "@/services/vendorApi";

// ============================================================================
// QUERY KEYS - Centralized for consistency
// ============================================================================

export const analyticsKeys = {
  all: ["vendors", "analytics"],
  analytics: (id) => ["vendors", "analytics", id],
  health: ["vendors", "analytics", "health"],
};

// ============================================================================
// LOGGING UTILITY
// ============================================================================

const IS_DEV = process.env.NODE_ENV === "development";

const log = {
  query: (hookName, action, data = null) => {
    if (!IS_DEV) return;
    const timestamp = new Date().toISOString();
    console.log(`📊 [${timestamp}] ${hookName}: ${action}`, data || "");
  },
  error: (hookName, action, error) => {
    if (!IS_DEV) return;
    const timestamp = new Date().toISOString();
    console.error(`❌ [${timestamp}] ${hookName}: ${action}`, {
      message: error.message,
      status: error.status,
    });
  },
};

// ============================================================================
// MAIN ANALYTICS HOOK - Optimized for Performance
// ============================================================================

export const useVendorAnalytics = (vendorId, options = {}) => {
  const hookName = "useVendorAnalytics";

  log.query(hookName, "Hook called", { vendorId, enabled: !!vendorId });

  return useQuery({
    // ✅ Unique query key per vendor
    queryKey: analyticsKeys.analytics(vendorId),

    // ✅ Fetch function
    queryFn: async () => {
      log.query(hookName, "Fetching vendor analytics...", { vendorId });
      try {
        const data = await fetchVendorAnalyticsApi(vendorId);
        log.query(hookName, "Fetch successful", {
          vendorId,
          vendorName: data?.vendorName,
          totalInquiries: data?.inquiries?.total || 0,
          totalReviews: data?.reviews?.totalReviews || 0,
        });
        return data;
      } catch (error) {
        log.error(hookName, "Fetch failed", error);
        throw error;
      }
    },

    // ✅ CRITICAL: Only fetch if vendorId exists
    enabled: !!vendorId,

    // ============================================================================
    // SMART CACHING STRATEGY
    // ============================================================================

    // ✅ Data is "fresh" for 10 minutes (won't refetch during this time)
    staleTime: 10 * 60 * 1000, // 10 minutes

    // ✅ Keep in cache for 30 minutes even if component unmounts
    cacheTime: 30 * 60 * 1000, // 30 minutes (renamed to gcTime in v5)

    // ✅ Don't refetch when user switches browser tabs (saves resources)
    refetchOnWindowFocus: false,

    // ✅ DO refetch when user regains internet connection
    refetchOnReconnect: true,

    // ✅ Auto-refresh every 5 minutes (keep data relatively fresh)
    refetchInterval: 5 * 60 * 1000, // 5 minutes

    // ✅ Stop auto-refresh when window is not visible (battery optimization)
    refetchIntervalInBackground: false,

    // ============================================================================
    // ERROR HANDLING & RETRY
    // ============================================================================

    // ✅ Retry failed requests (exponential backoff)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),

    // ✅ Callbacks for debugging
    onSuccess: (data) => {
      log.query(hookName, "Query succeeded", {
        vendorId,
        hasOverview: !!data?.overview,
        hasInquiries: !!data?.inquiries,
        hasReviews: !!data?.reviews,
      });
    },

    onError: (error) => {
      log.error(hookName, "Query error", error);
    },

    // ✅ Show placeholder while loading (better UX)
    placeholderData: (previousData) => {
      // If we have previous data, show it while refetching
      return previousData;
    },

    // ✅ Merge with any custom options passed in
    ...options,
  });
};

// ============================================================================
// ANALYTICS HEALTH CHECK HOOK
// ============================================================================

export const useAnalyticsHealth = (options = {}) => {
  const hookName = "useAnalyticsHealth";

  return useQuery({
    queryKey: analyticsKeys.health,
    queryFn: async () => {
      log.query(hookName, "Checking analytics health...");
      try {
        const data = await checkAnalyticsHealthApi();
        log.query(hookName, "Health check successful", data);
        return data;
      } catch (error) {
        log.error(hookName, "Health check failed", error);
        throw error;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 10 * 60 * 1000,
    refetchInterval: 60000, // Check every minute
    ...options,
  });
};

// ============================================================================
// DERIVED HOOKS - Extract specific sections
// ============================================================================

export const useVendorOverview = (vendorId, options = {}) => {
  const { data, ...rest } = useVendorAnalytics(vendorId, options);
  return {
    data: data?.overview || null,
    ...rest,
  };
};

export const useVendorInquiries = (vendorId, options = {}) => {
  const { data, ...rest } = useVendorAnalytics(vendorId, options);
  return {
    data: data?.inquiries || null,
    pendingCount: data?.inquiries?.pending || 0,
    ...rest,
  };
};

export const useVendorReviews = (vendorId, options = {}) => {
  const { data, ...rest } = useVendorAnalytics(vendorId, options);
  return {
    data: data?.reviews || null,
    averageRating: data?.reviews?.averageRating || 0,
    ...rest,
  };
};

export const useVendorTrends = (vendorId, options = {}) => {
  const { data, ...rest } = useVendorAnalytics(vendorId, options);
  return {
    data: data?.trends || null,
    last7Days: data?.trends?.last7Days || null,
    last30Days: data?.trends?.last30Days || null,
    ...rest,
  };
};

// ============================================================================
// CACHE INVALIDATION HOOK - Use when data changes
// ============================================================================

export const useInvalidateAnalytics = () => {
  const queryClient = useQueryClient();

  return {
    // Invalidate specific vendor's analytics
    invalidateVendor: (vendorId) => {
      log.query("useInvalidateAnalytics", "Invalidating vendor", { vendorId });
      queryClient.invalidateQueries({
        queryKey: analyticsKeys.analytics(vendorId),
      });
    },

    // Invalidate all analytics
    invalidateAll: () => {
      log.query("useInvalidateAnalytics", "Invalidating all analytics");
      queryClient.invalidateQueries({
        queryKey: analyticsKeys.all,
      });
    },
  };
};

// ============================================================================
// PREFETCH HELPER - Preload analytics before navigation
// ============================================================================

export const prefetchVendorAnalytics = async (queryClient, vendorId) => {
  log.query("prefetchVendorAnalytics", "Prefetching", { vendorId });

  await queryClient.prefetchQuery({
    queryKey: analyticsKeys.analytics(vendorId),
    queryFn: () => fetchVendorAnalyticsApi(vendorId),
    staleTime: 10 * 60 * 1000,
  });
};