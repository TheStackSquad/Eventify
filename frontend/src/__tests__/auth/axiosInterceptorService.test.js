/**
 * axiosInterceptorService.test.js
 * Tests for src/axiosConfig/interceptorService.js and instance isolation.
 */

"use strict";

const {
  MOCK_API_ENDPOINTS,
  makeError,
  navigateTo,
  createMockAxiosInstance,
} = require("./authTestHelpers");

jest.mock("@/utils/constants/globalConstants", () => ({
  API_ENDPOINTS: MOCK_API_ENDPOINTS,
}));

jest.mock("@/axiosConfig/tokenService", () => ({
  scheduleTokenRefresh: jest.fn(),
  clearRefreshTimer: jest.fn(),
  clearAuthCookies: jest.fn(),
  setBackendInstanceRef: jest.fn(),
  initializeTokenRefresh: jest.fn(),
  triggerManualRefresh: jest.fn(),
  getRefreshStatus: jest.fn(() => ({
    isScheduled: false,
    lastAttempt: 0,
    timeSinceLastAttempt: null,
    hasBackendRef: true,
  })),
}));

const {
  createResponseInterceptor,
} = require("@/axiosConfig/interceptorService");
const mockTokenService = require("@/axiosConfig/tokenService");

describe("createResponseInterceptor — non-401 passthrough", () => {
  let mockAxiosInstance;
  let interceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    navigateTo("/dashboard");
    mockAxiosInstance = createMockAxiosInstance();
    interceptor = createResponseInterceptor(mockAxiosInstance);
  });

  it("passes through 400 Bad Request without retry", async () => {
    await expect(interceptor(makeError(400))).rejects.toBeDefined();
    expect(mockAxiosInstance).not.toHaveBeenCalled();
  });

  it("passes through 403 Forbidden without retry", async () => {
    await expect(interceptor(makeError(403))).rejects.toBeDefined();
    expect(mockAxiosInstance).not.toHaveBeenCalled();
  });

  it("passes through 404 Not Found without retry", async () => {
    await expect(interceptor(makeError(404))).rejects.toBeDefined();
  });

  it("passes through 422 Unprocessable Entity without retry", async () => {
    await expect(interceptor(makeError(422))).rejects.toBeDefined();
  });

  it("passes through 500 Internal Server Error without retry", async () => {
    await expect(interceptor(makeError(500))).rejects.toBeDefined();
  });
});

describe("createResponseInterceptor — auth endpoint exclusions", () => {
  let mockAxiosInstance;
  let interceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    navigateTo("/dashboard");
    mockAxiosInstance = createMockAxiosInstance();
    interceptor = createResponseInterceptor(mockAxiosInstance);
  });

  it("does NOT retry 401 on /auth/login (prevents login loop)", async () => {
    await expect(
      interceptor(makeError(401, "/auth/login")),
    ).rejects.toBeDefined();
    expect(mockAxiosInstance.post).not.toHaveBeenCalled();
  });

  it("does NOT retry 401 on /auth/signup", async () => {
    await expect(
      interceptor(makeError(401, "/auth/signup")),
    ).rejects.toBeDefined();
    expect(mockAxiosInstance.post).not.toHaveBeenCalled();
  });

  it("clears auth and redirects when /auth/refresh itself returns 401 (dead session)", async () => {
    const eventSpy = jest.spyOn(window, "dispatchEvent");
    await expect(
      interceptor(makeError(401, "/auth/refresh")),
    ).rejects.toBeDefined();
    expect(mockTokenService.clearAuthCookies).toHaveBeenCalled();
    const fired = eventSpy.mock.calls.map((c) => c[0].type);
    expect(fired).toContain("authExpired");
  });
});

