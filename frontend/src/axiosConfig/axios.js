// frontend/src/axiosConfig/axios.js

import axios from "axios";
import {
  API_ENDPOINTS,
  REDIRECT_PATHS,
} from "@/utils/constants/globalConstants";

// ============================================
// CONFIGURATION
// ============================================
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

console.log("Axios Base URL set to:", API_BASE_URL);

// ============================================
// HELPER FUNCTIONS
// ============================================

// Reading cookies is necessary here because the backend instance
// communicates directly with the API on a different port,
// and the browser automatically sends the cookies.
const getAccessTokenFromCookies = () => {
  if (typeof document === "undefined") return null;
  const cookieMatch = document.cookie.match(/access_token=([^;]+)/);
  return cookieMatch ? cookieMatch[1] : null;
};

const getRefreshTokenFromCookies = () => {
  if (typeof document === "undefined") return null;
  const cookieMatch = document.cookie.match(/refresh_token=([^;]+)/);
  return cookieMatch ? cookieMatch[1] : null;
};

// ❌ REMOVED: redirectToLogin() function - Handled by React Query / SessionProvider now.

// ============================================
// TOKEN REFRESH QUEUE
// ============================================
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ============================================
// BACKEND API INSTANCE (Go Server)
// ============================================
const backendInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  }, // Crucial for sending/receiving HTTP-only cookies
  withCredentials: true,
});

// Backend Request Interceptor
backendInstance.interceptors.request.use(
  (config) => {
    // Add Authorization header if token exists
    const accessToken = getAccessTokenFromCookies();
    if (accessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    } // Debug logging

    console.log("📤 [BACKEND API REQUEST]", {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      withCredentials: config.withCredentials,
      hasAuthHeader: !!config.headers.Authorization,
    }); // Logging payload details (keep this condensed for production)
    if (config.data) {
      console.log("📦 [BACKEND API PAYLOAD]", {
        dataType: typeof config.data,
        dataKeys: Object.keys(config.data || {}),
        dataSample: JSON.stringify(config.data).substring(0, 200) + "...",
      });
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Backend Response Interceptor
backendInstance.interceptors.response.use(
  (response) => {
    console.log("📥 [BACKEND API SUCCESS]", {
      status: response.status,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
      data: response.data,
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    console.log("❌ [BACKEND API ERROR]", {
      status: error.response?.status,
      url: originalRequest?.url,
      method: originalRequest?.method?.toUpperCase(),
      data: error.response?.data,
    }); // Prevent handling non-401 errors or already retried requests

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    } // Prevent refresh loop on refresh endpoint itself

    if (originalRequest.url === API_ENDPOINTS.AUTH.REFRESH) {
      isRefreshing = false;
      processQueue(error, null); // ❌ REMOVED: redirectToLogin(); - Let the promise reject
      return Promise.reject(error);
    } // Handle concurrent requests during refresh

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => backendInstance(originalRequest))
        .catch((err) => Promise.reject(err));
    } // Attempt token refresh

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      console.log("🔄 Attempting token refresh...");

      const refreshToken = getRefreshTokenFromCookies();
      if (!refreshToken) {
        throw new Error("No refresh token found");
      } // The post call will update the access_token cookie automatically

      await backendInstance.post(API_ENDPOINTS.AUTH.REFRESH, {
        refresh_token: refreshToken,
      });

      console.log("✅ Token refresh successful");
      isRefreshing = false;
      processQueue(null, true); // Update Authorization header for the retried request

      const newAccessToken = getAccessTokenFromCookies();
      if (newAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      } // Retry the failed request with the new token

      return backendInstance(originalRequest);
    } catch (refreshError) {
      console.error("❌ Token refresh failed:", refreshError);
      isRefreshing = false;
      processQueue(refreshError, null); // ❌ REMOVED: redirectToLogin(); - Let the promise reject
      return Promise.reject(refreshError);
    }
  }
);

// ============================================
// FRONTEND API INSTANCE (Next.js API Routes)
// ============================================
const frontendInstance = axios.create({
  baseURL: "", // Empty string = same origin (localhost:3000)
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Frontend Request Interceptor (Simplified)
frontendInstance.interceptors.request.use(
  (config) => {
    console.log("📤 [FRONTEND API REQUEST]", {
      method: config.method?.toUpperCase(),
      url: config.url,
      hasFile: config.data instanceof FormData,
    });

    return config;
  },
  (error) => Promise.reject(error)
);

// Frontend Response Interceptor (Simplified)
frontendInstance.interceptors.response.use(
  (response) => {
    console.log("📥 [FRONTEND API SUCCESS]", {
      status: response.status,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
    });
    return response;
  },
  (error) => {
    console.error("❌ [FRONTEND API ERROR]", {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

// ============================================
// EXPORTS
// ============================================
export default backendInstance; // Default export for backend API
export { frontendInstance }; // Named export for frontend API routes
export const ENDPOINTS = { ...API_ENDPOINTS };
