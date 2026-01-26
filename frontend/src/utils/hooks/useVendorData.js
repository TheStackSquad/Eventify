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
  // Main list
  all: ["vendors"],
  // List with filters (key must contain all filter params to be unique)
  list: (filters) => ["vendors", "list", filters],
  // Individual vendor profile
  detail: (id) => ["vendors", "detail", id],
};

export function useVendors(filters = {}, options = {}) {
  const hookName = "useVendors";
  // Using JSON.stringify ensures the query key is stable and only changes when content changes.
  const filterKey = JSON.stringify(filters);

  log.query(hookName, "Hook called", { filters, filterKey, options });

  return useQuery({
    queryKey: vendorKeys.list(filterKey),
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
    staleTime: 1000 * 60 * 5, // 5 minutes
    keepPreviousData: true, // Crucial for smooth pagination/filtering
    onSuccess: (data) => {
      log.query(hookName, "Query onSuccess", {
        dataReturned: !!data,
        vendorsCount: data?.vendors?.length || 0,
      });
    },
    onError: (error) => {
      // Ignoring cancellation error silently as per Redux thunk logic
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

export function useVendorProfile(vendorId, initialData) {
  return useQuery({
    queryKey: ["vendors", "detail", vendorId],
    queryFn: () => fetchVendorProfileApi(vendorId),
    initialData: initialData,
    staleTime: 1000 * 60 * 5,
    enabled: !!vendorId,
  });
}

export function useRegisterVendor() {
  const hookName = "useRegisterVendor";
  const queryClient = useQueryClient();

  log.mutation(hookName, "Hook called");

  return useMutation({
    mutationFn: async (vendorData) => {
      log.mutation(hookName, "Starting vendor registration", {
        dataKeys: Object.keys(vendorData),
        hasId: !!vendorData.id,
      });
      try {
        const result = await registerVendorApi(vendorData);
        log.mutation(hookName, "Registration API successful", {
          newVendorId: result?.id,
          vendorName: result?.name || "N/A",
        });
        return result;
      } catch (error) {
        log.error(hookName, "Registration API failed", error);
        throw error;
      }
    },
    onSuccess: (newVendor, variables) => {
      log.mutation(hookName, "Mutation onSuccess triggered", {
        newVendorId: newVendor?.id,
        variables: variables ? Object.keys(variables) : [],
      });

      // 1. Show success toast (Mimicking Thunk action)
      toastAlert.success(
        SUCCESS_MESSAGES.VENDOR_REGISTERED ||
          "Vendor registration submitted successfully!"
      );

      // 2. 
      const updateCache = (oldData) => {
        log.cache("Before update", vendorKeys.list(), oldData);

        if (!oldData || !oldData.vendors) {
          const newData = {
            vendors: [newVendor],
            pagination: { totalCount: 1 },
          };
          log.cache("Setting fresh cache", vendorKeys.list(), newData);
          return newData;
        }

        const updatedData = {
          ...oldData,
          vendors: [newVendor, ...oldData.vendors],
          pagination: {
            ...oldData.pagination,
            totalCount: oldData.pagination.totalCount + 1,
          },
        };

        log.cache("After update", vendorKeys.list(), {
          oldCount: oldData.vendors.length,
          newCount: updatedData.vendors.length,
          newTotalCount: updatedData.pagination.totalCount,
        });

        return updatedData;
      };

      queryClient.setQueryData(vendorKeys.list(), updateCache);

      // 3. Optional: Invalidate any general list queries to ensure freshness on next fetch
      log.cache("Invalidating list queries", vendorKeys.list());
      queryClient.invalidateQueries({ queryKey: vendorKeys.list() });

      log.mutation(hookName, "Cache operations completed");
    },
    onError: (error, variables) => {
      log.mutation(hookName, "Mutation onError triggered", {
        error: error.message,
        variables: variables ? Object.keys(variables) : [],
      });

      // 1. Show error toast (Mimicking Thunk action)
      const message =
        error.response?.data?.message || ERROR_MESSAGES.REGISTER_VENDOR_FAILED;
      toastAlert.error(message);
      log.error(hookName, "Vendor registration failed", error);
    },
    onSettled: (data, error, variables) => {
      log.mutation(hookName, "Mutation settled", {
        hasData: !!data,
        hasError: !!error,
        vendorId: data?.id || "none",
      });
    },
  });
}

export function useUpdateVendor() {
  const hookName = "useUpdateVendor";
  const queryClient = useQueryClient();

  log.mutation(hookName, "Hook called");

  return useMutation({
    mutationFn: async ({ vendorId, vendorData }) => {
      log.mutation(hookName, "Starting vendor update", {
        vendorId,
        dataKeys: Object.keys(vendorData),
        updateFields: Object.keys(vendorData).join(", "),
      });
      try {
        const result = await updateVendorApi({ vendorId, vendorData });
        log.mutation(hookName, "Update API successful", {
          vendorId,
          updatedFields: result ? Object.keys(result) : [],
        });
        return result;
      } catch (error) {
        log.error(hookName, "Update API failed", error);
        throw error;
      }
    },
    onSuccess: (updatedVendor, { vendorId }) => {
      log.mutation(hookName, "Mutation onSuccess triggered", {
        vendorId,
        updatedVendorId: updatedVendor?.id,
      });

      // 1. Show success toast (Mimicking Thunk action)
      toastAlert.success(
        SUCCESS_MESSAGES.VENDOR_UPDATED ||
          "Vendor profile updated successfully!"
      );

      // 2. Update the individual vendor detail cache immediately (Mimicking Reducer logic)
      log.cache(
        "Setting vendor detail",
        vendorKeys.detail(vendorId),
        updatedVendor
      );
      queryClient.setQueryData(vendorKeys.detail(vendorId), updatedVendor);

      // 3. Invalidate relevant caches to ensure components re-fetch fresh data
      log.cache("Invalidating vendor detail", vendorKeys.detail(vendorId));
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(vendorId) }); // Re-fetch to confirm change

      log.cache("Invalidating vendor list", vendorKeys.list());
      queryClient.invalidateQueries({ queryKey: vendorKeys.list() }); // Invalidate list in case the update affects list view (e.g., name/image)

      log.mutation(hookName, "Cache operations completed");
    },
    onError: (error, { vendorId }) => {
      log.mutation(hookName, "Mutation onError triggered", { vendorId });

      // 1. Show error toast (Mimicking Thunk action)
      const message =
        error.response?.data?.message || ERROR_MESSAGES.UPDATE_VENDOR_FAILED;
      toastAlert.error(message);
      log.error(hookName, "Vendor update failed", error);
    },
    onSettled: (data, error, { vendorId }) => {
      log.mutation(hookName, "Mutation settled", {
        vendorId,
        hasData: !!data,
        hasError: !!error,
        status: error ? "failed" : "success",
      });
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
