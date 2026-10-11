// frontend/src/hooks/useVendorData.js

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchVendorsApi,
  fetchVendorProfileApi,
  registerVendorApi,
  updateVendorApi,
} from "@/services/vendorApi";
import toastAlert from "@/components/common/toast/toastAlert";
import {
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "@/utils/constants/errorMessages";

// Logging utility
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
  mutation: (hookName, action, data = null) => {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`🔄 [${timestamp}] ${hookName}: ${action}`, data);
    } else {
      console.log(`🔄 [${timestamp}] ${hookName}: ${action}`);
    }
  },
  cache: (action, queryKey, data = null) => {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`💾 [${timestamp}] CACHE ${action}:`, {
        queryKey,
        dataType: typeof data,
        dataSnapshot: data
          ? JSON.stringify(data).substring(0, 200) + "..."
          : "null",
      });
    } else {
      console.log(`💾 [${timestamp}] CACHE ${action}:`, { queryKey });
    }
  },
};

export const vendorKeys = {
  all: ["vendors"],
  list: (filters) => {
    const normalizedFilters = {
      search: filters?.search || "",
      category: filters?.category || "",
      location: filters?.location || "",
      sortBy: filters?.sortBy || "",
      page: filters?.page || 1,
      limit: filters?.limit || 12,
    };
    return ["vendors", "list", normalizedFilters];
  },
  detail: (id) => ["vendors", "detail", id],
};

export function useVendors(filters = {}, options = {}) {
  const hookName = "useVendors";

  log.query(hookName, "Hook called", {
    filters,
    filterKey: JSON.stringify(filters), // Only for logging
    options,
  });

  return useQuery({
    queryKey: vendorKeys.list(filters),
    queryFn: async ({ signal }) => {
      log.query(hookName, "Fetching vendors...", { filters, signal: !!signal });
      try {
        const data = await fetchVendorsApi(filters, signal);
        log.query(hookName, "Fetch successful", {
          vendorCount: data?.vendors?.length || 0,
          totalCount: data?.pagination?.totalCount || 0,
          hasData: !!data,
        });
        return data;
      } catch (error) {
        log.error(hookName, "Fetch failed", error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5,
    placeholderData: (previousData) => previousData,

    onSuccess: (data) => {
      log.query(hookName, "Query onSuccess", {
        dataReturned: !!data,
        vendorsCount: data?.vendors?.length || 0,
      });
    },
    onError: (error) => {
      if (
        error.name === "CanceledError" ||
        error.status === "CLIENT_CANCELLED"
      ) {
        log.query(hookName, "Query cancelled", { reason: error.message });
        return;
      }

      const message = error.message || ERROR_MESSAGES.FETCH_VENDORS_FAILED;
      toastAlert.error(message);
      log.error(hookName, "Query error", error);
    },
    onSettled: (data, error) => {
      log.query(hookName, "Query settled", {
        hasData: !!data,
        hasError: !!error,
        status: error ? "error" : "success",
      });
    },
    ...options,
  });
}

export function useVendorProfile(vendorId, options = {}) {
  return useQuery({
    queryKey: vendorKeys.detail(vendorId),
    queryFn: () => fetchVendorProfileApi(vendorId),
    staleTime: 1000 * 60 * 5,
    enabled: !!vendorId,
    ...options,
  });
}

// Register new vendor
export function useRegisterVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vendorData) => {
      const result = await registerVendorApi(vendorData);
      return result;
    },
    onSuccess: (data) => {
      // Single success toast
      toastAlert.success("Vendor profile created successfully!");
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
    },
    onError: (error) => {
      // Single error toast
      const message = error.response?.data?.message || ERROR_MESSAGES.REGISTER_VENDOR_FAILED;
      toastAlert.error(message);
    },
  });
}

// Update existing vendor
export function useUpdateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vendorId, vendorData }) => {
      const result = await updateVendorApi({ vendorId, vendorData });
      return result;
    },
    onSuccess: (data, { vendorId }) => {
      // Single success toast
      toastAlert.success("Vendor profile updated successfully!");

      // Update cache with new data
      if (data?.vendor) {
        queryClient.setQueryData(
          vendorKeys.detail(vendorId),
          data.vendor,
        );
      }

      // Invalidate to refetch
      queryClient.invalidateQueries({
        queryKey: vendorKeys.detail(vendorId),
      });
      queryClient.invalidateQueries({
        queryKey: vendorKeys.all,
      });
    },
    onError: (error) => {
      // Single error toast
      const message =
        error.response?.data?.message || ERROR_MESSAGES.UPDATE_VENDOR_FAILED;
      toastAlert.error(message);
    },
  });
}

export const prefetchVendorProfile = async (queryClient, vendorId) => {
  const hookName = "prefetchVendorProfile";

  log.query(hookName, "Starting prefetch", { vendorId });

  try {
    await queryClient.prefetchQuery({
      queryKey: vendorKeys.detail(vendorId),
      queryFn: async ({ signal }) => {
        log.query(hookName, "Prefetching profile...", {
          vendorId,
          signal: !!signal,
        });
        const data = await fetchVendorProfileApi(vendorId, signal);
        log.query(hookName, "Prefetch successful", {
          vendorId,
          hasData: !!data,
          vendorName: data?.name || "N/A",
        });
        return data;
      },
      staleTime: 1000 * 60 * 5,
    });
    log.query(hookName, "Prefetch completed", { vendorId });
  } catch (error) {
    log.error(hookName, "Prefetch failed", error);
    throw error;
  }
};
