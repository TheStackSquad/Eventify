// frontend/src/middleware.js
import { NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";

// ─── Dev-only logging ─────────────────────────────────────────────────────────
// Suppressed in production to avoid log noise and Edge runtime overhead.
const devLog = (...args) =>
  process.env.NODE_ENV !== "production" && console.log(...args);

const devError = (...args) =>
  process.env.NODE_ENV !== "production" && console.error(...args);

// ─── Route lists ──────────────────────────────────────────────────────────────

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
  "/api/event-image",
  "/api/feedback-image",
  "/api/vendor-image",
  "/api/v1/feedback",
  "/api/feedback",
];

// NOTE: "/api/v1/vendors" here causes all sub-paths (/api/v1/vendors/admin, etc.)
// to be treated as public via prefix matching. This is intentional only if the
// backend API layer enforces its own auth on protected sub-routes. If middleware-
// level protection is needed, remove this entry and list sub-paths explicitly.
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

// ─── Token validation ─────────────────────────────────────────────────────────
// Returns the decoded JWT payload on success, false on any failure.
// Returning the payload (not a boolean) lets callers reuse it — avoids a
// second jwtDecode call in the default handler.
function isTokenValid(token) {
  if (!token) return false;

  try {
    const decoded = jwtDecode(token);
    const now = Date.now() / 1000;

    if (decoded.exp == null) return false;
    if (decoded.exp < now) return false;

    return decoded;
  } catch (error) {
    devError("[Middleware] Token validation error:", error);
    return false;
  }
}

// Returns the decoded token payload if authenticated, false otherwise.
function isAuthenticated(request) {
  const accessToken = request.cookies.get("access_token")?.value;
  if (!accessToken) return false;
  return isTokenValid(accessToken);
}

// ─── Route matching ───────────────────────────────────────────────────────────

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

// ─── Middleware ───────────────────────────────────────────────────────────────

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // decodedToken is the JWT payload on success, false on any auth failure.
  // Thread it through to the default handler — no second jwtDecode call needed.
  const decodedToken = isAuthenticated(request);
  const hasValidToken = !!decodedToken;

  devLog("🔒 [MIDDLEWARE] Request", {
    path: pathname,
    hasToken: !!request.cookies.get("access_token"),
    tokenValid: hasValidToken,
  });

  // ── Auth routes — redirect authenticated users away ────────────────────────
  if (matchesRoute(pathname, AUTH_ROUTES)) {
    if (hasValidToken) {
      devLog(
        "🔄 [MIDDLEWARE] Already authenticated - Redirecting to dashboard",
      );
      const rawCallback = request.nextUrl.searchParams.get("callbackUrl");
      // Only accept paths that start with exactly one /
      // Rejects: https://evil.com  //evil.com  /  (bare slash)  empty string
      const redirectUrl =
        rawCallback && /^\/[^/]/.test(rawCallback) ? rawCallback : "/dashboard";
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    devLog("✅ [MIDDLEWARE] Auth route - Allowing access");
    return NextResponse.next();
  }

  // ── Public API routes ──────────────────────────────────────────────────────
  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    if (matchesRoute(pathname, PUBLIC_API_ROUTES)) {
      devLog("🌐 [MIDDLEWARE] Public API route - Allowing access");
      return NextResponse.next();
    }
  }

  // ── Protected UI routes — require valid token ──────────────────────────────
  if (matchesRoute(pathname, PROTECTED_UI_ROUTES)) {
    if (!hasValidToken) {
      devLog("❌ [MIDDLEWARE] No valid token - Redirecting to login");
      const loginUrl = new URL("/account/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);

      const response = NextResponse.redirect(loginUrl);
      const hasExpiredToken =
        request.cookies.get("access_token") && !hasValidToken;

      if (hasExpiredToken) {
        response.cookies.delete("access_token");
        response.cookies.delete("refresh_token");
        devLog("🧹 [MIDDLEWARE] Cleared expired token cookies");
      }

      return response;
    }
    devLog("✅ [MIDDLEWARE] Protected UI route - Authorized");
    return NextResponse.next();
  }

  // ── Public UI routes ───────────────────────────────────────────────────────
  if (matchesRoute(pathname, PUBLIC_UI_ROUTES)) {
    devLog("🌐 [MIDDLEWARE] Public UI route - Allowing access");
    return NextResponse.next();
  }

  // ── Default — inject user ID request header + apply security headers ───────
  const requestHeaders = new Headers(request.headers);

  // Use the already-decoded payload — no second jwtDecode call.
  if (decodedToken && decodedToken.user_id) {
    requestHeaders.set("x-user-id", String(decodedToken.user_id));
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Security response headers.
  // TODO: lift to a shared helper when auth/public routes also need these.
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
