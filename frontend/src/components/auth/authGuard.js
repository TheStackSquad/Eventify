// frontend/src/components/auth/authGuard.js
"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/utils/hooks/useAuth";
import { buildLoginUrl } from "@/utils/helper/callbackUrl";
import AuthLoadingState from "./authLoadingState";

export default function AuthGuard({
  children,
  redirectTo = "/account/auth/login",
  preserveCallback = true,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isInitialized, user } = useAuth();
  const hasRedirected = useRef(false);
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    // Wait until the session check completes
    if (!isInitialized) return;

    // Authenticated: reset flags in case the user navigates back
    if (isAuthenticated && user) {
      hasRedirected.current = false;
      wasAuthenticated.current = true;
      return;
    }

    // Not authenticated: redirect once
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    // Keep the full path and query so the user lands exactly where they left
    const returnTo = `${pathname}${window.location.search}`;
    const reason = wasAuthenticated.current
      ? "session_expired"
      : "login_required";

    const loginUrl =
      preserveCallback && pathname
        ? buildLoginUrl(returnTo, reason, redirectTo)
        : redirectTo;

    if (process.env.NODE_ENV === "development") {
      console.log("🛡️ [AuthGuard] Redirecting to login", {
        from: returnTo,
        to: loginUrl,
      });
    }

    router.replace(loginUrl);
  }, [
    isInitialized,
    isAuthenticated,
    user,
    router,
    pathname,
    redirectTo,
    preserveCallback,
  ]);

  // Phase 1: still checking session
  if (!isInitialized) {
    return <AuthLoadingState message="Checking authentication..." />;
  }

  // Phase 2: not authenticated, show loading while redirecting
  if (!isAuthenticated || !user) {
    return <AuthLoadingState message="Redirecting to login..." />;
  }

  // Phase 3: authenticated, render protected content
  return <>{children}</>;
}
