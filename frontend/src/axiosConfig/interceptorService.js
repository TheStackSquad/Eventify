// frontend/src/axiosConfig/interceptorService.js

import {
  scheduleTokenRefresh,
  clearRefreshTimer,
  clearAuthCookies,
} from "./tokenService";

const IS_DEV = process.env.NODE_ENV === "development";

// === DEBUG LOGGING ===
const debugLog = (category, message, data = {}) => {
  if (!IS_DEV) return;
  const styles = {
    INTERCEPTOR: "🛡️",
    REFRESH: "🔄",
    ERROR: "❌",
    SUCCESS: "✅",
    QUEUE: "⏳",
    REDIRECT: "🚪",
  };
  console.log(
    `${styles[category] || "📋"} [interceptor:${category}] ${message}`,
    Object.keys(data).length ? data : "",
  );
};

const AUTH_ENDPOINTS = ["/auth/login", "/auth/signup", "/auth/refresh"];
const MAX_QUEUE_SIZE = 50;
const REFRESH_TIMEOUT = 10000; // 10 seconds max for refresh

let isRefreshing = false;
let refreshPromise = null;
let failedQueue = [];

// ✅ IMPROVED: Queue management with timeout
const addToQueue = (resolve, reject, timeout = REFRESH_TIMEOUT) => {
  if (failedQueue.length >= MAX_QUEUE_SIZE) {
    debugLog("ERROR", "Queue overflow - rejecting request", {
      queueSize: failedQueue.length,
    });
    reject(new Error("REQUEST_QUEUE_OVERFLOW"));
    return false;
  }

  // Add timeout to queued requests
  const timeoutId = setTimeout(() => {
    const index = failedQueue.findIndex((p) => p.timeoutId === timeoutId);
    if (index !== -1) {
      failedQueue.splice(index, 1);
      reject(new Error("REFRESH_TIMEOUT"));
    }
  }, timeout);

  failedQueue.push({ resolve, reject, timeoutId });

  debugLog("QUEUE", "Request queued", {
    queueSize: failedQueue.length,
  });

  return true;
};

// ✅ IMPROVED: Process queue with cleanup
const processQueue = (error) => {
  debugLog("QUEUE", `Processing ${failedQueue.length} queued requests`, {
    hasError: !!error,
  });

  failedQueue.forEach((prom) => {
    // Clear timeout
    if (prom.timeoutId) {
      clearTimeout(prom.timeoutId);
    }

    // Resolve or reject
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });

  failedQueue = [];
};

// ✅ IMPROVED: Centralized auth cleanup with better logging
const clearAuthAndRedirect = (reason = "UNAUTHORIZED") => {
  debugLog("REDIRECT", `Clearing auth and redirecting`, { reason });

  clearAuthCookies();
  clearRefreshTimer();
  isRefreshing = false;
  refreshPromise = null;
  processQueue(new Error(reason));

  if (typeof window !== "undefined") {
    const currentPath = window.location.pathname;
    const PROTECTED_ROUTES = ["/dashboard", "/create-events", "/vendor"];

    const isProtected = PROTECTED_ROUTES.some(
      (route) => currentPath === route || currentPath.startsWith(`${route}/`),
    );

    if (isProtected) {
      debugLog("REDIRECT", "Redirecting to login", { from: currentPath });

      // Dispatch custom event for components to react to auth loss
      window.dispatchEvent(
        new CustomEvent("authExpired", {
          detail: { reason, originalPath: currentPath },
        }),
      );

      window.location.href = `/account/auth/login?callbackUrl=${encodeURIComponent(currentPath)}`;
    }
  }
};

