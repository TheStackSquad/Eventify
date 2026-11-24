/**
 * @file middleware.test.js
 *
 * ─── ARCHITECTURE NOTES ─────────────────────────────────────────────────────
 *
 * 1. NODE ENVIRONMENT
 *    middleware.js imports next/server (Edge runtime). The node project in
 *    jest.config.js handles this file — no jsdom needed.
 *
 * 2. next/server IS FULLY MOCKED
 *    NextResponse.redirect() → sentinel { type, url, cookies }
 *    NextResponse.next()     → sentinel { type, requestHeaders, headers }
 *    The headers object on next() supports set/get so security-header
 *    assertions work without the real Edge runtime.
 *
 * 3. jwt-decode IS FULLY MOCKED
 *    jwtDecode is controlled per-test. The real library is never called.
 *    isTokenValid now returns the decoded payload (not a boolean), so mocks
 *    that return objects are used directly — no second decode needed.
 *
 * 4. REQUEST FACTORY
 *    makeRequest() builds a minimal NextRequest-shaped object. Only fields
 *    that middleware.js reads are present.
 *
 * 5. SECTIONS
 *      A — isTokenValid / isAuthenticated     (token validation)
 *      B — matchesRoute                       (route pattern matching)
 *      C — middleware() routing decisions     (end-to-end)
 *      D — Security fixes verified            (open redirect, exp=0)
 *      E — Image routes via PUBLIC_UI_ROUTES  (wildcard replacement)
 *      F — Prefix collision gap               (documented behaviour)
 *      G — Coverage holes                     (missing route combos)
 *      H — Security response headers          (X-Frame-Options etc.)
 *
 * @jest-environment node
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("next/server", () => {
  const redirect = jest.fn((url) => ({
    type: "redirect",
    url: url.toString(),
    cookies: { delete: jest.fn() },
  }));

  // Each call to next() gets its own headers store so per-test assertions
  // on response.headers.set() work correctly without cross-test pollution.
  const next = jest.fn((init) => {
    const store = {};
    return {
      type: "next",
      requestHeaders: init?.request?.headers ?? null,
      headers: {
        set: jest.fn((k, v) => {
          store[k] = v;
        }),
        get: jest.fn((k) => store[k] ?? null),
      },
    };
  });

  const json = jest.fn((body, init) => ({
    type: "json",
    body,
    status: init?.status ?? 200,
  }));

  return { NextResponse: { redirect, next, json } };
});

jest.mock("jwt-decode", () => ({
  jwtDecode: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

const { NextResponse } = require("next/server");
const { jwtDecode } = require("jwt-decode");
const { middleware } = require("@/middleware");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600;
const PAST_EXP = Math.floor(Date.now() / 1000) - 3600;

/**
 * Build a minimal NextRequest-shaped object.
 * @param {string} pathname
 * @param {{ token?: string, callback?: string }} [opts]
 */
const makeRequest = (pathname, { token = null, callback = null } = {}) => {
  const searchParams = new Map();
  if (callback) searchParams.set("callbackUrl", callback);

  return {
    nextUrl: {
      pathname,
      searchParams: { get: (key) => searchParams.get(key) ?? null },
    },
    url: `http://localhost${pathname}`,
    cookies: {
      get: (name) =>
        name === "access_token" && token ? { value: token } : undefined,
    },
    headers: new Map([["x-forwarded-for", "127.0.0.1"]]),
  };
};

// Token mock helpers
const mockValidToken = (exp = FUTURE_EXP, extra = {}) =>
  jwtDecode.mockReturnValue({ exp, user_id: "user-123", ...extra });

const mockExpiredToken = () =>
  jwtDecode.mockReturnValue({ exp: PAST_EXP, user_id: "user-123" });

const mockNoExpToken = () => jwtDecode.mockReturnValue({ user_id: "user-123" }); // no exp field

const mockMalformedToken = () =>
  jwtDecode.mockImplementation(() => {
    throw new Error("Invalid token");
  });

