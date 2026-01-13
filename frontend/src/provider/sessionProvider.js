// frontend/src/provider/sessionProvider.js
"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { verifySessionApi } from "@/services/authAPI";
//import { initializeTokenRefresh } from "@/axiosConfig/axios";

export const AuthContext = createContext(null);

export default function SessionProvider({ children }) {
  // State
  const [user, setUserState] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize token refresh system on mount
  // useEffect(() => {
  //   console.info("[Auth] Initializing token refresh system");
  //   initializeTokenRefresh();
  // }, []);

  // Session verification query
  const {
    data: sessionUser,
    isLoading: isSessionLoading,
    isFetched: isSessionFetched,
    error: sessionError,
  } = useQuery({
    queryKey: ["session"],
    queryFn: verifySessionApi,
    retry: false, // No retry on 401
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });

  // Update local state when session verification completes
  useEffect(() => {
    if (isSessionFetched) {
      if (sessionUser) {
        console.info("[Auth] User authenticated", {
          userId: sessionUser.id,
          email: sessionUser.email?.substring(0, 10) + "...", // Privacy-safe logging
          role: sessionUser.role,
        });
        setUserState(sessionUser);
        setIsAuthenticated(true);
      } else if (sessionError) {
        console.warn("[Auth] Session verification failed", {
          error: sessionError.message,
          code: sessionError.response?.status,
        });
        setUserState(null);
        setIsAuthenticated(false);
      } else {
        console.info("[Auth] No active session found");
        setUserState(null);
        setIsAuthenticated(false);
      }

      setIsInitialized(true);
      console.debug("[Auth] Session initialization complete", {
        authenticated: !!sessionUser,
        initialized: true,
      });
    }
  }, [sessionUser, isSessionFetched, sessionError]);

  // State setters
  const setUser = useCallback((userData) => {
    console.info("[Auth] Setting user session", {
      userId: userData?.id,
      hasData: !!userData,
    });
    setUserState(userData);
    setIsAuthenticated(!!userData);
    setIsInitialized(true);
  }, []);

  const clearAuth = useCallback(() => {
    console.info("[Auth] Clearing authentication state");
    setUserState(null);
    setIsAuthenticated(false);
    setIsInitialized(true);
  }, []);

  // Memoized context value
  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isInitialized,
      sessionChecked: isInitialized,
      isLoading: isSessionLoading,
      setUser,
      clearAuth,
    }),
    [user, isAuthenticated, isInitialized, isSessionLoading, setUser, clearAuth]
  );

  // Debug logging (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.debug("[Auth] State update", {
        authenticated: isAuthenticated,
        userId: user?.id,
        initialized: isInitialized,
        loading: isSessionLoading,
      });
    }
  }, [isAuthenticated, user, isInitialized, isSessionLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
