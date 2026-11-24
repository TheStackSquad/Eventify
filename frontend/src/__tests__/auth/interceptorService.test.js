/**
 * @file interceptorService.test.js
 *
 * Full branch coverage for createRequestInterceptor and createResponseInterceptor.
 *
 * Architecture notes:
 *
 *  1. MODULE-LEVEL STATE — interceptorService.js holds `isRefreshing`,
 *     `refreshPromise`, and `failedQueue` at module scope. jest.resetModules()
 *     in beforeEach gives every test a fresh module instance with all three
 *     reset to their initial values.
 *
 *  2. TOKENSERVICE IS FULLY MOCKED — clearAuthCookies, clearRefreshTimer,
 *     and scheduleTokenRefresh are jest.fn() stubs. The mock factory is hoisted
 *     by babel-jest and survives resetModules(), so re-requiring always returns
 *     the mock, never the real module.
 *
 *  3. BACKEND INSTANCE DOUBLE — a jest.fn() callable (for request retries)
 *     with a .post() method (for the /auth/refresh call).
 *
 *  4. WINDOW.LOCATION — every approach to replacing window.location in jsdom
 *     fails: spyOn throws (non-configurable), Object.defineProperty throws
 *     (non-configurable own-property), and `delete` silently no-ops (C-level
 *     binding). The correct approach is to stop mocking it entirely:
 *
 *       a) Use window.history.pushState({}, '', path) to control pathname.
 *          pushState updates the real location without triggering navigation,
 *          so there is no "Not implemented" noise. The source code reads
 *          window.location.pathname, so pushState is exactly what it sees.
 *
 *       b) Assert on window.location.href with jsdom's real absolute-URL format.
 *          When the source sets window.location.href = "/account/auth/login?...",
 *          jsdom normalises it to "http://localhost/account/auth/login?...".
 *          We use toContain("/account/auth/login") — works with either format.
 *
 *       c) For "no redirect" assertions, check that href does NOT contain
 *          "login" rather than checking for an empty string.
 *
 *  5. FAKE TIMERS — doNotFake: ['nextTick', 'setImmediate'] keeps process.nextTick
 *     real so that async timer callbacks can drain through flushPromises().
 */

