// frontend/src/axiosConfig/tokenService.js
import { API_ENDPOINTS } from "@/utils/constants/globalConstants";

const IS_DEV = process.env.NODE_ENV === "development";

// === DEBUG LOGGING ===
const debugLog = (category, message, data = {}) => {
  if (!IS_DEV) return;
  
  const styles = {
    TOKEN: '🎫',
    REFRESH: '🔄',
    SCHEDULE: '⏰',
    ERROR: '❌',
    SUCCESS: '✅',
  };
  
  console.log(`${styles[category] || '📋'} [${category}] ${message}`, 
    Object.keys(data).length ? data : '');
};

// === TOKEN RETRIEVAL ===
export const getAccessTokenFromCookies = () => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/access_token=([^;]+)/);
  return match ? match[1] : null;
};

export const getRefreshTokenFromCookies = () => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/refresh_token=([^;]+)/);
  return match ? match[1] : null;
};

// === COOKIE CLEANUP ===
export const clearAuthCookies = () => {
  if (typeof document === "undefined") return;
  
  const cookieOptions = [
    'path=/',
    'max-age=0',
    'SameSite=Lax',
  ];
  
  // Add domain if in production
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    cookieOptions.push(`domain=${window.location.hostname}`);
  }
  
  const cookieString = cookieOptions.join('; ');
  
  document.cookie = `access_token=; ${cookieString}`;
  document.cookie = `refresh_token=; ${cookieString}`;
  
  debugLog('TOKEN', 'Auth cookies cleared');
};

// === JWT DECODING ===
export const decodeJWT = (token) => {
  if (!token || typeof token !== "string") {
    debugLog('ERROR', 'JWT decode failed: Invalid token type', { 
      hasToken: !!token,
      type: typeof token 
    });
    return null;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }
    
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    
    const decoded = JSON.parse(jsonPayload);
    debugLog('TOKEN', 'JWT decoded successfully', { 
      exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'none',
      iat: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : 'none',
    });
    
    return decoded;
  } catch (error) {
    debugLog('ERROR', 'JWT decode error', { error: error.message });
    return null;
  }
};

// === TOKEN VALIDATION ===
export const isTokenValid = (token) => {
  if (!token) return false;
  
  const decoded = decodeJWT(token);
  if (!decoded?.exp) return false;
  
  const now = Date.now();
  const expiry = decoded.exp * 1000;
  const isValid = expiry > now;
  
  debugLog('TOKEN', 'Token validation', {
    isValid,
    expiresIn: `${Math.round((expiry - now) / 1000)}s`,
  });
  
  return isValid;
};

// === TOKEN EXPIRY ===
export const getTokenExpiry = (token) => {
  const decoded = decodeJWT(token);
  return decoded?.exp ? decoded.exp * 1000 : null;
};

export const getTokenTimeRemaining = (token) => {
  const expiry = getTokenExpiry(token);
  if (!expiry) return 0;
  
  return Math.max(0, expiry - Date.now());
};

// === REFRESH SCHEDULING ===
let refreshTimer = null;
let backendInstanceRef = null;
let isRefreshScheduled = false;
let lastRefreshAttempt = 0;

const MIN_REFRESH_INTERVAL = 5000; // Prevent refresh spam (5s)
const REFRESH_BUFFER_MS = 120000; // Refresh 2min before expiry

export const setBackendInstanceRef = (instance) => {
  backendInstanceRef = instance;
  debugLog('SCHEDULE', 'Backend instance reference set');
};

