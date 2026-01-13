// frontend/src/axiosConfig/tokenService.js
import { API_ENDPOINTS } from "@/utils/constants/globalConstants";

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

// === JWT DECODING ===
export const decodeJWT = (token) => {
  if (!token || typeof token !== "string") {
    console.warn("JWT decode warning: Token is missing or invalid type.");
    return null;
  }

  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("JWT decode error:", error);
    return null;
  }
};

// === TOKEN EXPIRY ===
export const getTokenExpiry = (token) => {
  const decoded = decodeJWT(token);
  return decoded?.exp ? decoded.exp * 1000 : null;
};

// === REFRESH SCHEDULING ===
let refreshTimer = null;
let backendInstanceRef = null;

export const setBackendInstanceRef = (instance) => {
  backendInstanceRef = instance;
};

export const scheduleTokenRefresh = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  const token = getAccessTokenFromCookies();
  if (!token) {
    console.log("No access token for refresh scheduling");
    return;
  }

  const expiry = getTokenExpiry(token);
  if (!expiry) {
    console.log("Could not decode token expiry");
    return;
  }

  const now = Date.now();
  const timeUntilExpiry = expiry - now;
  const refreshTime = Math.max(0, timeUntilExpiry - 120000); // Refresh 2 min before expiry

  console.log(`Token refresh scheduled in ${Math.round(refreshTime / 1000)}s`);

  refreshTimer = setTimeout(async () => {
    if (!backendInstanceRef) {
      console.error("Backend instance not referenced for refresh");
      return;
    }
    try {
      console.log("Proactive token refresh triggered");
      await backendInstanceRef.post(API_ENDPOINTS.AUTH.REFRESH);
      console.log("Proactive refresh successful");
      scheduleTokenRefresh(); // Schedule next refresh
    } catch (error) {
      console.error("Proactive refresh failed:", error);
    }
  }, refreshTime);
};

export const clearRefreshTimer = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
    console.log("Token refresh timer cleared");
  }
};

export const initializeTokenRefresh = () => {
  console.log("Initializing token refresh system");
  scheduleTokenRefresh();
};

// === VISIBILITY CHANGE HANDLER ===
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      console.log("App became visible, checking token");
      const token = getAccessTokenFromCookies();
      const expiry = getTokenExpiry(token);

      if (expiry && Date.now() > expiry - 300000) {
        // 5 min buffer
        console.log("Token near expiry after app resume, refreshing");
        backendInstanceRef?.post(API_ENDPOINTS.AUTH.REFRESH).catch(() => {});
      } else {
        scheduleTokenRefresh();
      }
    }
  });
}
