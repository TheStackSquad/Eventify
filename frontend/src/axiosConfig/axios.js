// src/axiosConfig/axios.js
import axios from "axios";
import { API_ENDPOINTS } from "@/utils/constants/globalConstants";
import { createResponseInterceptor } from "./interceptorService";
import { setBackendInstanceRef } from "./tokenService";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
const IS_DEV = process.env.NODE_ENV === "development";

if (IS_DEV) console.log("Axios Base URL:", API_BASE_URL);

const getCSRFToken = () => {
  if (typeof document === "undefined") return null; // SSR safety
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "csrf_token") return decodeURIComponent(value);
  }
  return null;
};

const dispatchCSRFError = (code, message) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("csrfError", { detail: { code, message } }),
  );
};

const handleCSRFError = (error) => {
  const code = error.response?.data?.code;
  if (code === "CSRF_TOKEN_MISSING" || code === "CSRF_TOKEN_INVALID") {
    console.error("🚨 [CSRF] Protection Error:", {
      code,
      message: error.response.data.message,
      url: error.config?.url,
    });
    dispatchCSRFError(code, error.response.data.message);
    return true; // was a CSRF error
  }
  return false;
};

// ================================================================
// INJECT STATIC AXIOS METHODS ONTO INSTANCE
// ================================================================
const injectStaticMethods = (instance) => {
  instance.isCancel = axios.isCancel;
  instance.CancelToken = axios.CancelToken;
  instance.isAxiosError = axios.isAxiosError;
  return instance;
};

// ================================================================
// BACKEND INSTANCE — communicates with Go Gin server
// ================================================================
export const backendInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});
injectStaticMethods(backendInstance);

// ================================================================
// FRONTEND INSTANCE — communicates with Next.js API routes
// ================================================================
export const frontendInstance = axios.create({
  baseURL: "",
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});
injectStaticMethods(frontendInstance);

// ================================================================
// BACKEND REQUEST INTERCEPTOR — CSRF injection
// ================================================================
backendInstance.interceptors.request.use(
  (config) => {
    const stateChangingMethods = ["POST", "PUT", "PATCH", "DELETE"];
    if (stateChangingMethods.includes(config.method?.toUpperCase())) {
      const csrfToken = getCSRFToken();
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
        if (IS_DEV) {
          console.log(
            `🛡️ [CSRF] Token attached to ${config.method?.toUpperCase()} ${config.url}`,
          );
        }
      } else if (IS_DEV) {
        console.warn(
          `⚠️ [CSRF] No token found for ${config.method?.toUpperCase()} ${config.url}`,
        );
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ================================================================
// BACKEND RESPONSE INTERCEPTOR — token refresh + CSRF errors
// ✅ FIX #2: CSRF error handling is NOW on backendInstance
// so login/signup CSRF failures are properly handled.
// ================================================================
backendInstance.interceptors.response.use(
  (response) => {
    if (IS_DEV) {
      console.log("Backend Success:", {
        status: response.status,
        url: response.config.url,
      });
    }
    return response;
  },
  (error) => {
    // ✅ FIX: Check for CSRF errors on backend responses (login, signup, etc.)
    handleCSRFError(error);

    // Delegate 401 handling + token refresh to interceptorService
    return createResponseInterceptor(backendInstance)(error);
  },
);

// ================================================================
// FRONTEND RESPONSE INTERCEPTOR — basic error handling
// ================================================================
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
    // CSRF errors on frontend routes (e.g. Vercel Blob uploads)
    handleCSRFError(error);

    console.error("Frontend API Error:", {
      status: error.response?.status,
      url: error.config?.url,
      message: error.response?.data?.error || error.message,
    });
    return Promise.reject(error);
  },
);

// Give tokenService a reference to backendInstance for proactive refresh calls
setBackendInstanceRef(backendInstance);

export default backendInstance;
export const ENDPOINTS = { ...API_ENDPOINTS };
