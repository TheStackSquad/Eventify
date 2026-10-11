//frontend/src/provider/sessionProvider.js

"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { verifySessionApi, refreshTokenApi } from "@/services/authAPI";
import {
  initializeTokenRefresh,
  clearRefreshTimer,
} from "@/axiosConfig/tokenService";

export const AuthContext = createContext(null);

export default function SessionProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const queryClient = useQueryClient();

  const {
    data: sessionData,
    isFetched, // one-way door: false → true, never back — reliable for initialization
    isFetching, // oscillates: true during any network activity — used for loading UX
    refetch: refetchSession,
  } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return await verifySessionApi();
      } catch (error) {
        const status = error.response?.status;
        if (status === 401) {
          try {
            await refreshTokenApi();
            return await verifySessionApi();
          } catch (refreshError) {
            const rStatus = refreshError.response?.status;
            if (rStatus === 401 || rStatus === 403) return null;
            throw refreshError; // 5xx on re-verify → throw to TanStack for retry
          }
        }
        if (status === 403) return null;
        throw error; // network/5xx → throw to TanStack for retry
      }
    },
    retry: (failureCount, error) => {
      const status = error?.response?.status;
      if (status === 401 || status === 403) return false; // definitive auth failures
      return failureCount < 2; // retry network/5xx up to 2x
    },
    staleTime: 5 * 60 * 1000,
  });

  // INITIALIZATION — uses isFetched, not isLoading.
  //
  // isFetched is a one-way door (false → true, never resets). It becomes true
  // once the first fetch attempt completes — whether success, null, or error
  // with all retries exhausted. This is reliable in all scenarios:
  //
  //   ✓ Clean success:       isFetched → true immediately after resolve
  //   ✓ Retries (5xx):       isFetched → true ONLY after all retries are done
  //   ✓ Background refetch:  isFetched stays true — isInitialized never resets
  //
  // isLoading (isPending && isFetching) was unreliable because TanStack's
  // retry delay (~1000ms) meant isLoading flipped false then true again
  // mid-retry, causing isInitialized to fire prematurely.
  useEffect(() => {
    if (isFetched) {
      setIsInitialized(true);
    }
  }, [isFetched]);

  // SESSION SYNC — mirrors server state into local React state.
  // Runs every time the query returns new data (initial load, refetch, rotation).
  useEffect(() => {
    if (sessionData !== undefined) {
      setUserState(sessionData);
      setIsAuthenticated(!!sessionData);
      if (sessionData) initializeTokenRefresh();
      else clearRefreshTimer();
    }
  }, [sessionData]);

  // TOKEN ROTATION LISTENER — re-verifies session when interceptor rotates tokens.
  useEffect(() => {
    const handleTokenRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ["session"] });
    };
    window.addEventListener("tokenRefreshed", handleTokenRefresh);
    return () => {
      window.removeEventListener("tokenRefreshed", handleTokenRefresh);
      clearRefreshTimer();
    };
  }, [queryClient]);

  const setUser = useCallback(
    (userData) => {
      setUserState(userData);
      setIsAuthenticated(!!userData);
      queryClient.setQueryData(["session"], userData);
      queryClient.invalidateQueries({ queryKey: ["session"] }); // mark stale → re-verify on next focus
      if (userData) initializeTokenRefresh();
      else clearRefreshTimer();
    },
    [queryClient],
  );

  const clearAuth = useCallback(() => {
    setUserState(null);
    setIsAuthenticated(false);
    queryClient.setQueryData(["session"], null);
    queryClient.invalidateQueries({ queryKey: ["session"] }); // New Gap A fix: mark stale → re-verify on next focus
    clearRefreshTimer();
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isInitialized,
      // loading = true during initial boot OR any background refetch (token rotation, focus refetch).
      // Consumers use this to render spinners and disable actions during uncertain session state.
      loading: !isInitialized || isFetching,
      setUser,
      clearAuth,
      refetchSession,
    }),
    [
      user,
      isAuthenticated,
      isInitialized,
      isFetching,
      setUser,
      clearAuth,
      refetchSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}