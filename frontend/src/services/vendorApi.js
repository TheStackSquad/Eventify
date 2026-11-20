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

// Go binds snake_case (VendorBinding). Convert here so the app stays camelCase, and so
// identity/business flags can never be sent: the server derives them from the proofs.
export function toBackendVendorPayload(p = {}) {
  return {
    name: p.name,
    category: p.category,
    description: p.description ?? "",
    image_url: p.imageURL ?? p.image_url ?? "",
    state: p.state,
    city: p.city ?? "",
    phone_number: p.phoneNumber ?? p.phone_number ?? "",
    min_price: p.minPrice ?? p.min_price ?? 0,
    first_name: p.firstName ?? p.first_name ?? "",
    middle_name: p.middleName ?? p.middle_name ?? "",
    last_name: p.lastName ?? p.last_name ?? "",
    vnin_proof: p.vninProof ?? p.vnin_proof ?? "",
    cac_proof: p.cacProof ?? p.cac_proof ?? "",
  };
}

// Register new vendor
export async function registerVendorApi(vendorData) {
  const response = await backendInstance.post(
    API_ENDPOINTS.VENDORS.REGISTER,
    vendorData,
    { timeout: 15000 }
  );
  return response.data;
}

// Update existing vendor
export async function updateVendorApi({ vendorId, vendorData }) {
  const endpoint = replaceUrlParams(API_ENDPOINTS.VENDORS.UPDATE, {
    id: vendorId,
  });
  
  const response = await backendInstance.patch(endpoint, vendorData);
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
    const response = await backendInstance.get(
      API_ENDPOINTS.VENDORS.ANALYTICS.HEALTH,
    );
    return response.data;
  } catch (error) {
    console.error("❌ Analytics Health Check Failed:", error.message);
    throw error;
  }
}


// Authenticated + rate limited on the server; the public API no longer needs to carry the number.
export async function revealVendorPhoneApi(vendorId) {
  const base = replaceUrlParams(API_ENDPOINTS.VENDORS.GET_PROFILE, { id: vendorId });
  const response = await backendInstance.get(`${base}/contact`);
  return response.data.phoneNumber;
}

// The signed-in owner's own profile, with owner-only fields (phone, vninLast4).
export async function fetchMyVendorApi(signal) {
  const response = await backendInstance.get(`${API_ENDPOINTS.VENDORS.LIST}/me`, { signal });
  return response.data;
}