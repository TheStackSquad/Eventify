// frontend/src/hooks/useVendorAnalytics.js

import { useQuery } from "@tanstack/react-query";
import {
  fetchVendorAnalyticsApi,
  checkAnalyticsHealthApi,
} from "@/services/vendorApi";
import { ANALYTICS_CONSTANTS } from "@/utils/constants/globalConstants";

// Logging utility (duplicated to keep each file independent)
const log = {
  query: (hookName, action, data = null) => {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`📊 [${timestamp}] ${hookName}: ${action}`, data);
    } else {
      console.log(`📊 [${timestamp}] ${hookName}: ${action}`);
    }
  },
  error: (hookName, action, error) => {
    const timestamp = new Date().toISOString();
    console.error(`❌ [${timestamp}] ${hookName}: ${action}`, {
      message: error.message,
      name: error.name,
      status: error.status,
      code: error.code,
      stack: error.stack?.split("\n")[0],
    });
  },
};

// Analytics-specific query keys
export const analyticsKeys = {
  // Analytics data for a specific vendor
  analytics: (id) => ["vendors", "analytics", id],
  // Service health check
  health: ["vendors", "health"],
};

export const useVendorAnalytics = (vendorId, options = {}) => {
  const hookName = "useVendorAnalytics";

  log.query(hookName, "Hook called", { vendorId, enabled: !!vendorId });

  return useQuery({
    queryKey: analyticsKeys.analytics(vendorId),
    queryFn: async () => {
      log.query(hookName, "Fetching vendor analytics...", { vendorId });
      try {
        const data = await fetchVendorAnalyticsApi(vendorId);
        log.query(hookName, "Fetch successful", {
          vendorId,
          hasData: !!data,
          sections: data ? Object.keys(data) : [],
          insightsCount: data?.insights?.length || 0,
          inquiries: data?.inquiries || null,
          reviews: data?.reviews || null,
          trends: data?.trends ? "present" : "absent",
        });
        return data;
      } catch (error) {
        log.error(hookName, "Fetch failed", error);
        throw error;
      }
    },
    enabled: !!vendorId,
    staleTime: ANALYTICS_CONSTANTS?.CACHE_TIME?.ANALYTICS || 1000 * 60 * 5, // 5 minutes default
    cacheTime: ANALYTICS_CONSTANTS?.CACHE_TIME?.ANALYTICS || 1000 * 60 * 5,
    refetchOnWindowFocus: true,
    retry: 2,
    onSuccess: (data) => {
      log.query(hookName, "Query onSuccess", {
        vendorId,
        dataStructure: data
          ? {
              hasOverview: !!data.overview,
              hasInsights: !!data.insights,
              hasInquiries: !!data.inquiries,
              hasReviews: !!data.reviews,
              hasTrends: !!data.trends,
            }
          : "no data",
      });
    },
    onError: (error) => {
      log.error(hookName, "Query error", error);
    },
    onSettled: (data, error) => {
      log.query(hookName, "Query settled", {
        vendorId,
        status: error ? "error" : "success",
        retries: options.retry || 2,
      });
    },
    ...options,
  });
};

export const useAnalyticsHealth = (options = {}) => {
  const hookName = "useAnalyticsHealth";

  log.query(hookName, "Hook called");

  return useQuery({
    queryKey: analyticsKeys.health,
    queryFn: async () => {
      log.query(hookName, "Checking analytics health...");
      try {
        const data = await checkAnalyticsHealthApi();
        log.query(hookName, "Health check successful", {
          status: data?.status || "unknown",
          timestamp: data?.timestamp || "N/A",
        });
        return data;
      } catch (error) {
        log.error(hookName, "Health check failed", error);
        throw error;
      }
    },
    staleTime: ANALYTICS_CONSTANTS?.CACHE_TIME?.STATIC_DATA || 1000 * 60 * 10, // 10 minutes default
    cacheTime: ANALYTICS_CONSTANTS?.CACHE_TIME?.STATIC_DATA || 1000 * 60 * 10,
    refetchInterval: 60000, // Check every minute
    onSuccess: (data) => {
      log.query(hookName, "Health status updated", data);
    },
    onError: (error) => {
      log.error(hookName, "Health check error", error);
    },
    ...options,
  });
};

