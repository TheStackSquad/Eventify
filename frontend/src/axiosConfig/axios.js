// frontend/src/axiosConfig/axios.js
import axios from "axios";
import { API_ENDPOINTS } from "@/utils/constants/globalConstants";
import { createResponseInterceptor } from "./interceptorService";
import {
  getAccessTokenFromCookies,
  setBackendInstanceRef,
} from "./tokenService";

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
console.log("Axios Base URL:", API_BASE_URL);

/**
 * BACKEND API INSTANCE
 * For communication with the backend server
 */
export const backendInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// 🔧 FIX: Copy static methods from original axios to the instance
backendInstance.isCancel = axios.isCancel;
backendInstance.CancelToken = axios.CancelToken;
backendInstance.isAxiosError = axios.isAxiosError;

/**
 * FRONTEND API INSTANCE
 * For frontend-only API calls (e.g., local Next.js API routes)
 */
export const frontendInstance = axios.create({
  baseURL: "", // Empty baseURL for same-origin requests
  timeout: 30000,
  withCredentials: true,
});

// 🔧 FIX: Also copy static methods to frontend instance
frontendInstance.isCancel = axios.isCancel;
frontendInstance.CancelToken = axios.CancelToken;
frontendInstance.isAxiosError = axios.isAxiosError;

// === BACKEND INTERCEPTORS ===
// Request interceptor for logging and auth header
backendInstance.interceptors.request.use(
  (config) => {
    const accessToken = getAccessTokenFromCookies();
    if (accessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    console.log("Backend Request:", {
      method: config.method?.toUpperCase(),
      url: config.url,
      fullURL: `${config.baseURL}${config.url}`,
      hasAuth: !!config.headers.Authorization,
    });

    if (config.data) {
      console.log("Request Payload:", {
        dataType: typeof config.data,
        dataKeys: Object.keys(config.data || {}),
      });
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - using external service
backendInstance.interceptors.response.use(
  (response) => {
    console.log("Backend Success:", {
      status: response.status,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
    });

    // Schedule refresh after successful login or refresh
    if (
      response.config.url === API_ENDPOINTS.AUTH.REFRESH ||
      response.config.url === API_ENDPOINTS.AUTH.LOGIN
    ) {
      // This will be handled by tokenService
    }

    return response;
  },
  createResponseInterceptor(backendInstance) // Externalized interceptor
);

// === FRONTEND INTERCEPTORS ===
// Basic logging interceptors only
frontendInstance.interceptors.request.use(
  (config) => {
    console.log("Frontend Request:", {
      method: config.method?.toUpperCase(),
      url: config.url,
    });
    return config;
  },
  (error) => Promise.reject(error)
);

frontendInstance.interceptors.response.use(
  (response) => {
    console.log("Frontend Success:", {
      status: response.status,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
    });
    return response;
  },
  (error) => {
    console.error("Frontend Error:", {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
    });
    return Promise.reject(error);
  }
);

// Set backend instance reference for token service
setBackendInstanceRef(backendInstance);

// Exports
export default backendInstance;
//export { frontendInstance };
export const ENDPOINTS = { ...API_ENDPOINTS };
