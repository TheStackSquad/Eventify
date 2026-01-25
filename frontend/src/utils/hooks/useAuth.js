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
import {
  initializeTokenRefresh,
  clearRefreshTimer,
} from "@/axiosConfig/tokenService";

// ================================================================
// CORE HOOK
// ================================================================
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within SessionProvider");
  }
  return context;
}

// ================================================================
// CONVENIENCE HOOKS
// ================================================================
export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}

export function useIsAuthenticated() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

export function useIsInitialized() {
  const { isInitialized } = useAuth();
  return isInitialized;
}

export function useIsAdmin() {
  const { user } = useAuth();
  return user?.is_admin || false;
}

/**
 * Hook to check if auth is ready and user is logged in
 * Useful for conditionally rendering content
 */
export function useAuthReady() {
  const { isInitialized, isAuthenticated } = useAuth();
  return isInitialized && isAuthenticated;
}

// ================================================================
// MUTATION HOOKS
// ================================================================
export function useLogin() {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();

  return useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      console.info("[Login] Success", { userId: data.user?.id });

      // Set user in context and cache
      setUser(data.user);
      queryClient.setQueryData(["session"], data.user);

      // Initialize token refresh
      initializeTokenRefresh();
    },
    onError: (error) => {
      console.error("[Login] Failed", { error: error.message });
    },
  });
}

export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signupApi,
    onSuccess: () => {
      console.info("[Signup] Success");
      queryClient.clear();
    },
    onError: (error) => {
      console.error("[Signup] Failed", { error: error.message });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { clearAuth } = useAuth();

  return useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      console.info("[Logout] Success");

      // Clear auth state and cache
      clearAuth();
      queryClient.clear();

      // Stop token refresh
      clearRefreshTimer();
    },
    onError: (error) => {
      console.error("[Logout] Failed - clearing auth anyway", {
        error: error.message,
      });

      // Clear auth even on error
      clearAuth();
      queryClient.clear();
      clearRefreshTimer();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: forgotPasswordApi,
    onSuccess: () => {
      console.info("[Password Reset] Email sent");
    },
    onError: (error) => {
      console.error("[Password Reset] Failed", { error: error.message });
    },
  });
}

export function useVerifyResetToken() {
  return useMutation({
    mutationFn: verifyResetTokenApi,
    onError: (error) => {
      console.error("[Verify Reset Token] Failed", { error: error.message });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: resetPasswordApi,
    onSuccess: () => {
      console.info("[Reset Password] Success");
    },
    onError: (error) => {
      console.error("[Reset Password] Failed", { error: error.message });
    },
  });
}
