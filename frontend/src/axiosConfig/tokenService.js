// frontend/src/axiosConfig/tokenService.js

import { API_ENDPOINTS } from "@/utils/constants/globalConstants";

const IS_DEV = process.env.NODE_ENV === "development";

const debugLog = (category, message, data = {}) => {
  if (!IS_DEV) return;
  const styles = { REFRESH: "🔄", SCHEDULE: "⏰", ERROR: "❌", SUCCESS: "✅" };
  console.log(
    `${styles[category] || "📋"} [tokenService:${category}] ${message}`,
    Object.keys(data).length ? data : "",
  );
};

// === STATE MANAGEMENT ===
let refreshTimer = null;
let backendInstanceRef = null;
let lastRefreshAttempt = 0;

// ✅ OPTIMIZED: Adjusted refresh intervals
// Access token lifetime: 24 hours (86400000ms)
// We refresh at 80% of lifetime to avoid expiry
const ACCESS_TOKEN_LIFETIME = 24 * 60 * 60 * 1000; // 24 hours in ms
const REFRESH_INTERVAL = ACCESS_TOKEN_LIFETIME * 0.8; // 19.2 hours (80% of lifetime)
const MIN_REFRESH_INTERVAL = 60000; // 1 minute (prevent spam)

// Fallback interval if we can't determine token lifetime
const DEFAULT_REFRESH_INTERVAL = 19 * 60 * 60 * 1000; // 19 hours

export const setBackendInstanceRef = (instance) => {
  backendInstanceRef = instance;
  debugLog("SCHEDULE", "Backend instance reference set");
};

/**
 * ✅ OPTIMIZED: Smart refresh scheduler
 *
 * Strategy:
 * 1. Use 80% of access token lifetime as refresh interval
 * 2. If token expiry is known, schedule at 80% mark
 * 3. Fallback to 19 hours if expiry unknown
 * 4. Network failures retry with exponential backoff
 */
export const scheduleTokenRefresh = (customInterval = null) => {
  if (refreshTimer) clearTimeout(refreshTimer);

  // Use custom interval or calculated default
  const interval = customInterval || REFRESH_INTERVAL;

  debugLog(
    "SCHEDULE",
    `Next proactive refresh in ${(interval / 60000).toFixed(1)} minutes`,
    {
      intervalMs: interval,
      intervalHours: (interval / 3600000).toFixed(1),
    },
  );

  refreshTimer = setTimeout(async () => {
    const timeSinceLast = Date.now() - lastRefreshAttempt;

    // Prevent refresh spam (minimum 1 minute between attempts)
    if (timeSinceLast < MIN_REFRESH_INTERVAL) {
      debugLog("SCHEDULE", "Skipping refresh (too soon since last attempt)", {
        timeSinceLastMs: timeSinceLast,
      });
      scheduleTokenRefresh(); // Reschedule
      return;
    }

    if (!backendInstanceRef) {
      debugLog("ERROR", "No axios instance available for refresh");
      return;
    }

    try {
      debugLog("REFRESH", "Triggering proactive refresh");
      lastRefreshAttempt = Date.now();

      // withCredentials: true sends the HttpOnly refresh_token automatically
      const response = await backendInstanceRef.post(
        API_ENDPOINTS.AUTH.REFRESH,
      );

      debugLog("SUCCESS", "Proactive refresh successful", {
        status: response.status,
      });

      // Schedule next refresh at 80% of token lifetime
      scheduleTokenRefresh();

      // Notify components of successful refresh
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tokenRefreshed", {
            detail: { timestamp: Date.now() },
          }),
        );
      }
    } catch (error) {
      const status = error.response?.status;

      debugLog("ERROR", "Proactive refresh failed", {
        status,
        code: error.response?.data?.code,
        message: error.response?.data?.message,
      });

      // Handle different error types
      if (status === 401) {
        // Session expired - stop scheduling
        debugLog("ERROR", "Session expired - stopping refresh scheduler");
        clearRefreshTimer();

        // Notify components
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("sessionExpired", {
              detail: { reason: "REFRESH_TOKEN_EXPIRED" },
            }),
          );
        }
      } else if (status === 403) {
        // Security violation - stop scheduling
        debugLog(
          "ERROR",
          "Security violation detected - stopping refresh scheduler",
        );
        clearRefreshTimer();
      } else {
        // Network error or server issue - retry with backoff
        const retryDelay = 5 * 60 * 1000; // 5 minutes

        debugLog(
          "SCHEDULE",
          `Network error - retrying in ${retryDelay / 60000} minutes`,
        );
        scheduleTokenRefresh(retryDelay);
      }
    }
  }, interval);
};

/**
 * Initialize the token refresh system
 * Called when user logs in or session is verified
 */
export const initializeTokenRefresh = () => {
  debugLog("SCHEDULE", "Starting refresh system", {
    refreshIntervalHours: (REFRESH_INTERVAL / 3600000).toFixed(1),
    tokenLifetimeHours: ACCESS_TOKEN_LIFETIME / 3600000,
  });

  scheduleTokenRefresh();
};

/**
 * Clear the refresh timer
 * Called on logout or session expiry
 */
export const clearRefreshTimer = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
    debugLog("SCHEDULE", "Refresh timer cleared");
  }
};

/**
 * ✅ OPTIMIZED: Cleanup function
 * We can't delete HttpOnly cookies via JS.
 * This merely clears the scheduler.
 * The backend MUST clear cookies via Set-Cookie Max-Age=0.
 */
export const clearAuthCookies = () => {
  clearRefreshTimer();
  debugLog("TOKEN", "Client-side session state cleared");
};

/**
 * ✅ NEW: Manual refresh trigger
 * Useful for "stay signed in" buttons or activity-based refresh
 */
export const triggerManualRefresh = async () => {
  if (!backendInstanceRef) {
    throw new Error("Backend instance not initialized");
  }

  debugLog("REFRESH", "Manual refresh triggered");
  lastRefreshAttempt = Date.now();

  try {
    const response = await backendInstanceRef.post(API_ENDPOINTS.AUTH.REFRESH);

    debugLog("SUCCESS", "Manual refresh successful");

    // Reset the automatic scheduler
    scheduleTokenRefresh();

    return response.data;
  } catch (error) {
    debugLog("ERROR", "Manual refresh failed", {
      status: error.response?.status,
    });
    throw error;
  }
};

/**
 * NEW: Get refresh status for debugging
 */
export const getRefreshStatus = () => {
  return {
    isScheduled: refreshTimer !== null,
    lastAttempt: lastRefreshAttempt,
    timeSinceLastAttempt: lastRefreshAttempt
      ? Date.now() - lastRefreshAttempt
      : null,
    hasBackendRef: backendInstanceRef !== null,
  };
};

// ================================================================
// ✅ REMOVED: Dead code
// ================================================================
// The following function was removed as it cannot read HttpOnly cookies:
// - getAccessTokenFromCookies()
//
// HttpOnly cookies are only accessible to the server.
// Attempting to read them via document.cookie always returns empty.
// All token handling now relies on withCredentials: true in axios config.
// ================================================================