// ─── Global setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  NextResponse.redirect.mockImplementation((url) => ({
    type: "redirect",
    url: url.toString(),
    cookies: { delete: jest.fn() },
  }));
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION A — Token validation
// ══════════════════════════════════════════════════════════════════════════════

describe("isTokenValid / isAuthenticated", () => {
  it("treats a token with a future exp as valid", () => {
    mockValidToken(FUTURE_EXP);
    expect(
      middleware(makeRequest("/dashboard", { token: "valid.t" })).type,
    ).toBe("next");
  });

  it("treats a token with a past exp as invalid → redirects", () => {
    mockExpiredToken();
    const res = middleware(makeRequest("/dashboard", { token: "expired.t" }));
    expect(res.type).toBe("redirect");
    expect(res.url).toContain("/account/auth/login");
  });

  it("treats a token with no exp field as invalid (missing expiry rejected)", () => {
    mockNoExpToken();
    const res = middleware(makeRequest("/dashboard", { token: "no-exp.t" }));
    expect(res.type).toBe("redirect");
    expect(res.url).toContain("/account/auth/login");
  });

  it("treats exp=0 token as invalid (epoch 1970 is expired)", () => {
    jwtDecode.mockReturnValue({ exp: 0, user_id: "user-123" });
    const res = middleware(makeRequest("/dashboard", { token: "zero-exp.t" }));
    expect(res.type).toBe("redirect");
    expect(res.url).toContain("/account/auth/login");
  });

  it("treats a malformed / unparseable token as invalid", () => {
    mockMalformedToken();
    expect(middleware(makeRequest("/dashboard", { token: "bad.t" })).type).toBe(
      "redirect",
    );
  });

  it("treats a missing cookie as unauthenticated", () => {
    const res = middleware(makeRequest("/dashboard"));
    expect(res.type).toBe("redirect");
    expect(NextResponse.redirect).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION B — matchesRoute
// ══════════════════════════════════════════════════════════════════════════════

describe("matchesRoute", () => {
  beforeEach(() => mockValidToken());

  it("matches an exact protected route (/dashboard)", () => {
    expect(middleware(makeRequest("/dashboard", { token: "t" })).type).toBe(
      "next",
    );
  });

  it("matches a protected route prefix (/dashboard/settings)", () => {
    expect(
      middleware(makeRequest("/dashboard/settings", { token: "t" })).type,
    ).toBe("next");
  });

  it("matches a protected route deep path (/events/my-events/123)", () => {
    expect(
      middleware(makeRequest("/events/my-events/123", { token: "t" })).type,
    ).toBe("next");
  });

  it("matches a dynamic segment (/events/[slug] → /events/my-slug)", () => {
    jwtDecode.mockReturnValue(null);
    expect(middleware(makeRequest("/events/my-slug")).type).toBe("next");
  });

  it("matches a dynamic vendor segment (/vendors/[id] → /vendors/456)", () => {
    expect(middleware(makeRequest("/vendors/456")).type).toBe("next");
  });

  it("/api/upload-image passes through to default handler (not in any explicit list)", () => {
    // Not in PUBLIC_UI_ROUTES or PUBLIC_API_ROUTES — falls to default.
    // Default handler always returns next() — this is a passthrough, not a
    // classified public route. Section E covers the three real image routes.
    expect(middleware(makeRequest("/api/upload-image")).type).toBe("next");
  });

  it("does not match an unrelated path as protected", () => {
    expect(middleware(makeRequest("/about")).type).toBe("next");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION C — End-to-end routing decisions
// ══════════════════════════════════════════════════════════════════════════════

describe("middleware — auth routes", () => {
  it("redirects authenticated user from /account/auth/login to /dashboard", () => {
    mockValidToken();
    const res = middleware(
      makeRequest("/account/auth/login", { token: "valid.t" }),
    );
    expect(res.type).toBe("redirect");
    expect(res.url).toContain("/dashboard");
  });

  it("redirects authenticated user to a valid callbackUrl when present", () => {
    mockValidToken();
    const res = middleware(
      makeRequest("/account/auth/login", {
        token: "valid.t",
        callback: "/events/my-events",
      }),
    );
    expect(res.type).toBe("redirect");
    expect(res.url).toContain("/events/my-events");
  });

  it("redirects authenticated user away from /account/auth/signup", () => {
    mockValidToken();
    const res = middleware(
      makeRequest("/account/auth/signup", { token: "valid.t" }),
    );
    expect(res.type).toBe("redirect");
    expect(res.url).toContain("/dashboard");
  });

  it("allows unauthenticated user to access /account/auth/login", () => {
    expect(middleware(makeRequest("/account/auth/login")).type).toBe("next");
  });

  it("allows unauthenticated user to access /account/auth/signup", () => {
    expect(middleware(makeRequest("/account/auth/signup")).type).toBe("next");
  });
});

describe("middleware — protected UI routes", () => {
  it("allows authenticated user to access /dashboard", () => {
    mockValidToken();
    expect(
      middleware(makeRequest("/dashboard", { token: "valid.t" })).type,
    ).toBe("next");
  });

  it("allows authenticated user to access /profile", () => {
    mockValidToken();
    expect(middleware(makeRequest("/profile", { token: "valid.t" })).type).toBe(
      "next",
    );
  });

  it("allows authenticated user to access /events/create-events", () => {
    mockValidToken();
    expect(
      middleware(makeRequest("/events/create-events", { token: "valid.t" }))
        .type,
    ).toBe("next");
  });

  it("allows authenticated user to access /events/my-events", () => {
    mockValidToken();
    expect(
      middleware(makeRequest("/events/my-events", { token: "valid.t" })).type,
    ).toBe("next");
  });

  it("redirects unauthenticated user from /dashboard → login with callbackUrl", () => {
    const res = middleware(makeRequest("/dashboard"));
    expect(res.type).toBe("redirect");
    expect(res.url).toContain("/account/auth/login");
    expect(res.url).toContain("callbackUrl=%2Fdashboard");
  });

  it("redirects unauthenticated user from /profile → login", () => {
    const res = middleware(makeRequest("/profile"));
    expect(res.type).toBe("redirect");
    expect(res.url).toContain("/account/auth/login");
  });

  it("redirects unauthenticated user from /events/create-events → login", () => {
    const res = middleware(makeRequest("/events/create-events"));
    expect(res.type).toBe("redirect");
    expect(res.url).toContain("/account/auth/login");
    expect(res.url).toContain("callbackUrl=%2Fevents%2Fcreate-events");
  });

  it("redirects unauthenticated user from /events/my-events → login", () => {
    expect(middleware(makeRequest("/events/my-events")).type).toBe("redirect");
  });

  it("deletes cookies when token is expired and redirect fires", () => {
    mockExpiredToken();
    const res = middleware(makeRequest("/dashboard", { token: "expired.t" }));
    expect(res.type).toBe("redirect");
    expect(res.cookies.delete).toHaveBeenCalledWith("access_token");
    expect(res.cookies.delete).toHaveBeenCalledWith("refresh_token");
  });

  it("deletes cookies when token is present but malformed", () => {
    mockMalformedToken();
    const res = middleware(makeRequest("/dashboard", { token: "garbage.t" }));
    expect(res.type).toBe("redirect");
    expect(res.cookies.delete).toHaveBeenCalledWith("access_token");
    expect(res.cookies.delete).toHaveBeenCalledWith("refresh_token");
  });

  it("does NOT delete cookies when there is no token at all", () => {
    const res = middleware(makeRequest("/dashboard"));
    expect(res.type).toBe("redirect");
    expect(res.cookies.delete).not.toHaveBeenCalled();
  });

  it("/events/create-events is protected even though /events is public", () => {
    // Confirm route evaluation order: PROTECTED checked before PUBLIC.
    mockValidToken();
    expect(
      middleware(makeRequest("/events/create-events", { token: "valid.t" }))
        .type,
    ).toBe("next");
    expect(middleware(makeRequest("/events/create-events")).type).toBe(
      "redirect",
    );
  });
});

describe("middleware — public UI routes (unauthenticated)", () => {
  it.each([
    "/",
    "/about",
    "/contact",
    "/events",
    "/forgot-password",
    "/reset-password",
    "/confirmation",
  ])("allows access to %s without a token", (path) => {
    expect(middleware(makeRequest(path)).type).toBe("next");
  });

  it("allows access to /vendors/123 without a token (dynamic segment)", () => {
    expect(middleware(makeRequest("/vendors/123")).type).toBe("next");
  });
});

describe("middleware — public UI routes (authenticated user)", () => {
  beforeEach(() => mockValidToken());

  it("allows authenticated user to access / (no redirect to dashboard)", () => {
    expect(middleware(makeRequest("/", { token: "valid.t" })).type).toBe(
      "next",
    );
  });

  it("allows authenticated user to access /about", () => {
    expect(middleware(makeRequest("/about", { token: "valid.t" })).type).toBe(
      "next",
    );
  });

  it("allows authenticated user to access /events", () => {
    expect(middleware(makeRequest("/events", { token: "valid.t" })).type).toBe(
      "next",
    );
  });
});

describe("middleware — public API routes", () => {
  it.each([
    "/api/payments/verify",
    "/api/orders/initialize",
    "/api/webhooks/paystack",
    "/api/v1/feedback",
    "/api/v1/vendors",
    "/auth/login",
    "/auth/refresh",
    "/auth/signup",
    "/auth/forgot-password",
  ])("allows %s without a token", (path) => {
    expect(middleware(makeRequest(path)).type).toBe("next");
  });
});

describe("middleware — default passthrough never forwards x-user-id", () => {
  it("does not inject x-user-id for authenticated requests", () => {
    mockValidToken();
    const res = middleware(makeRequest("/some/unknown/route", { token: "t" }));
    expect(res.type).toBe("next");
    expect(res.requestHeaders.get("x-user-id")).toBeFalsy();
  });

  it("strips a client-supplied x-user-id", () => {
    const req = makeRequest("/some/unknown/route");
    req.headers.set("x-user-id", "spoofed"); // headers is a Map in this factory
    const res = middleware(req);
    expect(res.requestHeaders.get("x-user-id")).toBeFalsy();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION D — Security fixes verified
// ══════════════════════════════════════════════════════════════════════════════

describe("middleware — open redirect protection", () => {
  it("absolute callbackUrl is rejected — falls back to /dashboard", () => {
    mockValidToken();
    const res = middleware(
      makeRequest("/account/auth/login", {
        token: "valid.t",
        callback: "https://evil.com/steal",
      }),
    );
    expect(res.type).toBe("redirect");
    expect(res.url).not.toMatch(/^https?:\/\/evil\.com/);
    expect(res.url).toContain("/dashboard");
  });

  it("protocol-relative callbackUrl is rejected — falls back to /dashboard", () => {
    mockValidToken();
    const res = middleware(
      makeRequest("/account/auth/signup", {
        token: "valid.t",
        callback: "//evil.com/phish",
      }),
    );
    expect(res.url).not.toContain("evil.com");
    expect(res.url).toContain("/dashboard");
  });

  it("bare-slash callbackUrl (/) is rejected — regex requires non-slash after /", () => {
    mockValidToken();
    const res = middleware(
      makeRequest("/account/auth/login", {
        token: "valid.t",
        callback: "/",
      }),
    );
    expect(res.url).toContain("/dashboard");
    expect(res.url).not.toBe("http://localhost/");
  });

  it("valid relative callbackUrl is honoured", () => {
    mockValidToken();
    const res = middleware(
      makeRequest("/account/auth/login", {
        token: "valid.t",
        callback: "/events/my-events",
      }),
    );
    expect(res.url).toContain("/events/my-events");
  });

  it("GAP: unknown /api route falls through to default handler (no 401)", () => {
    const res = middleware(makeRequest("/api/v1/admin/users"));
    expect(res.type).toBe("next");
    // Reached default handler — requestHeaders is always set there
    expect(res.requestHeaders).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION E — Image routes correctly served by PUBLIC_UI_ROUTES
// ══════════════════════════════════════════════════════════════════════════════


// describe("matchesRoute — image routes hit PUBLIC_UI_ROUTES (not default handler) : DELETED

describe("image and verify routes require a session", () => {
  const PROTECTED_API = [
    "/api/event-image", "/api/feedback-image", "/api/vendor-image",
    "/api/vnin-verify", "/api/verify-business",
  ];

  it.each(PROTECTED_API)("%s answers 401 without a token", (path) => {
    const res = middleware(makeRequest(path));
    expect(res.type).toBe("json");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Authentication required." });
  });

  it.each(PROTECTED_API)("%s answers 401 for an expired token", (path) => {
    mockExpiredToken();
    expect(middleware(makeRequest(path, { token: "t" })).status).toBe(401);
  });

  it.each(PROTECTED_API)("%s answers 401 for a malformed token", (path) => {
    mockMalformedToken();
    expect(middleware(makeRequest(path, { token: "t" })).status).toBe(401);
  });

  it.each(PROTECTED_API)("%s passes through with a valid token", (path) => {
    mockValidToken();
    expect(middleware(makeRequest(path, { token: "t" })).type).toBe("next");
  });

  it("the rule covers sub-paths too", () => {
    expect(middleware(makeRequest("/api/vendor-image/anything")).status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION F — Prefix collision gap (documented, not a regression)
// ══════════════════════════════════════════════════════════════════════════════

describe("matchesRoute — PUBLIC_API_ROUTES prefix collision (documented gap)", () => {
  // /api/v1/vendors in PUBLIC_API_ROUTES causes all sub-paths to match as public.
  // This is intentional if the backend enforces auth on protected sub-routes.
  // These tests exist to prevent silent regression — if the behaviour changes,
  // these fail and force a conscious decision.

  it("GAP: /api/v1/vendors/admin-panel is treated as public (prefix match)", () => {
    expect(middleware(makeRequest("/api/v1/vendors/admin-panel")).type).toBe(
      "next",
    );
  });

  it("GAP: /api/v1/vendors/9999/delete is treated as public (prefix match)", () => {
    expect(middleware(makeRequest("/api/v1/vendors/9999/delete")).type).toBe(
      "next",
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION G — Coverage holes
// ══════════════════════════════════════════════════════════════════════════════

describe("middleware — cookie deletion edge cases", () => {
  it("deletes cookies for expired token (covered in protected routes too — explicit here)", () => {
    mockExpiredToken();
    const res = middleware(makeRequest("/profile", { token: "expired.t" }));
    expect(res.cookies.delete).toHaveBeenCalledWith("access_token");
    expect(res.cookies.delete).toHaveBeenCalledWith("refresh_token");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION H — Security response headers
// ══════════════════════════════════════════════════════════════════════════════

describe("middleware — security response headers (default handler)", () => {
  // Security headers are set on responses from the default pass-through handler.
  // Auth/protected/public route handlers return early and do not set these yet.
  // TODO: lift to a shared helper to cover all responses.

  it("sets X-Frame-Options: DENY", () => {
    const res = middleware(makeRequest("/some-unknown-path"));
    expect(res.headers.set).toHaveBeenCalledWith("X-Frame-Options", "DENY");
  });

  it("sets X-Content-Type-Options: nosniff", () => {
    const res = middleware(makeRequest("/some-unknown-path"));
    expect(res.headers.set).toHaveBeenCalledWith(
      "X-Content-Type-Options",
      "nosniff",
    );
  });

  it("sets Referrer-Policy: strict-origin-when-cross-origin", () => {
    const res = middleware(makeRequest("/some-unknown-path"));
    expect(res.headers.set).toHaveBeenCalledWith(
      "Referrer-Policy",
      "strict-origin-when-cross-origin",
    );
  });

  it("security headers are present on authenticated default-path requests too", () => {
    mockValidToken(FUTURE_EXP, { user_id: "u1" });
    const res = middleware(
      makeRequest("/some-unknown-path", { token: "valid.t" }),
    );
    expect(res.headers.set).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    expect(res.headers.set).toHaveBeenCalledWith(
      "X-Content-Type-Options",
      "nosniff",
    );
  });
});