// === REFRESH FUNCTION ===
const performTokenRefresh = async (backendInstance) => {
  debugLog("REFRESH", "Initiating silent token refresh via HttpOnly cookies");

  try {
    // No body needed; browser sends refresh_token cookie automatically
    const response = await backendInstance.post("/auth/refresh");

    debugLog("SUCCESS", "Token refresh successful", {
      status: response.status,
    });

    // Schedule next refresh
    scheduleTokenRefresh();

    // Notify components
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tokenRefreshed", {
          detail: { timestamp: Date.now() },
        }),
      );
    }

    return response;
  } catch (error) {
    const status = error.response?.status;
    const code = error.response?.data?.code;

    debugLog("ERROR", "Refresh call failed", { status, code });

    // ✅ IMPROVED: Distinguish between different error types
    if (status === 401) {
      throw new Error("REFRESH_TOKEN_EXPIRED");
    } else if (status === 403 || code === "SECURITY_VIOLATION") {
      throw new Error("TOKEN_REUSE_DETECTED");
    } else {
      throw new Error("REFRESH_NETWORK_ERROR");
    }
  }
};

// === RESPONSE INTERCEPTOR ===
export const createResponseInterceptor = (backendInstance) => {
  return async (error) => {
    const originalRequest = error.config;

    // ✅ IMPROVED: Better error information logging
    if (IS_DEV && error.response) {
      debugLog("INTERCEPTOR", "Request failed", {
        url: originalRequest.url,
        status: error.response.status,
        method: originalRequest.method,
      });
    }

    // Only handle 401 errors
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Don't retry auth endpoints to avoid loops
    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) =>
      originalRequest.url?.includes(endpoint),
    );

    if (isAuthEndpoint) {
      if (originalRequest.url?.includes("/auth/refresh")) {
        debugLog("ERROR", "Refresh endpoint returned 401 - session dead");
        isRefreshing = false;
        refreshPromise = null;
        processQueue(new Error("REFRESH_FAILED"));
        clearAuthAndRedirect("REFRESH_TOKEN_INVALID");
      }
      return Promise.reject(error);
    }

    // ✅ IMPROVED: Prevent infinite retry loops
    if (originalRequest._retry) {
      debugLog("ERROR", "Request already retried - giving up");
      clearAuthAndRedirect("RETRY_EXHAUSTED");
      return Promise.reject(error);
    }

    // Handle concurrent requests during refresh
    if (isRefreshing) {
      debugLog("QUEUE", "Refresh in progress, queuing request");

      return new Promise((resolve, reject) => {
        if (!addToQueue(resolve, reject)) {
          return reject(new Error("QUEUE_OVERFLOW"));
        }
      })
        .then(() => {
          debugLog("QUEUE", "Retrying queued request", {
            url: originalRequest.url,
          });
          return backendInstance(originalRequest);
        })
        .catch((queueError) => {
          debugLog("ERROR", "Queued request failed", {
            error: queueError.message,
          });
          return Promise.reject(queueError);
        });
    }

    // ✅ IMPROVED: Start refresh with proper state management
    originalRequest._retry = true;
    isRefreshing = true;

    debugLog("REFRESH", "Starting token refresh flow", {
      queuedRequests: failedQueue.length,
    });

    refreshPromise = performTokenRefresh(backendInstance)
      .then(() => {
        debugLog("SUCCESS", "Refresh completed - processing queue");

        isRefreshing = false;
        refreshPromise = null;
        processQueue(null); // Release all queued requests

        return backendInstance(originalRequest);
      })
      .catch((refreshError) => {
        debugLog("ERROR", "Refresh failed - clearing auth", {
          error: refreshError.message,
        });

        isRefreshing = false;
        refreshPromise = null;
        processQueue(refreshError);

        // ✅ IMPROVED: Different handling based on error type
        if (refreshError.message === "TOKEN_REUSE_DETECTED") {
          clearAuthAndRedirect("SECURITY_VIOLATION");
        } else {
          clearAuthAndRedirect("SESSION_EXPIRED");
        }

        return Promise.reject(refreshError);
      });

    return refreshPromise;
  };
};

// ✅ KEPT: Request interceptor (minimal changes)
export const createRequestInterceptor = () => {
  return (config) => {
    // Standard request config; browser handles cookies via withCredentials: true
    if (IS_DEV) {
      debugLog("INTERCEPTOR", "Outgoing request", {
        method: config.method?.toUpperCase(),
        url: config.url,
      });
    }
    return config;
  };
};
