// frontend/src/axiosConfig/axios.js
import axios from "axios";
import { API_ENDPOINTS } from "@/utils/constants/globalConstants";
import { createResponseInterceptor } from "./interceptorService";
import {
  getAccessTokenFromCookies,
  setBackendInstanceRef,
} from "./tokenService";

// --- Configuration ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
const IS_DEV = process.env.NODE_ENV === "development";

if (IS_DEV) console.log("Axios Base URL:", API_BASE_URL);

/**
 * SHARED UTILS & INTERCEPTORS
 */

// Function to attach Bearer token to requests
const attachAuthToken = (config) => {
  const accessToken = getAccessTokenFromCookies();
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  if (IS_DEV) {
    console.log(`${config.baseURL ? "Backend" : "Frontend"} Request:`, {
      method: config.method?.toUpperCase(),
      url: config.url,
      hasAuth: !!config.headers.Authorization,
    });
  }
  return config;
};

// Copy static methods from original axios to an instance
const injectStaticMethods = (instance) => {
  instance.isCancel = axios.isCancel;
  instance.CancelToken = axios.CancelToken;
  instance.isAxiosError = axios.isAxiosError;
  return instance;
};

/**
 * BACKEND API INSTANCE
 * Communicates with the Go Gin server
 */
export const backendInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});
injectStaticMethods(backendInstance);

/**
 * FRONTEND API INSTANCE
 * Communicates with local Next.js API routes (e.g., Vercel Blob)
 */
export const frontendInstance = axios.create({
  baseURL: "", // Empty for same-origin Next.js routes
  timeout: 60000, // Higher timeout for image uploads (60s)
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});
injectStaticMethods(frontendInstance);

// --- APPLY INTERCEPTORS ---

// 1. Request Interceptors (Both instances get Auth Headers)
backendInstance.interceptors.request.use(attachAuthToken, (err) =>
  Promise.reject(err),
);
frontendInstance.interceptors.request.use(attachAuthToken, (err) =>
  Promise.reject(err),
);

// 2. Backend Response Interceptor (Handles token refreshes)
backendInstance.interceptors.response.use((response) => {
  if (IS_DEV) {
    console.log("Backend Success:", {
      status: response.status,
      url: response.config.url,
    });
  }
  /* Note: Proactive refresh scheduling is handled in tokenService via scheduleTokenRefresh */
  return response;
}, createResponseInterceptor(backendInstance));

// 3. Frontend Response Interceptor (Basic error handling)
frontendInstance.interceptors.response.use(
  (response) => {
    if (IS_DEV) {
      console.log("Frontend Success:", {
        status: response.status,
        url: response.config.url,
      });
    }
    return response;
  },
  (error) => {
    console.error("Frontend API Error:", {
      status: error.response?.status,
      url: error.config?.url,
      message: error.response?.data?.error || error.message,
    });
    return Promise.reject(error);
  },
);

// Set reference for tokenService to use backendInstance for refreshes
setBackendInstanceRef(backendInstance);

// --- EXPORTS ---
export default backendInstance;
export const ENDPOINTS = { ...API_ENDPOINTS };
