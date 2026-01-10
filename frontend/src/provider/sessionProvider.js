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

export const AuthContext = createContext(null);

export default function SessionProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 1. TanStack Query for session verification
  const {
    data: sessionUser,
    isLoading: isSessionLoading,
    isFetched: isSessionFetched,
    error: sessionError,
  } = useQuery({
    queryKey: ["session"],
    queryFn: verifySessionApi,
    retry: false, // Don't retry on 401
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });

  // 2. Effect to update local state after session query completes
  useEffect(() => {
    if (isSessionFetched) {
      console.log("🔍 [SESSION] Verification completed", {
        hasUser: !!sessionUser,
        error: sessionError?.message,
      });

      if (sessionUser) {
        console.log("✅ [SESSION] User authenticated:", {
          email: sessionUser.email,
          id: sessionUser.id,
        });
        setUserState(sessionUser);
        setIsAuthenticated(true);
      } else {
        console.log("❌ [SESSION] No user session found");
        setUserState(null);
        setIsAuthenticated(false);
      }

      setIsInitialized(true);
    }
  }, [sessionUser, isSessionFetched, sessionError]);

  // 3. Stable state setters
  const setUser = useCallback((userData) => {
    console.log("👤 [SESSION] Setting user:", userData?.email);
    setUserState(userData);
    setIsAuthenticated(!!userData);
    setIsInitialized(true);
  }, []);

  const clearAuth = useCallback(() => {
    console.log("🧹 [SESSION] Clearing auth state");
    setUserState(null);
    setIsAuthenticated(false);
    setIsInitialized(true);
  }, []);

  // 4. Memoized context value
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

  // 5. Debug logging
  useEffect(() => {
    console.log("🎯 [SESSION] State:", {
      hasUser: !!value.user,
      userEmail: value.user?.email,
      isAuthenticated: value.isAuthenticated,
      isInitialized: value.isInitialized,
      isLoading: value.isLoading,
    });
  }, [value]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
