// frontend/src/components/auth/authGuard.js
"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/utils/hooks/useAuth";
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

  useEffect(() => {
    // Don't do anything until session check completes
    if (!isInitialized) return;

    // If authenticated, clear redirect flag (in case user navigates back)
    if (isAuthenticated && user) {
      hasRedirected.current = false;
      return;
    }

    // Not authenticated - redirect to login (once)
    if (!hasRedirected.current) {
      hasRedirected.current = true;

      // Build redirect URL with optional callback
      let loginUrl = redirectTo;
      if (preserveCallback && pathname) {
       // const callbackUrl = encodeURIComponent(pathname);
        loginUrl = `${redirectTo}`;
      }

      if (process.env.NODE_ENV === "development") {
        console.log("🛡️ [AuthGuard] Redirecting to login", {
          from: pathname,
          to: loginUrl,
        });
      }

      router.replace(loginUrl);
    }
  }, [
    isInitialized,
    isAuthenticated,
    user,
    router,
    pathname,
    redirectTo,
    preserveCallback,
  ]);

  // ================================================================
  // RENDER PHASES
  // ================================================================

  // Phase 1: Still checking session
  if (!isInitialized) {
    return <AuthLoadingState message="Checking authentication..." />;
  }

  // Phase 2: Not authenticated - show loading while redirecting
  if (!isAuthenticated || !user) {
    return <AuthLoadingState message="Redirecting to login..." />;
  }

  // Phase 3: Authenticated and has user data - render protected content
  return <>{children}</>;
}
