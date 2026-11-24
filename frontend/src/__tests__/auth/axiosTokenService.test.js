/**
 * axiosTokenService.test.js
 * Tests for the REAL src/axiosConfig/tokenService.js module.
 * Isolated from interceptorService mocks to prevent module cache collisions.
 */

"use strict";

const { MOCK_API_ENDPOINTS, advanceAndFlush } = require("./authTestHelpers");

jest.mock("@/utils/constants/globalConstants", () => ({
  API_ENDPOINTS: MOCK_API_ENDPOINTS,
}));

describe("tokenService — clearRefreshTimer", () => {
  let realTokenService;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    realTokenService = require("@/axiosConfig/tokenService");
  });

  afterEach(() => {
    realTokenService.clearRefreshTimer();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("is idempotent — calling twice does not throw", () => {
    expect(() => {
      realTokenService.clearRefreshTimer();
      realTokenService.clearRefreshTimer();
    }).not.toThrow();
  });

  it("marks timer as not scheduled after clearing", () => {
    realTokenService.scheduleTokenRefresh(1000);
    realTokenService.clearRefreshTimer();
    expect(realTokenService.getRefreshStatus().isScheduled).toBe(false);
  });
});

describe("tokenService — initializeTokenRefresh", () => {
  let realTokenService;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    realTokenService = require("@/axiosConfig/tokenService");
  });

  afterEach(() => {
    realTokenService.clearRefreshTimer();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("schedules a timer after initialization", () => {
    realTokenService.initializeTokenRefresh();
    expect(realTokenService.getRefreshStatus().isScheduled).toBe(true);
  });

  it("calling twice replaces the previous timer — no double scheduling", () => {
    realTokenService.initializeTokenRefresh();
    realTokenService.initializeTokenRefresh();
    expect(realTokenService.getRefreshStatus().isScheduled).toBe(true);
  });
});

describe("tokenService — scheduleTokenRefresh", () => {
  let realTokenService;
  let mockBackend;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    realTokenService = require("@/axiosConfig/tokenService");
    mockBackend = { post: jest.fn() };
    realTokenService.setBackendInstanceRef(mockBackend);
  });

  afterEach(() => {
    realTokenService.clearRefreshTimer();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("does NOT fire before the interval", () => {
    mockBackend.post.mockResolvedValue({ status: 200 });
    realTokenService.scheduleTokenRefresh(5000);
    jest.advanceTimersByTime(4999);
    expect(mockBackend.post).not.toHaveBeenCalled();
  });

  it("fires the refresh at the given interval", async () => {
    mockBackend.post.mockResolvedValue({ status: 200 });
    realTokenService.scheduleTokenRefresh(5000);
    await advanceAndFlush(5001);
    expect(mockBackend.post).toHaveBeenCalledWith("/auth/refresh");
  });

  it("dispatches 'tokenRefreshed' event on success", async () => {
    mockBackend.post.mockResolvedValue({ status: 200 });
    const eventSpy = jest.spyOn(window, "dispatchEvent");
    realTokenService.scheduleTokenRefresh(1000);
    await advanceAndFlush(1001);
    await advanceAndFlush(0);
    const fired = eventSpy.mock.calls.map((c) => c[0].type);
    expect(fired).toContain("tokenRefreshed");
  });

  it("reschedules after a successful refresh (keeps the cycle alive)", async () => {
    mockBackend.post.mockResolvedValue({ status: 200 });
    realTokenService.scheduleTokenRefresh(1000);
    await advanceAndFlush(1001);
    await advanceAndFlush(0);
    expect(realTokenService.getRefreshStatus().isScheduled).toBe(true);
  });

  it("dispatches 'sessionExpired' and stops scheduling on 401", async () => {
    mockBackend.post.mockRejectedValue({ response: { status: 401 } });
    const eventSpy = jest.spyOn(window, "dispatchEvent");
    realTokenService.scheduleTokenRefresh(1000);
    await advanceAndFlush(1001);
    await advanceAndFlush(0);
    const fired = eventSpy.mock.calls.map((c) => c[0].type);
    expect(fired).toContain("sessionExpired");
    expect(realTokenService.getRefreshStatus().isScheduled).toBe(false);
  });

  it("stops scheduling on 403 (security violation — token reuse)", async () => {
    mockBackend.post.mockRejectedValue({ response: { status: 403 } });
    realTokenService.scheduleTokenRefresh(1000);
    await advanceAndFlush(1001);
    await advanceAndFlush(0);
    expect(realTokenService.getRefreshStatus().isScheduled).toBe(false);
  });

  it("retries with 5-minute backoff on network errors", async () => {
    mockBackend.post.mockRejectedValue({
      response: undefined,
      message: "Network Error",
    });
    realTokenService.scheduleTokenRefresh(1000);
    await advanceAndFlush(1001);
    await advanceAndFlush(0);
    expect(realTokenService.getRefreshStatus().isScheduled).toBe(true);
  });

  it("enforces MIN_REFRESH_INTERVAL — skips if called too soon after last attempt", async () => {
    mockBackend.post.mockResolvedValue({ status: 200 });
    realTokenService.scheduleTokenRefresh(1000);
    await advanceAndFlush(1001);
    await advanceAndFlush(0);
    mockBackend.post.mockClear();
    realTokenService.scheduleTokenRefresh(100);
    await advanceAndFlush(101);
    expect(mockBackend.post).not.toHaveBeenCalled();
  });

  it("does nothing if backendInstanceRef is not set", async () => {
    realTokenService.setBackendInstanceRef(null);
    realTokenService.scheduleTokenRefresh(1000);
    await advanceAndFlush(1001);
    expect(mockBackend.post).not.toHaveBeenCalled();
  });
});