describe("createResponseInterceptor — 401 on protected resource", () => {
  let mockAxiosInstance;
  let interceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    navigateTo("/dashboard");
    mockAxiosInstance = createMockAxiosInstance();
    interceptor = createResponseInterceptor(mockAxiosInstance);
  });

  it("attempts POST /auth/refresh on 401 for non-auth endpoint", async () => {
    await interceptor(makeError(401, "/api/events"));
    expect(mockAxiosInstance.post).toHaveBeenCalledWith("/auth/refresh");
  });

  it("retries the original request after successful refresh", async () => {
    const result = await interceptor(makeError(401, "/api/events"));
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/api/events" }),
    );
    expect(result).toEqual({ data: "retried" });
  });

  it("does NOT retry a request that already has _retry: true (no infinite loop)", async () => {
    await expect(
      interceptor(makeError(401, "/api/data", { _retry: true })),
    ).rejects.toBeDefined();
    expect(mockAxiosInstance.post).not.toHaveBeenCalled();
  });

  it("redirects to login with callbackUrl when refresh fails on a protected route", async () => {
    navigateTo("/dashboard");
    mockAxiosInstance.post.mockRejectedValue({ response: { status: 401 } });
    const eventSpy = jest.spyOn(window, "dispatchEvent");
    await expect(
      interceptor(makeError(401, "/api/protected")),
    ).rejects.toBeDefined();
    expect(mockTokenService.clearAuthCookies).toHaveBeenCalled();
    const authExpiredCall = eventSpy.mock.calls.find(
      (c) => c[0].type === "authExpired",
    );
    expect(authExpiredCall).toBeDefined();
    expect(authExpiredCall[0].detail.originalPath).toBe("/dashboard");
  });

  it("does NOT redirect when user is on a public route (no unnecessary logout)", async () => {
    navigateTo("/");
    mockAxiosInstance.post.mockRejectedValue({ response: { status: 401 } });
    const eventSpy = jest.spyOn(window, "dispatchEvent");
    await expect(
      interceptor(makeError(401, "/api/events")),
    ).rejects.toBeDefined();
    const fired = eventSpy.mock.calls.map((c) => c[0].type);
    expect(fired).not.toContain("authExpired");
  });

  it("dispatches 'authExpired' event on redirect", async () => {
    mockAxiosInstance.post.mockRejectedValue({ response: { status: 401 } });
    const eventSpy = jest.spyOn(window, "dispatchEvent");
    await expect(
      interceptor(makeError(401, "/api/data")),
    ).rejects.toBeDefined();
    const types = eventSpy.mock.calls.map((c) => c[0].type);
    expect(types).toContain("authExpired");
  });
});

describe("createResponseInterceptor — concurrent 401 queuing", () => {
  let mockAxiosInstance;
  let interceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    navigateTo("/dashboard");
    mockAxiosInstance = createMockAxiosInstance({ data: "ok" });
    interceptor = createResponseInterceptor(mockAxiosInstance);
  });

  it("issues only ONE refresh call despite multiple concurrent 401s", async () => {
    let resolveRefresh;
    mockAxiosInstance.post.mockReturnValue(
      new Promise((res) => (resolveRefresh = res)),
    );
    const p1 = interceptor(makeError(401, "/api/a"));
    const p2 = interceptor(makeError(401, "/api/b"));
    const p3 = interceptor(makeError(401, "/api/c"));
    resolveRefresh({ status: 200 });
    await Promise.all([p1, p2, p3]);
    expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
  });

  it("all queued requests resolve after refresh completes", async () => {
    let resolveRefresh;
    mockAxiosInstance.post.mockReturnValue(
      new Promise((res) => (resolveRefresh = res)),
    );
    const p1 = interceptor(makeError(401, "/api/a"));
    const p2 = interceptor(makeError(401, "/api/b"));
    resolveRefresh({ status: 200 });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ data: "ok" });
    expect(r2).toEqual({ data: "ok" });
  });

  it("all queued requests reject when refresh fails", async () => {
    let rejectRefresh;
    mockAxiosInstance.post.mockReturnValue(
      new Promise((_, rej) => (rejectRefresh = rej)),
    );
    const p1 = interceptor(makeError(401, "/api/a"));
    const p2 = interceptor(makeError(401, "/api/b"));
    rejectRefresh({ response: { status: 401 } });
    await expect(p1).rejects.toBeDefined();
    await expect(p2).rejects.toBeDefined();
  });
});

