// frontend/src/services/vendorApi.js
import backendInstance from "@/axiosConfig/axios";
import {
  API_ENDPOINTS,
  replaceUrlParams,
} from "@/utils/constants/globalConstants";

// Fetch vendors with pagination and filters
export async function fetchVendorsApi(filters = {}, signal) {
  const queryParams = new URLSearchParams({
    page: filters.page || 1,
    limit: filters.limit || 12,
    ...filters,
  });

  const response = await backendInstance.get(
    `${API_ENDPOINTS.VENDORS.LIST}?${queryParams}`,
    { signal }
  );

  return {
    vendors: response.data.vendors || [],
    pagination: response.data.pagination || { totalCount: 0 },
  };
}

// Fetch single vendor profile
export async function fetchVendorProfileApi(vendorId, signal) {
  const endpoint = replaceUrlParams(API_ENDPOINTS.VENDORS.GET_PROFILE, {
    id: vendorId,
  });
  const response = await backendInstance.get(endpoint, { signal });
  return response.data;
}

// Register new vendor with extended timeout
export async function registerVendorApi(vendorData) {
  const response = await backendInstance.post(
    API_ENDPOINTS.VENDORS.REGISTER,
    vendorData,
    { timeout: 15000 }
  );
  return response.data;
}

// Update existing vendor
export async function updateVendorApi({ vendorId, data }) {
  const endpoint = replaceUrlParams(API_ENDPOINTS.VENDORS.UPDATE, {
    id: vendorId,
  });
  const response = await backendInstance.patch(endpoint, data);
  return response.data;
}

// Fetch vendor analytics with enhanced error handling
export async function fetchVendorAnalyticsApi(vendorId) {
  if (!vendorId || vendorId === ":id") {
    throw new Error("Vendor ID is required for analytics.");
  }

  const url = replaceUrlParams(API_ENDPOINTS.VENDORS.ANALYTICS.OVERVIEW, {
    id: vendorId,
  });

  try {
    const response = await backendInstance.get(url, {
      withCredentials: true,
      timeout: 10000,
    });

    if (response.data?.status === "success") {
      return response.data.data;
    }

    return response.data;
  } catch (error) {
    console.error("❌ Analytics API Error:", {
      vendorId,
      url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });

    throw new Error(
      error.response?.data?.message ||
        `Failed to fetch analytics for vendor ${vendorId}`
    );
  }
}

// Check analytics service health status
export async function checkAnalyticsHealthApi() {
  try {
    const response = await axios.get(API_ENDPOINTS.VENDORS.ANALYTICS.HEALTH);
    return response.data;
  } catch (error) {
    console.error("❌ Analytics Health Check Failed:", error.message);
    throw error;
  }
}
