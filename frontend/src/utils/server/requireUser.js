//frontend/ src/utils/server/requireUser.js

// Server-only. Asks the Go API (signature + expiry + revocation list) whether the caller
// has a live session. middleware.js cannot: jwtDecode() only decodes, it never verifies.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
// Any Go route behind AuthMiddleware that returns the current user works.
const AUTH_CHECK_URL = process.env.AUTH_CHECK_URL || `${API_BASE_URL}/auth/me`;

function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function requireUser(request) {
  const token = readCookie(request.headers.get("cookie"), "access_token");
  if (!token) return null;

  try {
    const res = await fetch(AUTH_CHECK_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const body = await res.json();
    const user = body?.user ?? body?.data ?? body;
    const id = user?.id ?? user?.user_id ?? user?.userId;
    return id ? { id: String(id) } : null;
  } catch {
    return null; // fail closed
  }
}