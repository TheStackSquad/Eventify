// frontend/src/utils/hooks/useAuth.js

import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "@/provider/sessionProvider";
import {
  loginApi,
  signupApi,
  logoutApi,
  forgotPasswordApi,
  verifyResetTokenApi,
  resetPasswordApi,
} from "@/services/authAPI";

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within SessionProvider");
  }
  return context;
}

// Initialize proactive refresh on login
export function useLogin() {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();

  return useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.setQueryData(["session"], data.user);

      // Initialize proactive token refresh
      if (typeof window !== "undefined") {
        import("@/axiosConfig/axios").then(({ initializeTokenRefresh }) => {
          initializeTokenRefresh();
        });
      }
    },
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signupApi,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

// Clear refresh timer on logout
export function useLogout() {
  const queryClient = useQueryClient();
  const context = useContext(AuthContext);
  const { clearAuth } = context || {};

  return useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      if (clearAuth) {
        clearAuth();
      }
      queryClient.clear();
      queryClient.removeQueries(["session"]);

      // Clear refresh timer
      if (typeof window !== "undefined") {
        import("@/axiosConfig/axios").then(({ clearRefreshTimer }) => {
          clearRefreshTimer?.();
        });
      }
    },
    onError: () => {
      if (clearAuth) {
        clearAuth();
      }
      queryClient.clear();

      // Clear refresh timer even on error
      if (typeof window !== "undefined") {
        import("@/axiosConfig/axios").then(({ clearRefreshTimer }) => {
          clearRefreshTimer?.();
        });
      }
    },
  });
}

export function useIsAdmin() {
  const { user } = useAuth();
  return user?.is_admin || false;
}

export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: forgotPasswordApi,
    onSuccess: (data) => {
      console.log("Password reset email sent (or appears to be sent)");
    },
  });
}

export function useVerifyResetToken() {
  return useMutation({
    mutationFn: verifyResetTokenApi,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: resetPasswordApi,
  });
}