export const scheduleTokenRefresh = () => {
  // Clear existing timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
    isRefreshScheduled = false;
  }

  const token = getAccessTokenFromCookies();
  if (!token) {
    debugLog('SCHEDULE', 'No access token found for scheduling');
    return;
  }

  // Validate token before scheduling
  if (!isTokenValid(token)) {
    debugLog('SCHEDULE', 'Token already expired, not scheduling');
    return;
  }

  const expiry = getTokenExpiry(token);
  if (!expiry) {
    debugLog('ERROR', 'Could not decode token expiry');
    return;
  }

  const now = Date.now();
  const timeUntilExpiry = expiry - now;
  const refreshTime = Math.max(0, timeUntilExpiry - REFRESH_BUFFER_MS);

  // Don't schedule if expiry is too soon (already handled by interceptor)
  if (refreshTime < 5000) {
    debugLog('SCHEDULE', 'Token expires too soon, relying on interceptor', {
      expiresIn: `${Math.round(timeUntilExpiry / 1000)}s`,
    });
    return;
  }

  debugLog('SCHEDULE', 'Token refresh scheduled', {
    in: `${Math.round(refreshTime / 1000)}s`,
    expiresAt: new Date(expiry).toISOString(),
  });

  isRefreshScheduled = true;

  refreshTimer = setTimeout(async () => {
    // Prevent refresh spam
    const timeSinceLastRefresh = Date.now() - lastRefreshAttempt;
    if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
      debugLog('SCHEDULE', 'Skipping refresh - too soon since last attempt', {
        timeSince: `${timeSinceLastRefresh}ms`,
      });
      return;
    }

    if (!backendInstanceRef) {
      debugLog('ERROR', 'Backend instance not available for refresh');
      return;
    }

    try {
      debugLog('REFRESH', 'Proactive token refresh triggered');
      lastRefreshAttempt = Date.now();
      
      await backendInstanceRef.post(API_ENDPOINTS.AUTH.REFRESH);
      
      debugLog('SUCCESS', 'Proactive refresh completed');
      
      // Schedule next refresh with new token
      scheduleTokenRefresh();
      
      // Notify listeners (for session provider)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent('tokenRefreshed', { 
          detail: { timestamp: Date.now() } 
        }));
      }
    } catch (error) {
      debugLog('ERROR', 'Proactive refresh failed', {
        status: error.response?.status,
        code: error.response?.data?.code,
        message: error.message,
      });
      
      // Don't schedule again if refresh failed with auth error
      const isAuthError = error.response?.status === 401 || 
                         error.response?.status === 403;
      
      if (!isAuthError) {
        // Network error or server error - try again
        scheduleTokenRefresh();
      }
    }
  }, refreshTime);
};

export const clearRefreshTimer = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
    isRefreshScheduled = false;
    debugLog('SCHEDULE', 'Token refresh timer cleared');
  }
};

export const initializeTokenRefresh = () => {
  debugLog('SCHEDULE', 'Initializing token refresh system');
  
  const token = getAccessTokenFromCookies();
  if (!token) {
    debugLog('SCHEDULE', 'No token found during initialization');
    return;
  }
  
  if (!isTokenValid(token)) {
    debugLog('SCHEDULE', 'Token invalid during initialization');
    clearAuthCookies();
    return;
  }
  
  scheduleTokenRefresh();
};

export const getRefreshStatus = () => ({
  isScheduled: isRefreshScheduled,
  lastAttempt: lastRefreshAttempt,
  hasValidToken: isTokenValid(getAccessTokenFromCookies()),
});

// === VISIBILITY CHANGE HANDLER ===
if (typeof document !== "undefined") {
  let visibilityHandler = null;
  
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      debugLog('TOKEN', 'App became visible, checking token state');
      
      const token = getAccessTokenFromCookies();
      
      if (!token) {
        debugLog('TOKEN', 'No token found on app resume');
        clearRefreshTimer();
        return;
      }
      
      const timeRemaining = getTokenTimeRemaining(token);
      const shouldRefresh = timeRemaining < 300000; // 5min buffer
      
      debugLog('TOKEN', 'Token state on resume', {
        timeRemaining: `${Math.round(timeRemaining / 1000)}s`,
        shouldRefresh,
      });
      
      if (shouldRefresh && timeRemaining > 0) {
        // Token is still valid but close to expiry
        debugLog('REFRESH', 'Triggering refresh on app resume');
        backendInstanceRef?.post(API_ENDPOINTS.AUTH.REFRESH)
          .then(() => {
            debugLog('SUCCESS', 'Resume refresh completed');
            scheduleTokenRefresh();
          })
          .catch((error) => {
            debugLog('ERROR', 'Resume refresh failed', { 
              error: error.message 
            });
          });
      } else if (timeRemaining > 0) {
        // Token is still valid, reschedule refresh
        scheduleTokenRefresh();
      } else {
        // Token expired while app was hidden
        debugLog('TOKEN', 'Token expired while app was hidden');
        clearRefreshTimer();
      }
    }
  };
  
  // Remove old listener if exists
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
  }
  
  visibilityHandler = handleVisibilityChange;
  document.addEventListener("visibilitychange", visibilityHandler);
}