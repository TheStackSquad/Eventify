// frontend/src/redux/action/vendorAction.js

import { createAsyncThunk } from "@reduxjs/toolkit";
import axios from "@/axiosConfig/axios";
import toastAlert from "@/components/common/toast/toastAlert";
import {
  REDUX_ACTION_TYPES,
  API_ENDPOINTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "@/utils/constants/globalConstants";

// ✅ Utility to normalize MongoDB vendor data
const normalizeVendor = (vendor) => {
  if (!vendor) return null;

  // Extract ID from MongoDB format: _id.$oid or _id or id
  const id = vendor._id?.$oid || vendor._id || vendor.id;

  return {
    ...vendor,
    id, // Add normalized id field
  };
};

export const fetchVendors = createAsyncThunk(
  REDUX_ACTION_TYPES.FETCH_VENDORS,
  // 🔑 Destructure 'signal' from the thunkAPI argument
  async (filters = {}, { rejectWithValue, signal }) => {
    // console.log("⚙️ THUNK START: Initial filters received:", filters);

    // ✅ SIMPLIFIED: Build query params
    const queryParams = new URLSearchParams();
    const allParams = {
      ...filters,
      page: filters.page || 1,
      limit: filters.limit || 12,
    };

    // console.log("🛠️ PARAMETER PROCESSING: Final parameters:", allParams);

    // Build query string
    Object.entries(allParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        queryParams.append(key, value.toString());
        // console.log(`➡️ QUERY BUILDER: ${key}=${value}`);
      }
    });

    const endpoint = `${API_ENDPOINTS.VENDORS.LIST}?${queryParams.toString()}`;
    // console.log(`📡 API CALL: ${endpoint}`);

    try {
      // 🔑 Pass the received signal to the axios request
      const response = await axios.get(endpoint, {
        signal,
        timeout: 10000,
      });

      // ✅ SIMPLIFIED: Parse response
      let vendors = [];
      let pagination = {};

      if (Array.isArray(response.data)) {
        // Backend returns simple array
        vendors = response.data;
        pagination = {
          currentPage: allParams.page,
          pageSize: allParams.limit,
          totalCount: response.data.length,
        };
      } else if (response.data && Array.isArray(response.data.vendors)) {
        // Backend returns { vendors: [], pagination: {} }
        vendors = response.data.vendors;
        pagination = response.data.pagination || {
          currentPage: allParams.page,
          pageSize: allParams.limit,
          totalCount: response.data.vendors.length,
        };
      } else {
        // Fallback
        vendors = response.data || [];
        pagination = {
          currentPage: allParams.page,
          pageSize: allParams.limit,
          totalCount: response.data?.length || 0,
        };
      }

      // ✅ NEW: Transform MongoDB IDs to normalized format
      const normalizedVendors = vendors.map(normalizeVendor).filter(Boolean);

      return {
        vendors: normalizedVendors,
        pagination,
      };
    } catch (error) {
      // console.error("❌ THUNK ERROR:", error);

      let errorMessage = ERROR_MESSAGES.FETCH_VENDORS_FAILED;
      let errorStatus = "UNKNOWN_ERROR";

      // 🔑 CRITICAL: Check for cancellation *first* and handle silently
      if (axios.isCancel(error) || error.name === "AbortError") {
        console.warn("🛑 ERROR: Request was intentionally cancelled (Abort).");
        // Reject with a special value that the reducer can ignore, or just let the promise chain stop.
        // We use rejectWithValue for consistency, but the component handles the silence.
        return rejectWithValue({
          message: "Request was cancelled by user action",
          status: "CLIENT_CANCELLED",
        });
      }

      // ✅ KEEP: Excellent error categorization
      if (error.code === "ECONNABORTED") {
        errorMessage = "Request timeout - please try again";
        errorStatus = "TIMEOUT";
      } else if (error.response) {
        errorMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          `Server error: ${error.response.status}`;
        errorStatus = `HTTP_${error.response.status}`;
      } else if (error.request) {
        errorMessage = "Network error - please check your connection";
        errorStatus = "NETWORK_ERROR";
      }

      // console.log("🚫 FINAL ERROR:", errorMessage, "|", errorStatus);

      toastAlert.error(errorMessage);

      return rejectWithValue({
        message: errorMessage,
        status: errorStatus,
        code: error.response?.status,
        originalError: error.message,
      });
    }
  }
);

