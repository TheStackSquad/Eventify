// frontend/src/components/auth/RequireAuth.js
"use client";

import { useAuth } from "@/utils/hooks/useAuth";
import AuthLoadingState from "./authLoadingState";


export default function RequireAuth({ children, fallback = null }) {
  const { isAuthenticated, isInitialized } = useAuth();

  if (!isInitialized) {
    return <AuthLoadingState message="Loading..." />;
  }

  if (!isAuthenticated) {
    return fallback;
  }

  return <>{children}</>;
}
