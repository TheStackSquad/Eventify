// frontend/src/middleware.js
import { NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";

const PROTECTED_UI_ROUTES = [
  "/dashboard",
  "/profile",
  "/events/create-events",
  "/events/my-events",
];

const AUTH_ROUTES = ["/account/auth/login", "/account/auth/signup"];

const PUBLIC_UI_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/events",
  "/forgot-password",
  "/reset-password",
  "/confirmation",
  "/events/[slug]",
  "/vendors/[id]",
  "/api/*-image",
  "/api/v1/feedback",
  "/api/feedback-image",
  "/api/feedback",
];

const PUBLIC_API_ROUTES = [
  "/auth/signup",
  "/auth/login",
  "/auth/logout",
  "/auth/refresh",
  "/auth/me",
  "/auth/forgot-password",
  "/auth/verify-reset-token",
  "/auth/reset-password",
  "/api/v1/vendors",
  "/api/v1/vendors/register",
  "/api/v1/inquiries/vendor",
  "/api/vendors",
  "/api/v1/feedback",
  "/api/orders/initialize",
  "/api/payments/verify",
  "/api/webhooks/paystack",
];

function isTokenValid(token) {
  if (!token) return false;

  try {
    const decoded = jwtDecode(token);
    const now = Date.now() / 1000;

    if (decoded.exp && decoded.exp < now) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Middleware] Token validation error:", error);
    return false;
  }
}

function isAuthenticated(request) {
  const accessToken = request.cookies.get("access_token")?.value;
  if (!accessToken) return false;
  return isTokenValid(accessToken);
}

function matchesRoute(pathname, routes) {
  return routes.some((route) => {
    if (pathname === route || pathname.startsWith(route + "/")) {
      return true;
    }

    if (route.includes("[") || route.includes(":")) {
      const pattern = new RegExp(
        "^" + route.replace(/(\[[^\]]+\]|:[^\/]+)/g, "[^/]+") + "$",
      );
      return pattern.test(pathname);
    }

    if (route.endsWith("*")) {
      const baseRoute = route.slice(0, -1);
      return pathname.startsWith(baseRoute);
    }

    return false;
  });
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hasValidToken = isAuthenticated(request);

  console.log("🔒 [MIDDLEWARE] Request", {
    path: pathname,
    hasToken: !!request.cookies.get("access_token"),
    tokenValid: hasValidToken,
  });

  // Auth routes - redirect if already authenticated
  if (matchesRoute(pathname, AUTH_ROUTES)) {
    if (hasValidToken) {
      console.log(
        "🔄 [MIDDLEWARE] Already authenticated - Redirecting to dashboard",
      );
      const redirectUrl =
        request.nextUrl.searchParams.get("callbackUrl") || "/dashboard";
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    console.log("✅ [MIDDLEWARE] Auth route - Allowing access");
    return NextResponse.next();
  }

  // Public API routes
  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    if (matchesRoute(pathname, PUBLIC_API_ROUTES)) {
      console.log("🌐 [MIDDLEWARE] Public API route - Allowing access");
      return NextResponse.next();
    }
  }

  // Protected UI routes - require valid token
  if (matchesRoute(pathname, PROTECTED_UI_ROUTES)) {
    if (!hasValidToken) {
      console.log("❌ [MIDDLEWARE] No valid token - Redirecting to login");
      const loginUrl = new URL("/account/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);

      const response = NextResponse.redirect(loginUrl);
      const hasExpiredToken =
        request.cookies.get("access_token") && !hasValidToken;

      if (hasExpiredToken) {
        response.cookies.delete("access_token");
        response.cookies.delete("refresh_token");
        console.log("🧹 [MIDDLEWARE] Cleared expired token cookies");
      }

      return response;
    }
    console.log("✅ [MIDDLEWARE] Protected UI route - Authorized");
    return NextResponse.next();
  }

  // Public UI routes
  if (matchesRoute(pathname, PUBLIC_UI_ROUTES)) {
    console.log("🌐 [MIDDLEWARE] Public UI route - Allowing access");
    return NextResponse.next();
  }

  // Default - pass through with user ID header
  const requestHeaders = new Headers(request.headers);
  const token = request.cookies.get("access_token")?.value;

  if (token && hasValidToken) {
    try {
      const decoded = jwtDecode(token);
      requestHeaders.set("x-user-id", decoded.user_id);
    } catch (error) {
      console.error("[Middleware] Failed to decode token:", error);
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