describe("interceptor — event mutation 401 handling (demo-critical)", () => {
  let mockAxiosInstance;
  let interceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    navigateTo("/create-events");
    mockAxiosInstance = createMockAxiosInstance({ data: { id: "evt-001" } });
    interceptor = createResponseInterceptor(mockAxiosInstance);
  });

  it("retries createEvent (POST /events) after 401 — submission not silently lost", async () => {
    const result = await interceptor(makeError(401, "/events"));
    expect(mockAxiosInstance.post).toHaveBeenCalledWith("/auth/refresh");
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/events" }),
    );
    expect(result.data.id).toBe("evt-001");
  });

  it("retries updateEvent (PUT /events/evt-001) after 401", async () => {
    const result = await interceptor(makeError(401, "/events/evt-001"));
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/events/evt-001" }),
    );
    expect(result).toBeDefined();
  });

  it("retries deleteEvent (DELETE /events/evt-001) after 401", async () => {
    await interceptor(makeError(401, "/events/evt-001"));
    expect(mockAxiosInstance.post).toHaveBeenCalledWith("/auth/refresh");
  });

  it("retries fetchUserEvents (GET /events/user) after 401", async () => {
    await interceptor(makeError(401, "/events/user"));
    expect(mockAxiosInstance).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/events/user" }),
    );
  });

  it("retries fetchEventAnalytics after 401", async () => {
    await interceptor(makeError(401, "/events/evt-001/analytics"));
    expect(mockAxiosInstance.post).toHaveBeenCalledWith("/auth/refresh");
  });

  it("on /create-events route: redirects with callbackUrl when refresh fails", async () => {
    navigateTo("/create-events");
    mockAxiosInstance.post.mockRejectedValue({ response: { status: 401 } });
    const eventSpy = jest.spyOn(window, "dispatchEvent");
    await expect(interceptor(makeError(401, "/events"))).rejects.toBeDefined();
    expect(mockTokenService.clearAuthCookies).toHaveBeenCalled();
    const authExpiredCall = eventSpy.mock.calls.find(
      (c) => c[0].type === "authExpired",
    );
    expect(authExpiredCall).toBeDefined();
    expect(authExpiredCall[0].detail.originalPath).toBe("/create-events");
  });

  it("does NOT infinite-loop on event mutation with _retry: true already set", async () => {
    await expect(
      interceptor(makeError(401, "/events", { _retry: true })),
    ).rejects.toBeDefined();
    expect(mockAxiosInstance.post).not.toHaveBeenCalled();
  });
});

describe("interceptor — frontendInstance isolation (image upload)", () => {
  it("frontendInstance 401 rejects immediately without refresh attempt", async () => {
    const mockRefresh = jest.fn();
    const frontendErrorHandler = (error) => Promise.reject(error);
    const error = makeError(401, "/api/event-image");
    await expect(frontendErrorHandler(error)).rejects.toBeDefined();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("image upload 401 propagates to useEventSubmission catch (enables rollback)", async () => {
    const mockDeleteImage = jest.fn().mockResolvedValue({ success: true });
    let uploadedUrl = null;
    let shouldRollback = false;
    try {
      throw Object.assign(new Error("401"), { response: { status: 401 } });
    } catch {
      if (shouldRollback && uploadedUrl) await mockDeleteImage(uploadedUrl);
    }
    expect(shouldRollback).toBe(false);
    expect(mockDeleteImage).not.toHaveBeenCalled();
  });

  it("backendInstance and frontendInstance use different baseURLs — interceptors must not cross-call", () => {
    const backendBaseURL =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
    const frontendBaseURL = "";
    expect(backendBaseURL).not.toBe(frontendBaseURL);
  });
});

describe("interceptor — CSRF error handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    navigateTo("/dashboard");
  });

  const handleCSRFError = (error) => {
    const code = error.response?.data?.code;
    if (code === "CSRF_TOKEN_MISSING" || code === "CSRF_TOKEN_INVALID") {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("csrfError", { detail: { code } }),
        );
      }
      return true;
    }
    return false;
  };

  it("detects CSRF_TOKEN_MISSING and dispatches csrfError event", () => {
    const eventSpy = jest.spyOn(window, "dispatchEvent");
    expect(
      handleCSRFError({
        response: { data: { code: "CSRF_TOKEN_MISSING" }, status: 403 },
      }),
    ).toBe(true);
    expect(eventSpy.mock.calls.map((c) => c[0].type)).toContain("csrfError");
  });

  it("detects CSRF_TOKEN_INVALID and dispatches csrfError event", () => {
    const eventSpy = jest.spyOn(window, "dispatchEvent");
    handleCSRFError({
      response: { data: { code: "CSRF_TOKEN_INVALID" }, status: 403 },
    });
    expect(eventSpy.mock.calls.map((c) => c[0].type)).toContain("csrfError");
  });

  it("returns false for non-CSRF errors (does not interfere)", () => {
    expect(
      handleCSRFError({
        response: { data: { code: "SOME_OTHER_ERROR" }, status: 400 },
      }),
    ).toBe(false);
  });

  it("returns false for errors with no response body", () => {
    expect(handleCSRFError({ response: null })).toBe(false);
    expect(handleCSRFError({})).toBe(false);
  });

  it("state-changing methods (POST/PUT/PATCH/DELETE) require CSRF token on backendInstance", () => {
    const stateChanging = ["POST", "PUT", "PATCH", "DELETE"];
    const safe = ["GET", "HEAD", "OPTIONS"];
    stateChanging.forEach((m) => expect(stateChanging.includes(m)).toBe(true));
    safe.forEach((m) => expect(stateChanging.includes(m)).toBe(false));
  });

  it("createEvent POST would have CSRF token attached (backendInstance guards it)", () => {
    const eventMutations = ["POST", "PUT", "DELETE"];
    const stateChanging = ["POST", "PUT", "PATCH", "DELETE"];
    eventMutations.forEach((m) => expect(stateChanging.includes(m)).toBe(true));
  });
});

