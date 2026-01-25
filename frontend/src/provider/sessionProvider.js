// frontend/src/provider/sessionProvider.js
"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { verifySessionApi } from "@/services/authAPI";
import {
  initializeTokenRefresh,
  clearRefreshTimer,
  getAccessTokenFromCookies,
  isTokenValid,
} from "@/axiosConfig/tokenService";

const IS_DEV = process.env.NODE_ENV === "development";

const debugLog = (category, message, data = {}) => {
  if (!IS_DEV) return;
  const emoji = {
    INIT: "🚀",
    SESSION: "🔐",
    TOKEN: "🎫",
    ERROR: "❌",
    SUCCESS: "✅",
  };
  console.log(
    `${emoji[category] || "📋"} [SessionProvider:${category}] ${message}`,
    Object.keys(data).length ? data : "",
  );
};

export const AuthContext = createContext(null);

export default function SessionProvider({ children }) {
  // ================================================================
  // STATE MANAGEMENT
  // ================================================================
  const [user, setUserState] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const queryClient = useQueryClient();

  // ================================================================
  // TOKEN REFRESH INITIALIZATION
  // ================================================================
  useEffect(() => {
    debugLog("INIT", "Initializing token refresh system");

    const token = getAccessTokenFromCookies();

    if (token && isTokenValid(token)) {
      debugLog("TOKEN", "Valid token found - starting refresh scheduler");
      initializeTokenRefresh();
    } else {
      debugLog("TOKEN", "No valid token - skipping refresh scheduler");
    }
  }, []); // Run once on mount

  // ================================================================
  // SESSION VERIFICATION QUERY
  // ================================================================
  const {
    data: sessionData,
    isLoading,
    isFetched,
    error: sessionError,
    refetch: refetchSession,
  } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      debugLog("SESSION", "Verifying session with backend...");

      try {
        const user = await verifySessionApi();
        debugLog("SUCCESS", "Session verified", {
          userId: user?.id,
          email: user?.email,
        });
        return user;
      } catch (error) {
        const status = error.response?.status;
        const isAuthError = status === 401 || status === 403;

        debugLog("ERROR", "Session verification failed", {
          status,
          isAuthError,
          message: error.message,
        });

        // For auth errors, return null instead of throwing
        // This allows the query to succeed with a "no session" result
        if (isAuthError) {
          return null;
        }

        // For network/server errors, throw to trigger retry
        throw error;
      }
    },
    // Always enabled - run immediately on mount
    enabled: true,
    // Don't retry auth errors (user not logged in)
    retry: (failureCount, error) => {
      const status = error?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    // Recheck session when user returns to tab
    refetchOnWindowFocus: true,
    // Don't refetch on component remount
    refetchOnMount: false,
    // Don't poll - use token refresh events instead
    refetchInterval: false,
    // Consider session fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
    // Keep in cache for 10 minutes
    gcTime: 10 * 60 * 1000,
  });

  // ================================================================
  // SYNC QUERY RESULT TO LOCAL STATE
  // ================================================================
  useEffect(() => {
    // Wait for initial query to complete
    if (!isFetched) return;

    if (sessionData) {
      // User is authenticated
      debugLog("SESSION", "Setting authenticated state", {
        userId: sessionData.id,
      });

      setUserState(sessionData);
      setIsAuthenticated(true);
      setIsInitialized(true);

      // Ensure token refresh is active for authenticated users
      const token = getAccessTokenFromCookies();
      if (token && isTokenValid(token)) {
        initializeTokenRefresh();
      }
    } else {
      // No session (could be auth error or user not logged in)
      debugLog("SESSION", "No active session", {
        hadError: !!sessionError,
      });

      setUserState(null);
      setIsAuthenticated(false);
      setIsInitialized(true);
    }
  }, [sessionData, isFetched, sessionError]);

  // ================================================================
  // LISTEN FOR TOKEN REFRESH EVENTS
  // ================================================================
  useEffect(() => {
    const handleTokenRefresh = () => {
      debugLog("TOKEN", "Token refreshed - invalidating session query");
      queryClient.invalidateQueries({ queryKey: ["session"] });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("tokenRefreshed", handleTokenRefresh);
      return () => {
        window.removeEventListener("tokenRefreshed", handleTokenRefresh);
      };
    }
  }, [queryClient]);

  // ================================================================
  // PUBLIC API METHODS
  // ================================================================
  const setUser = useCallback(
    (userData) => {
      debugLog("SESSION", "Manually setting user", { userId: userData?.id });

      setUserState(userData);
      setIsAuthenticated(!!userData);
      setIsInitialized(true);

      // Update React Query cache
      queryClient.setQueryData(["session"], userData);

      // Start token refresh for new session
      if (userData) {
        const token = getAccessTokenFromCookies();
        if (token && isTokenValid(token)) {
          initializeTokenRefresh();
        }
      }
    },
    [queryClient],
  );

  const clearAuth = useCallback(() => {
    debugLog("SESSION", "Clearing authentication state");

    setUserState(null);
    setIsAuthenticated(false);
    setIsInitialized(true);

    // Clear React Query cache
    queryClient.setQueryData(["session"], null);
    queryClient.removeQueries({ queryKey: ["session"] });

    // Stop token refresh
    clearRefreshTimer();
  }, [queryClient]);

  const refreshSession = useCallback(async () => {
    debugLog("SESSION", "Manually refreshing session");

    try {
      const result = await refetchSession();
      if (result.data) {
        debugLog("SUCCESS", "Session refreshed", { userId: result.data.id });
        return result.data;
      }
      return null;
    } catch (error) {
      debugLog("ERROR", "Session refresh failed", { error: error.message });
      throw error;
    }
  }, [refetchSession]);

  // ================================================================
  // CONTEXT VALUE
  // ================================================================
  const value = useMemo(
    () => ({
      // State
      user,
      isAuthenticated,
      isInitialized,
      loading: !isInitialized,

      // Methods
      setUser,
      clearAuth,
      refetchSession: refreshSession,
    }),
    [user, isAuthenticated, isInitialized, setUser, clearAuth, refreshSession],
  );

  // ================================================================
  // DEV LOGGING
  // ================================================================
  useEffect(() => {
    if (!IS_DEV) return;

    debugLog("SESSION", "State changed", {
      isInitialized,
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id,
      queryFetched: isFetched,
      queryLoading: isLoading,
    });
  }, [isInitialized, isAuthenticated, user, isFetched, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