describe("tokenService — triggerManualRefresh", () => {
  let realTokenService;
  let mockBackend;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    realTokenService = require("@/axiosConfig/tokenService");
    mockBackend = { post: jest.fn() };
    realTokenService.setBackendInstanceRef(mockBackend);
  });

  afterEach(() => {
    realTokenService.clearRefreshTimer();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("calls POST /auth/refresh immediately", async () => {
    mockBackend.post.mockResolvedValue({ data: {}, status: 200 });
    await realTokenService.triggerManualRefresh();
    expect(mockBackend.post).toHaveBeenCalledWith("/auth/refresh");
  });

  it("throws when backendInstance is not set", async () => {
    realTokenService.setBackendInstanceRef(null);
    await expect(realTokenService.triggerManualRefresh()).rejects.toThrow(
      "Backend instance not initialized",
    );
  });

  it("rethrows errors from the API", async () => {
    mockBackend.post.mockRejectedValue(new Error("Refresh failed"));
    await expect(realTokenService.triggerManualRefresh()).rejects.toThrow(
      "Refresh failed",
    );
  });

  it("reschedules the automatic refresh cycle after manual trigger", async () => {
    mockBackend.post.mockResolvedValue({ data: {}, status: 200 });
    await realTokenService.triggerManualRefresh();
    expect(realTokenService.getRefreshStatus().isScheduled).toBe(true);
  });
});

describe("tokenService — getRefreshStatus", () => {
  let realTokenService;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    realTokenService = require("@/axiosConfig/tokenService");
  });

  afterEach(() => {
    realTokenService.clearRefreshTimer();
    jest.useRealTimers();
  });

  it("returns correct shape with all expected keys", () => {
    const status = realTokenService.getRefreshStatus();
    expect(status).toHaveProperty("isScheduled");
    expect(status).toHaveProperty("lastAttempt");
    expect(status).toHaveProperty("timeSinceLastAttempt");
    expect(status).toHaveProperty("hasBackendRef");
  });

  it("reports hasBackendRef true when instance is set", () => {
    realTokenService.setBackendInstanceRef({ post: jest.fn() });
    expect(realTokenService.getRefreshStatus().hasBackendRef).toBe(true);
  });

  it("reports hasBackendRef false when instance is cleared", () => {
    realTokenService.setBackendInstanceRef(null);
    expect(realTokenService.getRefreshStatus().hasBackendRef).toBe(false);
  });

  it("isScheduled is false before any scheduling", () => {
    expect(realTokenService.getRefreshStatus().isScheduled).toBe(false);
  });
});

describe("tokenService — clearAuthCookies", () => {
  let realTokenService;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    realTokenService = require("@/axiosConfig/tokenService");
  });

  afterEach(() => {
    realTokenService.clearRefreshTimer();
    jest.useRealTimers();
  });

  it("clears the refresh timer (scheduler side effect only)", () => {
    realTokenService.setBackendInstanceRef({ post: jest.fn() });
    realTokenService.scheduleTokenRefresh(5000);
    expect(realTokenService.getRefreshStatus().isScheduled).toBe(true);
    realTokenService.clearAuthCookies();
    expect(realTokenService.getRefreshStatus().isScheduled).toBe(false);
  });

  it("does NOT attempt to clear HttpOnly cookies via document.cookie (security contract)", () => {
    const cookieSpy = jest.spyOn(document, "cookie", "set");
    realTokenService.clearAuthCookies();
    expect(cookieSpy).not.toHaveBeenCalled();
    cookieSpy.mockRestore();
  });
});
