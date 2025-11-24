// frontend/src/middleware.js
import { NextResponse } from "next/server";

// Routes that require authentication
const protectedRoutes = [
  "/dashboard",
  // "/events/create-events",
  // Add more as needed
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  console.log("🔵 [MIDDLEWARE] Checking route:", pathname);

  // Check if the current route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    console.log("✅ [MIDDLEWARE] Public route, allowing access");
    return NextResponse.next();
  }

  console.log("🔒 [MIDDLEWARE] Protected route - verifying auth...");

  try {
    // Get cookies from the request
    const accessToken = request.cookies.get("access_token");

    if (!accessToken) {
      console.log("❌ [MIDDLEWARE] No access token found");
      return redirectToLogin(request);
    }

    // Call your backend /me endpoint for verification
    // FIX 1: Set the fallback to the correct Go backend port (8081)
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

    const response = await fetch(`${backendUrl}/auth/me`, {
      method: "GET",
      headers: {
        // FIX 2: Use the standard Authorization: Bearer header
        Authorization: `Bearer ${accessToken.value}`,
        "Content-Type": "application/json",
      },
      // Removed 'credentials: "include"' as it is not needed for server-to-server fetch
    });

    console.log("📡 [MIDDLEWARE] Backend response:", response.status);

    if (response.ok) {
      console.log("✅ [MIDDLEWARE] Auth verified, allowing access");
      return NextResponse.next();
    }

    // If 401, redirect to login
    if (response.status === 401) {
      console.log("🚫 [MIDDLEWARE] Unauthorized, redirecting to login");
      return redirectToLogin(request);
    }

    // For other errors, allow passage (page will handle it)
    console.warn(
      "⚠️ [MIDDLEWARE] Backend error, allowing access:",
      response.status
    );
    return NextResponse.next();
  } catch (error) {
    console.error("❌ [MIDDLEWARE] Error during auth check:", error.message);
    // On network errors, allow passage (page will handle it)
    return NextResponse.next();
  }
}

// Helper function to redirect to login
function redirectToLogin(request) {
  const loginUrl = new URL("/account/auth/login", request.url);
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname);

  console.log("🔀 [MIDDLEWARE] Redirecting to:", loginUrl.toString());
  return NextResponse.redirect(loginUrl);
}

// CRITICAL: Fix the matcher config
export const config = {
  matcher: [
    "/dashboard/:path*", // Matches /dashboard and all sub-routes
    // "/events/create-events/:path*", // Matches /events/create-events with any params
    // Add more patterns as needed
  ],
};