// Enhanced getVendorProfile with cache-first approach
export const getVendorProfile = createAsyncThunk(
  REDUX_ACTION_TYPES.GET_VENDOR_PROFILE,
  // 🔑 Destructure 'signal' here too, for consistency and future use
  async (vendorId, { rejectWithValue, signal, getState }) => {
    // Check if we have fresh data in the store
    const state = getState();
    const existingVendor = state.vendors.byId[vendorId];
    const isFresh =
      state.vendors.lastFetched[vendorId] &&
      Date.now() - state.vendors.lastFetched[vendorId] < 5 * 60 * 1000; // 5 minutes

    if (existingVendor && isFresh && !state.vendors.isStale[vendorId]) {
      return existingVendor;
    }

    // If no cached data or data is stale, fetch from API
    if (!vendorId || vendorId === ":id") {
      const errorMsg = "Invalid vendor ID provided";
      toastAlert.error("Invalid vendor selection");
      return rejectWithValue({ message: errorMsg, status: "INVALID_ID" });
    }

    const endpoint = API_ENDPOINTS.VENDORS.GET_PROFILE.replace(":id", vendorId);

    try {
      const response = await axios.get(endpoint, {
        signal, // Pass signal
        timeout: 8000,
      });

      return response.data;
    } catch (error) {
      let errorMessage = ERROR_MESSAGES.FETCH_PROFILE_FAILED;
      let errorStatus = "UNKNOWN_ERROR";

      // 🔑 Handle Abort for profile fetch as well
      if (axios.isCancel(error) || error.name === "AbortError") {
        console.warn("🛑 ERROR: Profile request was intentionally cancelled.");
        return rejectWithValue({
          message: "Request was cancelled by user action",
          status: "CLIENT_CANCELLED",
        });
      }

      if (error.response?.status === 404) {
        errorMessage = "Vendor not found";
        errorStatus = "NOT_FOUND";
      } else if (error.response?.status === 403) {
        errorMessage = "Access to vendor profile denied";
        errorStatus = "FORBIDDEN";
      } else if (error.response?.status === 500) {
        errorMessage = "Server error while fetching vendor profile";
        errorStatus = "SERVER_ERROR";
      }

      // If we have cached data but API failed, we can still use cached data
      if (existingVendor) {
        return existingVendor; // Return cached data instead of error
      }

      return rejectWithValue({
        message: errorMessage,
        status: errorStatus,
        vendorId,
        httpStatus: error.response?.status,
      });
    }
  }
);

// Vendor registration action (updated for normalized store)
export const registerVendor = createAsyncThunk(
  REDUX_ACTION_TYPES.REGISTER_VENDOR,
  async (vendorData, { rejectWithValue }) => {
    // debugLog("VENDOR_REGISTER_START", "Registering new vendor", {
    //   vendorName: vendorData.name,
    //   category: vendorData.category,
    // });

    try {
      const response = await axios.post(
        API_ENDPOINTS.VENDORS.REGISTER,
        vendorData,
        {
          timeout: 15000,
        }
      );

      // debugLog("VENDOR_REGISTER_SUCCESS", "Vendor registered successfully", {
      //   vendorId: response.data?.id,
      //   vendorName: response.data?.name,
      // });

      return response.data;
    } catch (error) {
      let errorMessage = ERROR_MESSAGES.REGISTER_VENDOR_FAILED;

      if (error.response?.status === 400) {
        errorMessage =
          error.response?.data?.message || "Invalid vendor data provided";
      } else if (error.response?.status === 409) {
        errorMessage = "Vendor with this name or contact already exists";
      }

      // debugLog("VENDOR_REGISTER_ERROR", "Failed to register vendor", {
      //   error: error.message,
      //   httpStatus: error.response?.status,
      //   validationErrors: error.response?.data?.errors,
      // });

      toastAlert.error(errorMessage);
      return rejectWithValue({
        message: errorMessage,
        validationErrors: error.response?.data?.errors,
      });
    }
  }
);

export const updateVendor = createAsyncThunk(
  REDUX_ACTION_TYPES.UPDATE_VENDOR,
  // data is the clean JSON object containing imageURL
  async ({ vendorId, data }, { rejectWithValue }) => {
    // debugLog("VENDOR_UPDATE_START", "Updating vendor profile", { vendorId });

    // 1. Build the dynamic endpoint
    const endpoint = API_ENDPOINTS.VENDORS.UPDATE.replace(":id", vendorId);

    try {
      // 2. Perform the PATCH request with the JSON data
      const response = await axios.patch(endpoint, data); // Axios sends this as JSON

      // debugLog("VENDOR_UPDATE_SUCCESS", "Vendor updated successfully", { vendorId });

      // Correct toast usage
      toastAlert.success(SUCCESS_MESSAGES.VENDOR_UPDATED);
      return response.data;
    } catch (error) {
      // debugLog("VENDOR_UPDATE_ERROR", "Failed to update vendor", {
      //     vendorId,
      //     httpStatus: error.response?.status
      // });

      const message =
        error.response?.data?.message || ERROR_MESSAGES.UPDATE_VENDOR_FAILED;
      // Correct toast usage
      toastAlert.error(message);
      return rejectWithValue({ message });
    }
  }
);