export const useVendorOverview = (vendorId, options = {}) => {
  const hookName = "useVendorOverview";
  const { data, ...rest } = useVendorAnalytics(vendorId, options);

  const result = {
    data: data?.overview || null,
    ...rest,
  };

  log.query(hookName, "Hook result", {
    vendorId,
    hasData: !!result.data,
    dataStructure: result.data ? Object.keys(result.data) : [],
    status: rest.status,
  });

  return result;
};

export const useVendorInsights = (vendorId, options = {}) => {
  const hookName = "useVendorInsights";
  const { data, ...rest } = useVendorAnalytics(vendorId, options);

  const insights = data?.insights || [];
  const result = {
    data: insights,
    criticalInsights: insights.filter((i) => i.type === "critical") || [],
    warningInsights: insights.filter((i) => i.type === "warning") || [],
    ...rest,
  };

  log.query(hookName, "Hook result", {
    vendorId,
    totalInsights: insights.length,
    criticalCount: result.criticalInsights.length,
    warningCount: result.warningInsights.length,
    status: rest.status,
  });

  return result;
};

export const useVendorInquiries = (vendorId, options = {}) => {
  const hookName = "useVendorInquiries";
  const { data, ...rest } = useVendorAnalytics(vendorId, options);

  const inquiries = data?.inquiries || null;
  const result = {
    data: inquiries,
    pendingCount: inquiries?.pending || 0,
    ...rest,
  };

  log.query(hookName, "Hook result", {
    vendorId,
    hasData: !!inquiries,
    pendingCount: result.pendingCount,
    totalInquiries: inquiries?.total || 0,
    status: rest.status,
  });

  return result;
};

export const useVendorReviews = (vendorId, options = {}) => {
  const hookName = "useVendorReviews";
  const { data, ...rest } = useVendorAnalytics(vendorId, options);

  const reviews = data?.reviews || null;
  const result = {
    data: reviews,
    averageRating: reviews?.averageRating || 0,
    pendingReviews: reviews?.pendingReviews || 0,
    ...rest,
  };

  log.query(hookName, "Hook result", {
    vendorId,
    hasData: !!reviews,
    averageRating: result.averageRating,
    pendingReviews: result.pendingReviews,
    totalReviews: reviews?.totalReviews || 0,
    status: rest.status,
  });

  return result;
};

export const useVendorTrends = (vendorId, options = {}) => {
  const hookName = "useVendorTrends";
  const { data, ...rest } = useVendorAnalytics(vendorId, options);

  const trends = data?.trends || null;
  const result = {
    data: trends,
    last7Days: trends?.last7Days || null,
    last30Days: trends?.last30Days || null,
    ...rest,
  };

  log.query(hookName, "Hook result", {
    vendorId,
    hasData: !!trends,
    has7DaysData: !!result.last7Days,
    has30DaysData: !!result.last30Days,
    status: rest.status,
  });

  return result;
};

export const prefetchVendorAnalytics = async (queryClient, vendorId) => {
  const hookName = "prefetchVendorAnalytics";

  log.query(hookName, "Starting prefetch", { vendorId });

  try {
    await queryClient.prefetchQuery({
      queryKey: analyticsKeys.analytics(vendorId),
      queryFn: async () => {
        log.query(hookName, "Prefetching analytics...", { vendorId });
        const data = await fetchVendorAnalyticsApi(vendorId);
        log.query(hookName, "Prefetch successful", {
          vendorId,
          hasData: !!data,
          sections: data ? Object.keys(data) : [],
        });
        return data;
      },
      staleTime: ANALYTICS_CONSTANTS?.CACHE_TIME?.ANALYTICS || 1000 * 60 * 5,
    });
    log.query(hookName, "Prefetch completed", { vendorId });
  } catch (error) {
    log.error(hookName, "Prefetch failed", error);
    throw error;
  }
};
