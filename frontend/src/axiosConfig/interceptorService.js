// frontend/src/axiosConfig/interceptorService.js
import {
  getAccessTokenFromCookies,
  getRefreshTokenFromCookies,
  scheduleTokenRefresh,
  clearRefreshTimer,
  clearAuthCookies,
  isTokenValid,
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
    `${styles[category] || "📋"} [${category}] ${message}`,
    Object.keys(data).length ? data : "",
  );
};

// === CONFIGURATION ===
// Auth endpoints that should NOT trigger token refresh
const AUTH_ENDPOINTS = ["/auth/login", "/auth/signup", "/auth/refresh"];

const MAX_QUEUE_SIZE = 50;

// === TOKEN REFRESH STATE ===
let isRefreshing = false;
let refreshPromise = null;
let failedQueue = [];


const addToQueue = (resolve, reject) => {
  if (failedQueue.length >= MAX_QUEUE_SIZE) {
    debugLog("ERROR", "Request queue full - rejecting new requests", {
      queueSize: failedQueue.length,
    });
    reject(new Error("REQUEST_QUEUE_OVERFLOW"));
    return false;
  }

  failedQueue.push({ resolve, reject });
  return true;
};

const processQueue = (error, token = null) => {
  debugLog("QUEUE", `Processing ${failedQueue.length} queued requests`, {
    hasError: !!error,
    hasToken: !!token,
  });

  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// === CLEAR AUTH & REDIRECT TO LOGIN ===
const clearAuthAndRedirect = () => {
  debugLog("REDIRECT", "Clearing auth state");

  // Always clear the data
  clearAuthCookies();
  clearRefreshTimer();
  isRefreshing = false;
  refreshPromise = null;
  processQueue(new Error("AUTH_CLEARED"), null);

  if (typeof window !== "undefined") {
    const currentPath = window.location.pathname;

    // 1. Define only the routes that REQUIRE a redirect
    const PROTECTED_ROUTES = ["/dashboard", "/create-events"];
    
    // Check if current path starts with any protected route
    const isProtected = PROTECTED_ROUTES.some(route => 
      currentPath === route || currentPath.startsWith(`${route}/`)
    );

    if (isProtected) {
      const loginUrl = `/account/auth/login?callbackUrl=${encodeURIComponent(currentPath)}`;
      
      debugLog("REDIRECT", "Protected route detected, forcing login", { to: loginUrl });
      window.location.href = loginUrl;
    } else {
      debugLog("REDIRECT", "Public route detected, staying on page");
      // Optional: window.location.reload(); // Refresh to update UI to "Logged Out" state
    }
  }
};

// === TOKEN REFRESH FUNCTION ===
const performTokenRefresh = async (backendInstance) => {
  debugLog("REFRESH", "Starting token refresh");

  const refreshToken = getRefreshTokenFromCookies();

  if (!refreshToken) {
    debugLog("ERROR", "No refresh token available");
    throw new Error("NO_REFRESH_TOKEN");
  }

  try {
    // Call refresh endpoint (backend sets httpOnly cookies)
    const response = await backendInstance.post("/auth/refresh", {
      refresh_token: refreshToken,
    });

    debugLog("SUCCESS", "Token refresh successful", {
      status: response.status,
    });

    // Verify new token was set
    const newAccessToken = getAccessTokenFromCookies();
    if (!newAccessToken) {
      throw new Error("NO_NEW_TOKEN_AFTER_REFRESH");
    }

    // Schedule next proactive refresh
    scheduleTokenRefresh();

    // Notify app of token refresh
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tokenRefreshed", {
          detail: { timestamp: Date.now() },
        }),
      );
    }

    return newAccessToken;
  } catch (error) {
    debugLog("ERROR", "Token refresh failed", {
      status: error.response?.status,
      code: error.response?.data?.code,
      message: error.message,
    });
    throw error;
  }
};

// === RESPONSE INTERCEPTOR ===
export const createResponseInterceptor = (backendInstance) => {
  return async (error) => {
    const originalRequest = error.config;

    // Log all errors in dev
    if (IS_DEV && error.response) {
      debugLog("ERROR", "Request failed", {
        status: error.response.status,
        url: originalRequest?.url,
        method: originalRequest?.method?.toUpperCase(),
        code: error.response?.data?.code,
      });
    }

    // ================================================================
    // CASE 1: NOT A 401 ERROR - Pass through
    // ================================================================
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    debugLog("INTERCEPTOR", "401 Unauthorized detected", {
      url: originalRequest?.url,
      method: originalRequest?.method,
    });

    // ================================================================
    // CASE 2: AUTH ENDPOINTS - Don't retry
    // ================================================================
    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) =>
      originalRequest.url?.includes(endpoint),
    );

    if (isAuthEndpoint) {
      debugLog("INTERCEPTOR", "Auth endpoint failed - not retrying");

      // If it's the refresh endpoint failing, clear auth
      if (originalRequest.url?.includes("/auth/refresh")) {
        isRefreshing = false;
        refreshPromise = null;
        processQueue(error, null);
      }

      return Promise.reject(error);
    }

    // ================================================================
    // CASE 3: ALREADY RETRIED - Don't retry again
    // ================================================================
    if (originalRequest._retry) {
      debugLog("INTERCEPTOR", "Request already retried - clearing auth");
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    // ================================================================
    // CASE 4: TOKEN REFRESH IN PROGRESS - Queue this request
    // ================================================================
    if (isRefreshing && refreshPromise) {
      debugLog("QUEUE", "Refresh in progress - queueing request");

      return new Promise((resolve, reject) => {
        if (!addToQueue(resolve, reject)) {
          return Promise.reject(new Error("Too many pending requests"));
        }
      })
        .then(() => {
          // Attach new token and retry
          const newAccessToken = getAccessTokenFromCookies();
          if (newAccessToken) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          originalRequest._retry = true;

          debugLog("QUEUE", "Retrying queued request", {
            url: originalRequest.url,
          });

          return backendInstance(originalRequest);
        })
        .catch((err) => {
          debugLog("ERROR", "Queued request failed after refresh", {
            url: originalRequest.url,
          });
          return Promise.reject(err);
        });
    }

    // ================================================================
    // CASE 5: ATTEMPT TOKEN REFRESH
    // ================================================================
    originalRequest._retry = true;
    isRefreshing = true;

    debugLog("REFRESH", "Initiating token refresh flow");

    // Create refresh promise to share with queued requests
    refreshPromise = performTokenRefresh(backendInstance)
      .then((newAccessToken) => {
        // Reset state
        isRefreshing = false;
        refreshPromise = null;

        // Process queued requests
        processQueue(null, newAccessToken);

        // Attach new token to original request
        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        debugLog("SUCCESS", "Retrying original request with new token");

        // Retry original request
        return backendInstance(originalRequest);
      })
      .catch((refreshError) => {
        // Reset state
        isRefreshing = false;
        refreshPromise = null;

        // Fail all queued requests
        processQueue(refreshError, null);

        debugLog("ERROR", "Refresh failed - clearing auth", {
          error: refreshError.message,
          status: refreshError.response?.status,
        });

        // Clear auth and redirect
        clearAuthAndRedirect();

        return Promise.reject(refreshError);
      });

    return refreshPromise;
  };
};

// === REQUEST INTERCEPTOR ===
export const createRequestInterceptor = () => {
  return (config) => {
    // Optional: Add request ID for tracking
    if (IS_DEV) {
      config.metadata = { startTime: Date.now() };
    }

    return config;
  };
};
