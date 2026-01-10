// frontend/src/utils/hooks/useAuth.ts
import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "@/provider/sessionProvider";
import { loginApi, signupApi, logoutApi } from "@/services/authAPI";

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within SessionProvider");
  }

  // console.log("🔧 [USE_AUTH] Auth context accessed");
  // console.log("👤 [USE_AUTH] Current user in context:", context.user);
  // console.log("✅ [USE_AUTH] Is authenticated:", context.isAuthenticated);
  // console.log("🚀 [USE_AUTH] Is initialized:", context.isInitialized);
  // console.log("📊 [USE_AUTH] Session checked:", context.sessionChecked);
  // console.log("⏳ [USE_AUTH] Is loading:", context.isLoading);

  // if (context.user) {
  //   console.log(
  //     "📋 [USE_AUTH] Complete user data structure:",
  //     JSON.stringify(context.user, null, 2)
  //   );
  //   console.log("🔑 [USE_AUTH] User ID:", context.user.id);
  //   console.log("📧 [USE_AUTH] User Email:", context.user.email);
  //   console.log("👤 [USE_AUTH] User Name:", context.user.name || "Not provided");
  //   console.log("🏷️ [USE_AUTH] User Role:", context.user.role || "Not specified");
  //   console.log("👑 [USE_AUTH] Is Admin:", context.user.is_admin || false);
  //   console.log("📞 [USE_AUTH] User Phone:", context.user.phone || "Not provided");
  //   console.log("📍 [USE_AUTH] User Address:", context.user.address || "Not provided");
  //   console.log("📅 [USE_AUTH] Created At:", context.user.created_at || "Not provided");
  //   console.log("🔄 [USE_AUTH] Updated At:", context.user.updated_at || "Not provided");
  // }

  return context;
}

export function useLogin() {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();

  return useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      // console.log("✅ [LOGIN] Login successful");
      // console.log("📥 [LOGIN] Response data received:", JSON.stringify(data, null, 2));
      // if (data.user) {
      //   console.log("👤 [LOGIN] Complete user data from login:", JSON.stringify(data.user, null, 2));
      //   console.log("🔑 [LOGIN] User ID:", data.user.id);
      //   console.log("📧 [LOGIN] User Email:", data.user.email);
      //   console.log("👤 [LOGIN] User Name:", data.user.name || "Not provided");
      //   console.log("🏷️ [LOGIN] User Role:", data.user.role || "Not specified");
      //   console.log("👑 [LOGIN] Is Admin:", data.user.is_admin || false);
      // }
      setUser(data.user);
      queryClient.setQueryData(["session"], data.user);
      // console.log("💾 [LOGIN] Session data cached in query client");
    },
    onError: (error) => {
      // console.error("❌ [LOGIN] Failed");
      // console.error("📉 [LOGIN] Error response:", error.response?.data);
      // console.error("⚡ [LOGIN] Error message:", error.message);
    },
  });
}

export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signupApi,
    onSuccess: (data) => {
      // console.log("✅ [SIGNUP] Signup successful");
      // console.log("📥 [SIGNUP] Response data received:", JSON.stringify(data, null, 2));
      // if (data.user) {
      //   console.log("👤 [SIGNUP] New user created:", JSON.stringify(data.user, null, 2));
      //   console.log("🔑 [SIGNUP] User ID:", data.user.id);
      //   console.log("📧 [SIGNUP] User Email:", data.user.email);
      //   console.log("👤 [SIGNUP] User Name:", data.user.name || "Not provided");
      // }
      queryClient.clear();
      // console.log("🧹 [SIGNUP] Query client cleared");
    },
    onError: (error) => {
      // console.error("❌ [SIGNUP] Failed");
      // console.error("📉 [SIGNUP] Error response:", error.response?.data);
      // console.error("⚡ [SIGNUP] Error message:", error.message);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const context = useContext(AuthContext);
  const { clearAuth } = context || {};

  return useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      // console.log("✅ [LOGOUT] Logout successful");
      // console.log("👤 [LOGOUT] User logged out");
      if (clearAuth) {
        // console.log("🧹 [LOGOUT] Clearing auth state");
        clearAuth();
      }
      queryClient.clear();
      queryClient.removeQueries(["session"]);
      // console.log("🗑️ [LOGOUT] Session query removed from cache");
      // console.log("🧹 [LOGOUT] Query client cleared");
    },
    onError: (error) => {
      // console.error("❌ [LOGOUT] API call failed, clearing state anyway");
      // console.error("📉 [LOGOUT] Error response:", error.response?.data);
      // console.error("⚡ [LOGOUT] Error message:", error.message);
      if (clearAuth) {
        // console.log("🧹 [LOGOUT] Force clearing auth state despite error");
        clearAuth();
      }
      queryClient.clear();
      // console.log("🧹 [LOGOUT] Query client cleared despite error");
    },
  });
}

export function useIsAdmin() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin || false;
  // console.log("👑 [USE_IS_ADMIN] Checking admin status:", isAdmin);
  // console.log("👤 [USE_IS_ADMIN] User for admin check:", user?.email);
  return isAdmin;
}

export function useCurrentUser() {
  const { user } = useAuth();
  // console.log("👤 [USE_CURRENT_USER] Returning current user:", user?.email || "No user");
  // console.log("📋 [USE_CURRENT_USER] Complete user data:", JSON.stringify(user, null, 2));
  return user;
}