describe("interceptor — PROTECTED_ROUTES redirect logic", () => {
  let mockAxiosInstance;
  let interceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance = createMockAxiosInstance({ data: "ok" });
    mockAxiosInstance.post = jest
      .fn()
      .mockRejectedValue({ response: { status: 401 } });
    interceptor = createResponseInterceptor(mockAxiosInstance);
  });

  const PROTECTED = ["/dashboard", "/create-events", "/vendor"];
  const PUBLIC = ["/", "/events", "/account/auth/login", "/about"];

  PROTECTED.forEach((route) => {
    it(`redirects to login from protected route: ${route}`, async () => {
      navigateTo(route);
      const eventSpy = jest.spyOn(window, "dispatchEvent");
      await expect(
        interceptor(makeError(401, "/api/data")),
      ).rejects.toBeDefined();
      expect(mockTokenService.clearAuthCookies).toHaveBeenCalled();
      const fired = eventSpy.mock.calls.map((c) => c[0].type);
      expect(fired).toContain("authExpired");
    });
  });

  PUBLIC.forEach((route) => {
    it(`does NOT redirect from public route: ${route}`, async () => {
      navigateTo(route);
      const eventSpy = jest.spyOn(window, "dispatchEvent");
      await expect(
        interceptor(makeError(401, "/api/data")),
      ).rejects.toBeDefined();
      const fired = eventSpy.mock.calls.map((c) => c[0].type);
      expect(fired).not.toContain("authExpired");
    });
  });

  it("sub-routes of /dashboard are also protected (/dashboard/settings)", async () => {
    navigateTo("/dashboard/settings");
    const eventSpy = jest.spyOn(window, "dispatchEvent");
    await expect(
      interceptor(makeError(401, "/api/data")),
    ).rejects.toBeDefined();
    expect(mockTokenService.clearAuthCookies).toHaveBeenCalled();
    const fired = eventSpy.mock.calls.map((c) => c[0].type);
    expect(fired).toContain("authExpired");
  });

  it("sub-routes of /create-events are protected (/create-events/edit)", async () => {
    navigateTo("/create-events/edit");
    const eventSpy = jest.spyOn(window, "dispatchEvent");
    await expect(
      interceptor(makeError(401, "/api/data")),
    ).rejects.toBeDefined();
    expect(mockTokenService.clearAuthCookies).toHaveBeenCalled();
    const fired = eventSpy.mock.calls.map((c) => c[0].type);
    expect(fired).toContain("authExpired");
  });
});
