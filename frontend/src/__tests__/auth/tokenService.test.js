/**
 * @file tokenService.test.js
 *
 * Full branch coverage for tokenService:
 *   scheduleTokenRefresh / clearRefreshTimer / clearAuthCookies /
 *   initializeTokenRefresh / triggerManualRefresh / getRefreshStatus /
 *   setBackendInstanceRef
 *
 * Architecture notes that drive the test strategy:
 *
 *  1. MODULE-LEVEL STATE — tokenService holds `refreshTimer`,
 *     `backendInstanceRef`, and `lastRefreshAttempt` at module scope.
 *     jest.resetModules() in beforeEach forces Node to re-evaluate the module,
 *     resetting all three to their initial values on every test.
 *
 *  2. FAKE TIMERS — the real REFRESH_INTERVAL is 19.2 hours. We use
 *     jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }) so we can
 *     call jest.advanceTimersByTime() to fire scheduled callbacks instantly.
 *     Date.now() is also advanced by @sinonjs/fake-timers (the default in
 *     Jest 27+), which lets us test the spam-guard branch precisely.
 *     CRITICAL: doNotFake is required — without it, Jest's fake-timer engine
 *     also intercepts process.nextTick, which starves the microtask queue and
 *     causes every async timer callback to hang until the 5 s Jest timeout.
 *
 *  3. GLOBALCONSTANTS IS MOCKED — only the shape we need (AUTH.REFRESH)
 *     is provided.  Avoids resolving the full @/ alias and keeps tests fast.
 *
 *  4. ASYNC CALLBACK FLUSHING — the setTimeout callback in tokenService is an
 *     `async` function. After jest.advanceTimersByTime() fires the timer we
 *     drain the microtask queue via process.nextTick (kept real by doNotFake)
 *     so that the awaited post() response fully propagates before we assert.
 *
 *  5. CONSTANTS are replicated here at the values defined in the source so
 *     test intent is explicit and we catch regressions if the source changes.
 */

// ─── Static mock — hoisted by babel-jest ────────────────────────────────────
jest.mock("@/utils/constants/globalConstants", () => ({
  API_ENDPOINTS: {
    AUTH: { REFRESH: "/auth/refresh" },
  },
}));

// ─── Constants matching tokenService source ──────────────────────────────────
const ACCESS_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1_000; // 24 h
const REFRESH_INTERVAL = ACCESS_TOKEN_LIFETIME_MS * 0.8; // 19.2 h
const MIN_REFRESH_INTERVAL = 60_000; // 1 minute
const NETWORK_RETRY_DELAY = 5 * 60 * 1_000; // 5 minutes

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Advance fake timers by `ms` then drain the microtask queue so that any
 * async work inside the setTimeout callback has fully resolved/rejected.
 */
const advanceAndFlush = async (ms) => {
  jest.advanceTimersByTime(ms);
  await new Promise((resolve) => process.nextTick(resolve));
};

/**
 * Build an Axios-like error with an optional .response.
 */