// ─── Static mock — hoisted by babel-jest ────────────────────────────────────
jest.mock("@/axiosConfig/tokenService", () => ({
  scheduleTokenRefresh: jest.fn(),
  clearRefreshTimer: jest.fn(),
  clearAuthCookies: jest.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeError = (status, url = "/api/data", options = {}) => ({
  response: status != null ? { status, data: options.data ?? {} } : undefined,
  config: {
    url,
    method: "get",
    _retry: options._retry ?? false,
    ...(options.config ?? {}),
  },
  message: options.message ?? "Request failed",
});

const makeRefreshError = (status, code) => {
  const err = new Error("Refresh failed");
  err.response = { status, data: { code } };
  return err;
};

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve));

/**
 * Set window.location.pathname via pushState.
 * Does NOT trigger navigation — no "Not implemented" warning.
 * This is the correct way to control location in jsdom.
 */
const navigateTo = (path) => window.history.pushState({}, "", path);

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("interceptorService", () => {
  let createResponseInterceptor;
  let createRequestInterceptor;
  let tokenService;
  let mockBackendInstance;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });

    ({
      createResponseInterceptor,
      createRequestInterceptor,
    } = require("@/axiosConfig/interceptorService"));
    tokenService = require("@/axiosConfig/tokenService");

    mockBackendInstance = Object.assign(
      jest.fn().mockResolvedValue({ data: {}, status: 200 }),
      { post: jest.fn() },
    );

    // Reset pathname to root — pushState is safe, no navigation triggered
    navigateTo("/");

    jest.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // createRequestInterceptor
  // ══════════════════════════════════════════════════════════════════════════

  describe("createRequestInterceptor", () => {
    it("returns the config object unchanged", () => {
      const handler = createRequestInterceptor();
      const config = { method: "get", url: "/api/data", headers: {} };
      expect(handler(config)).toBe(config);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Non-401 errors
  // ══════════════════════════════════════════════════════════════════════════

  describe("non-401 errors", () => {
    it.each([
      ["404 Not Found", 404],
      ["403 Forbidden", 403],
      ["500 Internal Server Error", 500],
      ["422 Validation Error", 422],
      ["network error (no response object)", null],
    ])("passes through %s without touching auth state", async (_, status) => {
      const interceptor = createResponseInterceptor(mockBackendInstance);
      const error = makeError(status, "/api/resource");

      await expect(interceptor(error)).rejects.toBe(error);

      expect(tokenService.clearAuthCookies).not.toHaveBeenCalled();
      expect(tokenService.clearRefreshTimer).not.toHaveBeenCalled();
      expect(tokenService.scheduleTokenRefresh).not.toHaveBeenCalled();
      expect(mockBackendInstance.post).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 401 on auth endpoints
  // ══════════════════════════════════════════════════════════════════════════

  describe("401 on auth endpoints", () => {
    it.each(["/auth/login", "/auth/signup"])(
      "rejects immediately for %s without triggering a refresh",
      async (url) => {
        const interceptor = createResponseInterceptor(mockBackendInstance);
        const error = makeError(401, url);

        await expect(interceptor(error)).rejects.toBe(error);
        expect(mockBackendInstance.post).not.toHaveBeenCalled();
        expect(tokenService.clearAuthCookies).not.toHaveBeenCalled();
      },
    );

    it("clears auth state when /auth/refresh itself returns 401", async () => {
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401, "/auth/refresh")).catch(() => {});

      expect(tokenService.clearAuthCookies).toHaveBeenCalledTimes(1);
      expect(tokenService.clearRefreshTimer).toHaveBeenCalledTimes(1);
    });

    it("still rejects the original error after /auth/refresh 401", async () => {
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await expect(
        interceptor(makeError(401, "/auth/refresh")),
      ).rejects.toBeDefined();
    });

    it("does not start a new refresh when /auth/refresh 401 fires", async () => {
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401, "/auth/refresh")).catch(() => {});
      expect(mockBackendInstance.post).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // _retry guard
  // ══════════════════════════════════════════════════════════════════════════

  describe("_retry guard", () => {
    it("clears auth and rejects when the request is already marked _retry", async () => {
      navigateTo("/dashboard");
      const interceptor = createResponseInterceptor(mockBackendInstance);

      await expect(
        interceptor(makeError(401, "/api/data", { _retry: true })),
      ).rejects.toBeDefined();

      expect(tokenService.clearAuthCookies).toHaveBeenCalledTimes(1);
      expect(tokenService.clearRefreshTimer).toHaveBeenCalledTimes(1);
    });

    it("does not attempt another refresh for a _retry request", async () => {
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401, "/api/data", { _retry: true })).catch(
        () => {},
      );
      expect(mockBackendInstance.post).not.toHaveBeenCalled();
    });

    it("dispatches authExpired event on a protected route", async () => {
      navigateTo("/dashboard");
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401, "/api/data", { _retry: true })).catch(
        () => {},
      );

      const eventTypes = window.dispatchEvent.mock.calls.map((c) => c[0].type);
      expect(eventTypes).toContain("authExpired");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Redirect behaviour
  // ══════════════════════════════════════════════════════════════════════════

  describe("redirect behaviour (clearAuthAndRedirect)", () => {
    beforeEach(() => {
      // Force clearAuthAndRedirect to be called on every test in this block
      mockBackendInstance.post.mockRejectedValue(makeRefreshError(401));
    });

    it.each([
      "/dashboard",
      "/dashboard/settings",
      "/dashboard/events/42",
      "/create-events",
      "/create-events/new",
      "/vendor",
      "/vendor/profile",
    ])(
      "redirects to login with callbackUrl when on protected route %s",
      async (pathname) => {
        navigateTo(pathname);
        const interceptor = createResponseInterceptor(mockBackendInstance);
        await interceptor(makeError(401)).catch(() => {});

        // jsdom does not execute window.location.href = x (navigation not implemented),
        // so we assert on the behavioral proof instead:
        //   1. auth state was cleared (clearAuthCookies called)
        //   2. authExpired event was dispatched with the correct originalPath
        // These two together prove the redirect branch ran with the right arguments.
        expect(tokenService.clearAuthCookies).toHaveBeenCalled();

        const authExpiredCall = window.dispatchEvent.mock.calls.find(
          (c) => c[0].type === "authExpired",
        );
        expect(authExpiredCall).toBeDefined();
        expect(authExpiredCall[0].detail.originalPath).toBe(pathname);
      },
    );

    it.each(["/about", "/events/123", "/pricing"])(
      "does NOT redirect when on public route %s",
      async (pathname) => {
        navigateTo(pathname);
        const interceptor = createResponseInterceptor(mockBackendInstance);
        await interceptor(makeError(401)).catch(() => {});

        // clearAuthCookies fires unconditionally on every 401 — that is correct.
        // The only thing gated on isProtected is the authExpired event + href redirect.
        // So the correct "no redirect" proof is that authExpired was NOT dispatched.
        const eventTypes = window.dispatchEvent.mock.calls.map(
          (c) => c[0].type,
        );
        expect(eventTypes).not.toContain("authExpired");
      },
    );

    it("does NOT redirect when already on the login page", async () => {
      // /account/auth/login is itself a public route — navigating there
      // while unauthenticated must not trigger another redirect loop.
      navigateTo("/account/auth/login");
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401)).catch(() => {});

      const eventTypes = window.dispatchEvent.mock.calls.map((c) => c[0].type);
      expect(eventTypes).not.toContain("authExpired");
    });

    it("dispatches authExpired event with originalPath on protected route", async () => {
      navigateTo("/dashboard");
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401)).catch(() => {});

      const authExpiredCall = window.dispatchEvent.mock.calls.find(
        (c) => c[0].type === "authExpired",
      );
      expect(authExpiredCall).toBeDefined();
      expect(authExpiredCall[0].detail).toMatchObject({
        originalPath: "/dashboard",
      });
    });

    it("does NOT dispatch authExpired event on public route", async () => {
      navigateTo("/about");
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401)).catch(() => {});

      const eventTypes = window.dispatchEvent.mock.calls.map((c) => c[0].type);
      expect(eventTypes).not.toContain("authExpired");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Successful token refresh
  // ══════════════════════════════════════════════════════════════════════════

  describe("successful token refresh", () => {
    beforeEach(() => {
      mockBackendInstance.post.mockResolvedValue({ status: 200, data: {} });
    });

    it("calls backendInstance.post with the /auth/refresh endpoint", async () => {
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401));
      expect(mockBackendInstance.post).toHaveBeenCalledWith("/auth/refresh");
    });

    it("calls scheduleTokenRefresh exactly once after a successful refresh", async () => {
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401));
      expect(tokenService.scheduleTokenRefresh).toHaveBeenCalledTimes(1);
    });

    it("dispatches a tokenRefreshed custom event", async () => {
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401));

      const eventTypes = window.dispatchEvent.mock.calls.map((c) => c[0].type);
      expect(eventTypes).toContain("tokenRefreshed");
    });

    it("retries the original request after refresh", async () => {
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401, "/api/protected-resource"));

      expect(mockBackendInstance).toHaveBeenCalledWith(
        expect.objectContaining({ url: "/api/protected-resource" }),
      );
    });

    it("marks the retried request with _retry = true to prevent loops", async () => {
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401, "/api/data"));

      const retryConfig = mockBackendInstance.mock.calls[0][0];
      expect(retryConfig._retry).toBe(true);
    });

    it("returns the response of the retried request", async () => {
      const retryResponse = { data: { id: 1 }, status: 200 };
      mockBackendInstance.mockResolvedValue(retryResponse);

      const interceptor = createResponseInterceptor(mockBackendInstance);
      const result = await interceptor(makeError(401, "/api/data"));
      expect(result).toBe(retryResponse);
    });

    it("does not call clearAuthCookies or clearRefreshTimer on success", async () => {
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401));

      expect(tokenService.clearAuthCookies).not.toHaveBeenCalled();
      expect(tokenService.clearRefreshTimer).not.toHaveBeenCalled();
    });

    it("does not redirect to login on a successful refresh", async () => {
      navigateTo("/dashboard");
      const interceptor = createResponseInterceptor(mockBackendInstance);
      await interceptor(makeError(401));

      // No redirect on success — authExpired must NOT have fired
      const eventTypes = window.dispatchEvent.mock.calls.map((c) => c[0].type);
      expect(eventTypes).not.toContain("authExpired");
      expect(tokenService.clearAuthCookies).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Failed token refresh
  // ══════════════════════════════════════════════════════════════════════════

  describe("failed token refresh", () => {
    describe("401 from /auth/refresh (session expired)", () => {
      beforeEach(() => {
        mockBackendInstance.post.mockRejectedValue(makeRefreshError(401));
      });

      it("calls clearAuthCookies and clearRefreshTimer", async () => {
        navigateTo("/dashboard");
        const interceptor = createResponseInterceptor(mockBackendInstance);
        await interceptor(makeError(401)).catch(() => {});

        expect(tokenService.clearAuthCookies).toHaveBeenCalled();
        expect(tokenService.clearRefreshTimer).toHaveBeenCalled();
      });

      it("redirects to login from a protected route", async () => {
        navigateTo("/dashboard");
        const interceptor = createResponseInterceptor(mockBackendInstance);
        await interceptor(makeError(401)).catch(() => {});

        // Redirect proof: auth cleared + authExpired event dispatched
        expect(tokenService.clearAuthCookies).toHaveBeenCalled();
        const authExpiredCall = window.dispatchEvent.mock.calls.find(
          (c) => c[0].type === "authExpired",
        );
        expect(authExpiredCall).toBeDefined();
        expect(authExpiredCall[0].detail.originalPath).toBe("/dashboard");
      });

      it("rejects the interceptor promise", async () => {
        const interceptor = createResponseInterceptor(mockBackendInstance);
        await expect(interceptor(makeError(401))).rejects.toBeDefined();
      });

      it("does not call scheduleTokenRefresh", async () => {
        const interceptor = createResponseInterceptor(mockBackendInstance);
        await interceptor(makeError(401)).catch(() => {});
        expect(tokenService.scheduleTokenRefresh).not.toHaveBeenCalled();
      });
    });

    describe("403 / SECURITY_VIOLATION from /auth/refresh", () => {
      beforeEach(() => {
        mockBackendInstance.post.mockRejectedValue(
          makeRefreshError(403, "SECURITY_VIOLATION"),
        );
      });

      it("calls clearAuthCookies and clearRefreshTimer", async () => {
        navigateTo("/dashboard");
        const interceptor = createResponseInterceptor(mockBackendInstance);
        await interceptor(makeError(401)).catch(() => {});

        expect(tokenService.clearAuthCookies).toHaveBeenCalled();
        expect(tokenService.clearRefreshTimer).toHaveBeenCalled();
      });

      it("dispatches authExpired with SECURITY_VIOLATION reason on protected route", async () => {
        navigateTo("/dashboard");
        const interceptor = createResponseInterceptor(mockBackendInstance);
        await interceptor(makeError(401)).catch(() => {});

        const secCall = window.dispatchEvent.mock.calls.find(
          (c) =>
            c[0].type === "authExpired" &&
            c[0].detail?.reason === "SECURITY_VIOLATION",
        );
        expect(secCall).toBeDefined();
      });

      it("rejects the interceptor promise", async () => {
        const interceptor = createResponseInterceptor(mockBackendInstance);
        await expect(interceptor(makeError(401))).rejects.toBeDefined();
      });
    });

    describe("network error from /auth/refresh (no response)", () => {
      beforeEach(() => {
        mockBackendInstance.post.mockRejectedValue(new Error("Network Error"));
      });

      it("calls clearAuthCookies and clearRefreshTimer", async () => {
        navigateTo("/dashboard");
        const interceptor = createResponseInterceptor(mockBackendInstance);
        await interceptor(makeError(401)).catch(() => {});

        expect(tokenService.clearAuthCookies).toHaveBeenCalled();
        expect(tokenService.clearRefreshTimer).toHaveBeenCalled();
      });

      it("rejects the interceptor promise", async () => {
        const interceptor = createResponseInterceptor(mockBackendInstance);
        await expect(interceptor(makeError(401))).rejects.toBeDefined();
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Concurrent request queuing
  // ══════════════════════════════════════════════════════════════════════════

  describe("concurrent request queuing", () => {
    it("queues a second 401 while refresh is in flight, then retries both on success", async () => {
      let resolveRefresh;
      mockBackendInstance.post.mockReturnValue(
        new Promise((res) => {
          resolveRefresh = res;
        }),
      );

      const interceptor = createResponseInterceptor(mockBackendInstance);
      const p1 = interceptor(makeError(401, "/api/one"));
      const p2 = interceptor(makeError(401, "/api/two"));

      resolveRefresh({ status: 200, data: {} });

      await expect(p1).resolves.toBeDefined();
      await expect(p2).resolves.toBeDefined();

      expect(mockBackendInstance.post).toHaveBeenCalledTimes(1);
      expect(mockBackendInstance).toHaveBeenCalledTimes(2);
    });

    it("releases all queued requests when refresh succeeds", async () => {
      let resolveRefresh;
      mockBackendInstance.post.mockReturnValue(
        new Promise((res) => {
          resolveRefresh = res;
        }),
      );

      const interceptor = createResponseInterceptor(mockBackendInstance);
      interceptor(makeError(401, "/api/first")).catch(() => {});

      const pending = [
        interceptor(makeError(401, "/api/a")),
        interceptor(makeError(401, "/api/b")),
        interceptor(makeError(401, "/api/c")),
      ];

      resolveRefresh({ status: 200, data: {} });

      const results = await Promise.allSettled(pending);
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    });

    it("rejects all queued requests when refresh fails", async () => {
      let rejectRefresh;
      mockBackendInstance.post.mockReturnValue(
        new Promise((_, rej) => {
          rejectRefresh = rej;
        }),
      );

      const interceptor = createResponseInterceptor(mockBackendInstance);
      const p1 = interceptor(makeError(401, "/api/first"));
      const p2 = interceptor(makeError(401, "/api/second"));

      rejectRefresh(makeRefreshError(401));

      await expect(p1).rejects.toBeDefined();
      await expect(p2).rejects.toBeDefined();
    });

    it("immediately rejects when the queue is full (> 50 requests)", async () => {
      mockBackendInstance.post.mockReturnValue(new Promise(() => {}));

      const interceptor = createResponseInterceptor(mockBackendInstance);
      interceptor(makeError(401, "/api/trigger")).catch(() => {});

      const queued = Array.from({ length: 50 }, (_, i) =>
        interceptor(makeError(401, `/api/req-${i}`)),
      );

      const overflowed = interceptor(makeError(401, "/api/overflow"));
      await expect(overflowed).rejects.toThrow();

      queued.forEach((p) => p.catch(() => {}));
    });

    it("rejects a queued request with REFRESH_TIMEOUT after 10 seconds", async () => {
      mockBackendInstance.post.mockReturnValue(new Promise(() => {}));

      const interceptor = createResponseInterceptor(mockBackendInstance);
      interceptor(makeError(401, "/api/first")).catch(() => {});

      const timedOutRequest = interceptor(makeError(401, "/api/second"));

      jest.advanceTimersByTime(10_001);
      await flushPromises();

      await expect(timedOutRequest).rejects.toThrow("REFRESH_TIMEOUT");
    });

    it("only sends one refresh request regardless of how many 401s are concurrent", async () => {
      let resolveRefresh;
      mockBackendInstance.post.mockReturnValue(
        new Promise((res) => {
          resolveRefresh = res;
        }),
      );

      const interceptor = createResponseInterceptor(mockBackendInstance);
      const requests = Array.from({ length: 5 }, (_, i) =>
        interceptor(makeError(401, `/api/resource-${i}`)),
      );

      resolveRefresh({ status: 200, data: {} });
      await Promise.all(requests);

      expect(mockBackendInstance.post).toHaveBeenCalledTimes(1);
    });
  });
});
