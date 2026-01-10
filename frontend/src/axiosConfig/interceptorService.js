// frontend/src/axiosConfig/interceptorService.js

import { API_ENDPOINTS } from "@/utils/constants/globalConstants";
import {
  getAccessTokenFromCookies,
  getRefreshTokenFromCookies,
  scheduleTokenRefresh,
  clearRefreshTimer,
} from "./tokenUtils";

// --- Token refresh queue management ---
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


export const createResponseInterceptor = (backendInstance) => {
  return async (error) => {
    const originalRequest = error.config;

    console.log("Backend Error:", {
      status: error.response?.status,
      url: originalRequest?.url,
      method: originalRequest?.method?.toUpperCase(),
    });

    // Only handle 401 errors for non-retried requests
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Prevent refresh loop on refresh endpoint
    if (originalRequest.url === API_ENDPOINTS.AUTH.REFRESH) {
      isRefreshing = false;
      processQueue(error, null);
      clearRefreshTimer();
      return Promise.reject(error);
    }

    // Queue concurrent requests during refresh
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => backendInstance(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    // Attempt token refresh
    originalRequest._retry = true;
    isRefreshing = true;

    try {
      console.log("Attempting token refresh");
      // const refreshToken = getRefreshTokenFromCookies();

      // if (!refreshToken) {
      //   throw new Error("No refresh token found");
      // }

      // NOTE: Using the instance passed to the interceptor
      await backendInstance.post(API_ENDPOINTS.AUTH.REFRESH, {
        refresh_token: refreshToken,
      });

      console.log("Token refresh successful");
      isRefreshing = false;
      processQueue(null, true);
      scheduleTokenRefresh();

      // Update Authorization header for retry
      const newAccessToken = getAccessTokenFromCookies();
      if (newAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }

      return backendInstance(originalRequest);
    } catch (refreshError) {
      console.error("Token refresh failed:", refreshError);
      isRefreshing = false;
      processQueue(refreshError, null);
      clearRefreshTimer();
      return Promise.reject(refreshError);
    }
  };
};