const makeAxiosError = (status, code) => {
  const err = new Error(`HTTP ${status}`);
  err.response = { status, data: { code } };
  return err;
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("tokenService", () => {
  // Re-imported fresh per test after resetModules()
  let scheduleTokenRefresh;
  let clearRefreshTimer;
  let clearAuthCookies;
  let setBackendInstanceRef;
  let initializeTokenRefresh;
  let triggerManualRefresh;
  let getRefreshStatus;

  // Test double for the axios backend instance
  let mockBackendInstance;

  // ── Setup / Teardown ──────────────────────────────────────────────────────

  beforeEach(() => {
    // 1. Fresh module → refreshTimer = null, backendInstanceRef = null,
    //    lastRefreshAttempt = 0
    jest.resetModules();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });

    // 2. Re-require to pick up the clean module instance
    ({
      scheduleTokenRefresh,
      clearRefreshTimer,
      clearAuthCookies,
      setBackendInstanceRef,
      initializeTokenRefresh,
      triggerManualRefresh,
      getRefreshStatus,
    } = require("@/axiosConfig/tokenService"));

    // 3. Provide a minimal backend instance with a controllable .post()
    mockBackendInstance = { post: jest.fn() };
    setBackendInstanceRef(mockBackendInstance);

    // 4. Watch custom event dispatching
    jest.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // setBackendInstanceRef
  // ══════════════════════════════════════════════════════════════════════════

  describe("setBackendInstanceRef", () => {
    it("makes hasBackendRef true in getRefreshStatus", () => {
      expect(getRefreshStatus().hasBackendRef).toBe(true);
    });

    it("makes hasBackendRef false when called with null", () => {
      setBackendInstanceRef(null);
      expect(getRefreshStatus().hasBackendRef).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // scheduleTokenRefresh — scheduling mechanics
  // ══════════════════════════════════════════════════════════════════════════

  describe("scheduleTokenRefresh — scheduling mechanics", () => {
    it("schedules a refresh that fires at the default REFRESH_INTERVAL", async () => {
      mockBackendInstance.post.mockResolvedValue({ status: 200, data: {} });
      scheduleTokenRefresh();

      // One millisecond before the interval — must not have fired yet
      jest.advanceTimersByTime(REFRESH_INTERVAL - 1);
      expect(mockBackendInstance.post).not.toHaveBeenCalled();

      // Exactly at the interval — fires now
      await advanceAndFlush(1);
      expect(mockBackendInstance.post).toHaveBeenCalledWith("/auth/refresh");
    });

    it("respects a custom interval", async () => {
      mockBackendInstance.post.mockResolvedValue({ status: 200, data: {} });
      const custom = 5_000;
      scheduleTokenRefresh(custom);

      jest.advanceTimersByTime(custom - 1);
      expect(mockBackendInstance.post).not.toHaveBeenCalled();

      await advanceAndFlush(1);
      expect(mockBackendInstance.post).toHaveBeenCalledWith("/auth/refresh");
    });

    it("cancels a previously scheduled timer when called again", async () => {
      mockBackendInstance.post.mockResolvedValue({ status: 200, data: {} });

      // First schedule at 1 000 ms
      scheduleTokenRefresh(1_000);
      // Immediately replace with a 5 000 ms schedule
      scheduleTokenRefresh(5_000);

      // Advance past the first timer — it must have been cleared
      await advanceAndFlush(1_001);
      expect(mockBackendInstance.post).not.toHaveBeenCalled();

      // Advance to the second timer
      await advanceAndFlush(3_999);
      expect(mockBackendInstance.post).toHaveBeenCalledTimes(1);
    });

    it("sets isScheduled to true immediately after being called", () => {
      scheduleTokenRefresh(10_000);
      expect(getRefreshStatus().isScheduled).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // scheduleTokenRefresh — successful refresh callback
  // ══════════════════════════════════════════════════════════════════════════

  describe("scheduleTokenRefresh — on successful refresh", () => {
    beforeEach(() => {
      mockBackendInstance.post.mockResolvedValue({ status: 200, data: {} });
    });

    it("calls post with the /auth/refresh endpoint", async () => {
      scheduleTokenRefresh(1);
      await advanceAndFlush(1);

      expect(mockBackendInstance.post).toHaveBeenCalledWith("/auth/refresh");
    });

    it("dispatches a tokenRefreshed custom event", async () => {
      scheduleTokenRefresh(1);
      await advanceAndFlush(1);

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "tokenRefreshed" }),
      );
    });

    it("includes a timestamp in the tokenRefreshed event detail", async () => {
      scheduleTokenRefresh(1);
      await advanceAndFlush(1);

      const event = window.dispatchEvent.mock.calls.find(
        (c) => c[0].type === "tokenRefreshed",
      )?.[0];
      expect(event?.detail?.timestamp).toBeGreaterThan(0);
    });

    it("schedules the next refresh after success (self-renewing)", async () => {
      scheduleTokenRefresh(1);
      await advanceAndFlush(1);

      // A new timer must be pending — scheduler is self-renewing
      expect(getRefreshStatus().isScheduled).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // scheduleTokenRefresh — spam guard (MIN_REFRESH_INTERVAL)
  // ══════════════════════════════════════════════════════════════════════════

  describe("scheduleTokenRefresh — spam guard", () => {
    it("skips the refresh call and reschedules when last attempt is too recent", async () => {
      mockBackendInstance.post.mockResolvedValue({ status: 200, data: {} });

      // Set lastRefreshAttempt to "right now" via triggerManualRefresh
      await triggerManualRefresh();
      mockBackendInstance.post.mockClear();

      // Schedule with a 1 ms interval — fires almost immediately,
      // well within the 60 s MIN_REFRESH_INTERVAL window
      scheduleTokenRefresh(1);
      await advanceAndFlush(1); // only 1 ms has elapsed since last attempt

      // Spam guard should prevent the post() call
      expect(mockBackendInstance.post).not.toHaveBeenCalled();

      // But a new timer must have been scheduled (reschedule, not abort)
      expect(getRefreshStatus().isScheduled).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // scheduleTokenRefresh — 401 failure (session expired)
  // ══════════════════════════════════════════════════════════════════════════

  describe("scheduleTokenRefresh — on 401 failure", () => {
    beforeEach(() => {
      mockBackendInstance.post.mockRejectedValue(makeAxiosError(401));
    });

    it("stops the refresh scheduler (no new timer)", async () => {
      scheduleTokenRefresh(1);
      await advanceAndFlush(1);

      expect(getRefreshStatus().isScheduled).toBe(false);
    });

    it("dispatches a sessionExpired event with REFRESH_TOKEN_EXPIRED reason", async () => {
      scheduleTokenRefresh(1);
      await advanceAndFlush(1);

      const event = window.dispatchEvent.mock.calls.find(
        (c) => c[0].type === "sessionExpired",
      )?.[0];
      expect(event).toBeDefined();
      expect(event?.detail?.reason).toBe("REFRESH_TOKEN_EXPIRED");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // scheduleTokenRefresh — 403 failure (security violation)
  // ══════════════════════════════════════════════════════════════════════════

  describe("scheduleTokenRefresh — on 403 failure (security violation)", () => {
    beforeEach(() => {
      mockBackendInstance.post.mockRejectedValue(makeAxiosError(403));
    });

    it("stops the refresh scheduler", async () => {
      scheduleTokenRefresh(1);
      await advanceAndFlush(1);

      expect(getRefreshStatus().isScheduled).toBe(false);
    });

    it("does NOT dispatch sessionExpired (silent stop — let backend handle it)", async () => {
      scheduleTokenRefresh(1);
      await advanceAndFlush(1);

      const eventTypes = window.dispatchEvent.mock.calls.map((c) => c[0].type);
      expect(eventTypes).not.toContain("sessionExpired");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // scheduleTokenRefresh — network / server error (retry with backoff)
  // ══════════════════════════════════════════════════════════════════════════

  describe("scheduleTokenRefresh — on network error", () => {
    it("reschedules with a 5-minute backoff rather than stopping", async () => {
      // No .response → server unreachable / connection refused
      mockBackendInstance.post.mockRejectedValue(new Error("Network Error"));

      scheduleTokenRefresh(1);
      await advanceAndFlush(1);

      // Scheduler must still be running
      expect(getRefreshStatus().isScheduled).toBe(true);

      // Advance to just before the backoff elapses — must not have fired again
      mockBackendInstance.post.mockClear();
      jest.advanceTimersByTime(NETWORK_RETRY_DELAY - 1);
      expect(mockBackendInstance.post).not.toHaveBeenCalled();

      // Advance the remaining 1 ms — backoff fires
      await advanceAndFlush(1);
      expect(mockBackendInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // scheduleTokenRefresh — no backend instance
  // ══════════════════════════════════════════════════════════════════════════

  describe("scheduleTokenRefresh — no backendInstanceRef", () => {
    it("returns without throwing or calling post when ref is null", async () => {
      setBackendInstanceRef(null);
      scheduleTokenRefresh(1);
      await advanceAndFlush(1);

      expect(mockBackendInstance.post).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // clearRefreshTimer
  // ══════════════════════════════════════════════════════════════════════════

  describe("clearRefreshTimer", () => {
    it("cancels an active timer so the callback never fires", async () => {
      mockBackendInstance.post.mockResolvedValue({ status: 200, data: {} });
      scheduleTokenRefresh(1_000);

      clearRefreshTimer();
      await advanceAndFlush(1_001);

      expect(mockBackendInstance.post).not.toHaveBeenCalled();
    });

    it("sets isScheduled to false", () => {
      scheduleTokenRefresh(5_000);
      clearRefreshTimer();

      expect(getRefreshStatus().isScheduled).toBe(false);
    });

    it("is a safe no-op when no timer is active", () => {
      expect(() => clearRefreshTimer()).not.toThrow();
      expect(getRefreshStatus().isScheduled).toBe(false);
    });

    it("is idempotent — calling twice does not throw", () => {
      scheduleTokenRefresh(5_000);
      clearRefreshTimer();
      expect(() => clearRefreshTimer()).not.toThrow();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // clearAuthCookies
  // ══════════════════════════════════════════════════════════════════════════

  describe("clearAuthCookies", () => {
    it("cancels an active refresh timer", () => {
      scheduleTokenRefresh(5_000);
      clearAuthCookies();

      expect(getRefreshStatus().isScheduled).toBe(false);
    });

    it("is a safe no-op when no timer is active", () => {
      expect(() => clearAuthCookies()).not.toThrow();
    });

    it("does not throw when called multiple times in a row", () => {
      expect(() => {
        clearAuthCookies();
        clearAuthCookies();
        clearAuthCookies();
      }).not.toThrow();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // initializeTokenRefresh
  // ══════════════════════════════════════════════════════════════════════════

  describe("initializeTokenRefresh", () => {
    it("starts the refresh scheduler", () => {
      initializeTokenRefresh();
      expect(getRefreshStatus().isScheduled).toBe(true);
    });

    it("schedules a timer at the default REFRESH_INTERVAL", async () => {
      mockBackendInstance.post.mockResolvedValue({ status: 200, data: {} });
      initializeTokenRefresh();

      jest.advanceTimersByTime(REFRESH_INTERVAL - 1);
      expect(mockBackendInstance.post).not.toHaveBeenCalled();

      await advanceAndFlush(1);
      expect(mockBackendInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // triggerManualRefresh
  // ══════════════════════════════════════════════════════════════════════════

  describe("triggerManualRefresh", () => {
    it("throws synchronously when no backendInstanceRef is set", async () => {
      setBackendInstanceRef(null);

      await expect(triggerManualRefresh()).rejects.toThrow(
        "Backend instance not initialized",
      );
    });

    it("calls post with the /auth/refresh endpoint", async () => {
      mockBackendInstance.post.mockResolvedValue({
        status: 200,
        data: { ok: true },
      });
      await triggerManualRefresh();

      expect(mockBackendInstance.post).toHaveBeenCalledWith("/auth/refresh");
    });

    it("returns response.data on success", async () => {
      const payload = { accessToken: "abc123", expiresIn: 86400 };
      mockBackendInstance.post.mockResolvedValue({
        status: 200,
        data: payload,
      });

      const result = await triggerManualRefresh();
      expect(result).toEqual(payload);
    });

    it("resets the automatic scheduler after a successful manual refresh", async () => {
      mockBackendInstance.post.mockResolvedValue({ status: 200, data: {} });
      await triggerManualRefresh();

      expect(getRefreshStatus().isScheduled).toBe(true);
    });

    it("updates lastRefreshAttempt on success", async () => {
      mockBackendInstance.post.mockResolvedValue({ status: 200, data: {} });
      const before = Date.now();
      await triggerManualRefresh();

      expect(getRefreshStatus().lastAttempt).toBeGreaterThanOrEqual(before);
    });

    it("updates lastRefreshAttempt even before the post call completes (optimistic lock)", async () => {
      // We want to confirm lastRefreshAttempt is set before the await,
      // which the spam guard relies on to prevent double-firing
      let lastAttemptDuringCall;
      mockBackendInstance.post.mockImplementation(async () => {
        lastAttemptDuringCall = getRefreshStatus().lastAttempt;
        return { status: 200, data: {} };
      });

      const callTime = Date.now();
      await triggerManualRefresh();

      expect(lastAttemptDuringCall).toBeGreaterThanOrEqual(callTime);
    });

    it("rethrows the original error on failure", async () => {
      const err = makeAxiosError(401);
      mockBackendInstance.post.mockRejectedValue(err);

      await expect(triggerManualRefresh()).rejects.toThrow("HTTP 401");
    });

    it("does not swallow non-auth errors", async () => {
      const networkError = new Error("ECONNREFUSED");
      mockBackendInstance.post.mockRejectedValue(networkError);

      await expect(triggerManualRefresh()).rejects.toThrow("ECONNREFUSED");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // getRefreshStatus
  // ══════════════════════════════════════════════════════════════════════════

  describe("getRefreshStatus", () => {
    it("returns correct initial state (no timer, no previous attempt)", () => {
      // setBackendInstanceRef was already called in beforeEach with a mock
      const status = getRefreshStatus();

      expect(status.isScheduled).toBe(false);
      expect(status.lastAttempt).toBe(0);
      expect(status.timeSinceLastAttempt).toBeNull();
      expect(status.hasBackendRef).toBe(true);
    });

    it("returns isScheduled: true after scheduleTokenRefresh", () => {
      scheduleTokenRefresh(10_000);
      expect(getRefreshStatus().isScheduled).toBe(true);
    });

    it("returns isScheduled: false after clearRefreshTimer", () => {
      scheduleTokenRefresh(10_000);
      clearRefreshTimer();
      expect(getRefreshStatus().isScheduled).toBe(false);
    });

    it("returns hasBackendRef: false when ref is cleared", () => {
      setBackendInstanceRef(null);
      expect(getRefreshStatus().hasBackendRef).toBe(false);
    });

    it("returns a non-null timeSinceLastAttempt after a manual refresh", async () => {
      mockBackendInstance.post.mockResolvedValue({ status: 200, data: {} });
      await triggerManualRefresh();

      const { timeSinceLastAttempt } = getRefreshStatus();
      expect(timeSinceLastAttempt).not.toBeNull();
      expect(timeSinceLastAttempt).toBeGreaterThanOrEqual(0);
    });

    it("timeSinceLastAttempt increases as fake time advances", async () => {
      mockBackendInstance.post.mockResolvedValue({ status: 200, data: {} });
      await triggerManualRefresh();

      const { timeSinceLastAttempt: before } = getRefreshStatus();

      jest.advanceTimersByTime(30_000);
      const { timeSinceLastAttempt: after } = getRefreshStatus();

      expect(after).toBeGreaterThan(before);
    });
  });
});
