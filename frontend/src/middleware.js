// frontend/src/middleware.js

import { NextResponse } from "next/server";

// ================================================================
// ROUTE DEFINITIONS
// ================================================================

// UI Routes that require authentication
const PROTECTED_UI_ROUTES = [
  "/dashboard",
  "/profile",
  "/events/create-events",
  "/events/my-events",
];

// Auth pages (login/signup) - redirect away if already logged in
const AUTH_ROUTES = ["/account/auth/login", "/account/auth/signup"];

// Explicitly public UI routes (no auth required, no redirect if logged in)
const PUBLIC_UI_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/events",
  "/forgot-password",
  "/reset-password",
  "/confirmation", // e.g., for payment or email confirmation
  "/events/[slug]", // Assuming dynamic event detail page is public
  "/vendors/[id]", // Assuming vendor profile is public
  "/api/*-image",
  "/api/v1/feedback",
  "/api/feedback-image",
  "/api/feedback",
];

// API Endpoints that must be accessible even when unauthenticated
// This prevents redirects during session verification, login, or public API calls.
const PUBLIC_API_ROUTES = [
  // Auth & Session
  "/auth/signup",
  "/auth/login",
  "/auth/logout",
  "/auth/refresh",
  "/auth/me", // Critical for session check in SessionProvider
  "/auth/forgot-password",
  "/auth/verify-reset-token",
  "/auth/reset-password",

  // Vendor/Inquiry/Review/Feedback APIs (Backend is responsible for internal guards)
  "/api/v1/vendors",
  "/api/v1/vendors/register",
  "/api/v1/inquiries/vendor",
  "/api/vendors",
  "/api/v1/feedback",

  // Payment/Order (Initial/Webhook)
  "/api/orders/initialize",
  "/api/payments/verify",
  "/api/webhooks/paystack",
];

// ================================================================
// UTILITIES
// ================================================================

// Simple check for access token
function isAuthenticated(request) {
  const accessToken = request.cookies.get("access_token");
  return !!accessToken?.value;
}

// Enhanced route matching, handling dynamic slugs with square brackets or wildcards
function matchesRoute(pathname, routes) {
  return routes.some((route) => {
    // 1. Exact match or starts with (for /route and /route/sub-route)
    if (pathname === route || pathname.startsWith(route + "/")) {
      return true;
    }

    // 2. Dynamic route matching (e.g., /events/[id] or /api/events/:id)
    if (route.includes("[") || route.includes(":")) {
      // Replace dynamic parts with a regex that matches anything
      const pattern = new RegExp(
        "^" + route.replace(/(\[[^\]]+\]|:[^\/]+)/g, "[^/]+") + "$"
      );
      return pattern.test(pathname);
    }

    // 3. Simple wildcard match (only needed if using * explicitly)
    if (route.endsWith("*")) {
      const baseRoute = route.slice(0, -1);
      return pathname.startsWith(baseRoute);
    }
    return false; // Fallback for unmatched patterns
  });
}

// ================================================================
// MIDDLEWARE CORE
// ================================================================

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hasAccessToken = isAuthenticated(request);
  console.log("🔒 [MIDDLEWARE] Request", {
    path: pathname,
    hasAccessToken,
    timestamp: new Date().toISOString(),
  }); // ---------------------------------------------------------------- // 1. AUTH ROUTES (Login/Signup) - Redirect if logged in // ----------------------------------------------------------------

  if (matchesRoute(pathname, AUTH_ROUTES)) {
    if (hasAccessToken) {
      console.log(
        "🔄 [MIDDLEWARE] Already authenticated - Redirecting to dashboard"
      );
      const redirectUrl =
        request.nextUrl.searchParams.get("callbackUrl") || "/dashboard";
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    console.log("✅ [MIDDLEWARE] Auth route - Allowing access (not logged in)");
    return NextResponse.next();
  } // ---------------------------------------------------------------- // 2. PUBLIC API ROUTES - Allow all API calls critical for public pages/session checks // ----------------------------------------------------------------

  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    if (matchesRoute(pathname, PUBLIC_API_ROUTES)) {
      console.log("🌐 [MIDDLEWARE] Public API route - Allowing access");
      return NextResponse.next();
    }
  } // ---------------------------------------------------------------- // 3. PROTECTED UI ROUTES - Require authentication (Strict Check) // ----------------------------------------------------------------

  if (matchesRoute(pathname, PROTECTED_UI_ROUTES)) {
    if (!hasAccessToken) {
      console.log("❌ [MIDDLEWARE] Protected UI route - Redirecting to login");
      const loginUrl = new URL("/account/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    console.log("✅ [MIDDLEWARE] Protected UI route - Authorized");
    return NextResponse.next();
  } // ---------------------------------------------------------------- // 4. PUBLIC UI ROUTES - Allow all explicitly defined public pages // ----------------------------------------------------------------

  if (matchesRoute(pathname, PUBLIC_UI_ROUTES)) {
    console.log("🌐 [MIDDLEWARE] Public UI route - Allowing access");
    return NextResponse.next();
  } // ---------------------------------------------------------------- // 5. DEFAULT CATCH-ALL (Strict Fallthrough) // ---------------------------------------------------------------- // If the route is an API route, but not explicitly whitelisted, it's protected by default.

  if (pathname.startsWith("/api")) {
    // This catches protected API routes like /api/events/create or Admin APIs.
    if (!hasAccessToken) {
      console.log(
        "❌ [MIDDLEWARE] Protected API route hit - Denying access (401)"
      );
      return new NextResponse(
        JSON.stringify({
          success: false,
          message: "Authentication required for this API.",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }
    // If it has a token, it's a protected API we just didn't list in the UI.
    console.log("✅ [MIDDLEWARE] Matched protected API - Authorized");
    return NextResponse.next();
  } // For all other miscellaneous paths (e.g., static assets, utility paths)

  console.log("🌐 [MIDDLEWARE] Unmatched path - Allowing access by default");
  return NextResponse.next();
}

export const config = {
  matcher: [
    /* Match all request paths except static assets */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
