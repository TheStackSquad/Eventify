/**
 * @file sessionProvider.test.js
 *
 * ─── WHAT THIS FILE TESTS ───────────────────────────────────────────────────
 *
 *  SessionProvider is the bridge between the token layer (already tested in
 *  interceptorService + tokenService) and the React UI. It owns:
 *    1. Session verification on mount with automatic refresh retry
 *    2. Syncing TanStack Query server-state to local React auth state
 *    3. Responding to "tokenRefreshed" DOM events from the interceptor
 *    4. Exposing setUser() and clearAuth() for login/logout flows
 *
 * ─── THREE SECTIONS ─────────────────────────────────────────────────────────
 *
 *  A — Happy path            confirmed working behaviour (11 tests)
 *  B — Gap regressions       fixed bugs, tested as regressions (4 tests)
 *  C — New code gaps         bugs introduced in the refactor (2 tests)
 *
 * ─── WRAPPER DESIGN — WHY TWO MODES ────────────────────────────────────────
 *
 *  makeWrapper() takes options to control two TanStack defaults that, if set
 *  incorrectly, MASK real bugs rather than expose them:
 *
 *  retry:
 *    Most tests set retry:false to prevent accidental retry noise.
 *    GAP 2 must NOT override retry — the component's retry config must run
 *    so we can prove the operator-precedence fix actually works.
 *    makeWrapper({ allowRetry: true }) skips the override.
 *
 *  staleTime:
 *    Most tests set staleTime:0 so refetches always run (predictable).
 *    GAP 4 and New Gap A must use the component's staleTime (5 min) so
 *    we test whether setUser()/clearAuth() correctly invalidate the cache.
 *    With staleTime:0 the cache is always stale, masking the missing
 *    invalidateQueries() call.
 *    makeWrapper({ productionStale: true }) skips the override.
 */

// ─── Mocks (hoisted by babel-jest) ───────────────────────────────────────────

jest.mock("@/services/authAPI", () => ({
  verifySessionApi: jest.fn(),
  refreshTokenApi: jest.fn(),
}));

jest.mock("@/axiosConfig/tokenService", () => ({
  initializeTokenRefresh: jest.fn(),
  clearRefreshTimer: jest.fn(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import React, { useContext } from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SessionProvider, { AuthContext } from "@/provider/sessionProvider";
import { verifySessionApi, refreshTokenApi } from "@/services/authAPI";
import {
  initializeTokenRefresh,
  clearRefreshTimer,
} from "@/axiosConfig/tokenService";

// ─── Consumer component ───────────────────────────────────────────────────────

/**
 * Renders every context value we need to assert on.
 * Buttons expose the two mutating actions (setUser, clearAuth).
 */
const SessionConsumer = () => {
  const ctx = useContext(AuthContext);
  return (
    <div>
      <span data-testid="authenticated">{String(ctx.isAuthenticated)}</span>
      <span data-testid="initialized">{String(ctx.isInitialized)}</span>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="user-email">{ctx.user?.email ?? "null"}</span>
      <button
        data-testid="btn-set-user"
        onClick={() => ctx.setUser({ email: "manual@test.com" })}
      >
        Set User
      </button>
      <button data-testid="btn-clear-auth" onClick={() => ctx.clearAuth()}>
        Clear Auth
      </button>
    </div>
  );
};

// ─── Wrapper factory ──────────────────────────────────────────────────────────

/**
 * @param {object}  [opts]
 * @param {boolean} [opts.allowRetry=false]      Don't override retry — lets component config run
 * @param {boolean} [opts.productionStale=false]  Don't override staleTime — uses component's 5 min
 */
const makeWrapper = ({ allowRetry = false, productionStale = false } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        ...(allowRetry ? {} : { retry: false }),
        ...(productionStale ? {} : { staleTime: 0 }),
      },
    },
  });
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
  Wrapper.queryClient = queryClient;
  return Wrapper;
};

const fakeUser = { email: "user@test.com", isVendor: false, hasEvents: false };

// ─── Global setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION A — Happy path
// Asserts confirmed working behaviour. All 11 should pass.
// ══════════════════════════════════════════════════════════════════════════════

describe("SessionProvider — happy path", () => {
  it("renders with loading=true, authenticated=false before the query resolves", () => {
    verifySessionApi.mockReturnValue(new Promise(() => {})); // never resolves

    render(<SessionConsumer />, { wrapper: makeWrapper() });

    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("initialized")).toHaveTextContent("false");
  });

  it("becomes authenticated and exposes user after a valid session", async () => {
    verifySessionApi.mockResolvedValue(fakeUser);

    render(<SessionConsumer />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
    );

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("user-email")).toHaveTextContent(fakeUser.email);
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("calls initializeTokenRefresh (and not clearRefreshTimer) after valid session", async () => {
    verifySessionApi.mockResolvedValue(fakeUser);

    render(<SessionConsumer />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
    );

    expect(initializeTokenRefresh).toHaveBeenCalledTimes(1);
    expect(clearRefreshTimer).not.toHaveBeenCalled();
  });

  it("stays unauthenticated and calls clearRefreshTimer when verifySessionApi returns null", async () => {
    verifySessionApi.mockResolvedValue(null);

    render(<SessionConsumer />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
    );

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("user-email")).toHaveTextContent("null");
    expect(clearRefreshTimer).toHaveBeenCalledTimes(1);
    expect(initializeTokenRefresh).not.toHaveBeenCalled();
  });

  it("recovers the session: verify→401, refresh→ok, re-verify→user", async () => {
    const recoveredUser = { email: "recovered@test.com" };
    verifySessionApi
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce(recoveredUser);
    refreshTokenApi.mockResolvedValue({});

    render(<SessionConsumer />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
    );

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("user-email")).toHaveTextContent(
      recoveredUser.email,
    );
    expect(initializeTokenRefresh).toHaveBeenCalledTimes(1);
  });

  it("stays unauthenticated when both verify and refresh fail with 401", async () => {
    verifySessionApi.mockRejectedValue({ response: { status: 401 } });
    refreshTokenApi.mockRejectedValue({ response: { status: 401 } });

    render(<SessionConsumer />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
    );

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(clearRefreshTimer).toHaveBeenCalled();
  });

  it("stays unauthenticated when verifySessionApi returns 403", async () => {
    verifySessionApi.mockRejectedValue({ response: { status: 403 } });

    render(<SessionConsumer />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
    );

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(clearRefreshTimer).toHaveBeenCalled();
  });

  it("setUser() immediately sets authenticated+user without a network call", async () => {
    verifySessionApi.mockResolvedValue(null);

    render(<SessionConsumer />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
    );

    act(() => screen.getByTestId("btn-set-user").click());

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("user-email")).toHaveTextContent(
      "manual@test.com",
    );
    expect(initializeTokenRefresh).toHaveBeenCalled();
  });

  it("clearAuth() immediately resets to unauthenticated and cancels refresh timer", async () => {
    verifySessionApi.mockResolvedValue(fakeUser);

    render(<SessionConsumer />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true"),
    );

    act(() => screen.getByTestId("btn-clear-auth").click());

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("user-email")).toHaveTextContent("null");
    expect(clearRefreshTimer).toHaveBeenCalled();
  });

  it("tokenRefreshed event invalidates query and triggers a re-verify call", async () => {
    const rotatedUser = { email: "rotated@test.com" };
    verifySessionApi
      .mockResolvedValueOnce(fakeUser)
      .mockResolvedValueOnce(rotatedUser);

    render(<SessionConsumer />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByTestId("user-email")).toHaveTextContent(
        fakeUser.email,
      ),
    );

    act(() => window.dispatchEvent(new CustomEvent("tokenRefreshed")));

    await waitFor(() =>
      expect(screen.getByTestId("user-email")).toHaveTextContent(
        rotatedUser.email,
      ),
    );

    expect(verifySessionApi).toHaveBeenCalledTimes(2);
  });

  it("cleans up the tokenRefreshed listener and calls clearRefreshTimer on unmount", async () => {
    verifySessionApi.mockResolvedValue(fakeUser);

    const { unmount } = render(<SessionConsumer />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
    );

    const removeSpy = jest.spyOn(window, "removeEventListener");
    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      "tokenRefreshed",
      expect.any(Function),
    );
    expect(clearRefreshTimer).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION B — Gap regressions
//
// These are the 4 bugs confirmed in the original code, now fixed.
// Each test asserts the CORRECT behaviour and should PASS against the new code.
// If any regression is introduced, one of these will fail — that is the point.
// ══════════════════════════════════════════════════════════════════════════════

describe("SessionProvider — gap regressions", () => {
  // ── GAP 1 REGRESSION ──────────────────────────────────────────────────────
  //
  //  ORIGINAL BUG: inner try/catch was too broad. It caught both refreshTokenApi()
  //  AND the second verifySessionApi() call. A transient 500 on re-verify was
  //  treated identically to a failed refresh — returned null — so clearRefreshTimer()
  //  was called and the user was silently logged out by a server blip.
  //
  //  FIX IN NEW CODE: inner catch now only covers refreshTokenApi(). The second
  //  verifySessionApi() call is outside the try, so a 500 throws up to TanStack.
  //  sessionData stays undefined → session sync effect doesn't fire →
  //  clearRefreshTimer() is NOT called → session state is preserved as uncertain
  //  rather than incorrectly destroyed.
  //
  //  KEY ASSERTION: clearRefreshTimer() not called.
  //  (authenticated=true is impossible here — we couldn't confirm the session.
  //   The improvement is that we also don't actively destroy it.)
  //
  describe("[GAP 1] transient 5xx on re-verify after refresh should not clear auth", () => {
    it("does NOT call clearRefreshTimer when 5xx hits the second verifySessionApi call", async () => {
      // Sequence:
      //   queryFn attempt 1: verifySessionApi() → 401
      //                      refreshTokenApi()  → ok
      //                      verifySessionApi() → 500  ← throws to TanStack (new code)
      //   TanStack retry 1:  verifySessionApi() → fakeUser  ← succeeds
      //
      // The component's retry() config overrides the wrapper's retry:false for 5xx,
      // so we must mock a third response so the query settles.
      verifySessionApi
        .mockRejectedValueOnce({ response: { status: 401 } }) // attempt 1: first verify
        .mockRejectedValueOnce({ response: { status: 500 } }) // attempt 1: re-verify → throws
        .mockResolvedValueOnce(fakeUser); // attempt 2 (TanStack retry): succeeds
      refreshTokenApi.mockResolvedValue({});

      render(<SessionConsumer />, { wrapper: makeWrapper() });

      // timeout:5000 — TanStack's retry fires after ~1000ms backoff, which races
      // with waitFor's default 1000ms timeout. Give the retry room to complete.
      await waitFor(
        () =>
          expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
        { timeout: 5000 },
      );

      // KEY PROOF: clearRefreshTimer was NEVER called.
      // Old code: inner catch caught the 500 → returned null → effect called clearRefreshTimer.
      // New code: 500 throws → sessionData stays undefined → sync effect never fires.
      expect(clearRefreshTimer).not.toHaveBeenCalled();

      // The retry succeeded → user is authenticated. Session was preserved, not destroyed.
      expect(initializeTokenRefresh).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    });
  });

  // ── GAP 2 REGRESSION ──────────────────────────────────────────────────────
  //
  //  ORIGINAL BUG: operator precedence error in retry():
  //    if (error?.response?.status === 401 || 403) return false;
  //  This evaluates as: (status === 401) || 403
  //  Since 403 is truthy, the expression is ALWAYS truthy → always returns false
  //  → zero retries for ALL errors, including genuine network failures.
  //
  //  FIX IN NEW CODE:
  //    const status = error?.response?.status;
  //    if (status === 401 || status === 403) return false;
  //    return failureCount < 2;
  //
  //  KEY ASSERTION: network errors retry up to 2 times (3 total calls).
  //
  //  WRAPPER NOTE: allowRetry:true is REQUIRED here. The test wrapper's
  //  retry:false would override the component's retry config, masking the bug
  //  and making this test vacuously pass on broken code too. We must let the
  //  component's retry logic run.
  //
  describe("[GAP 2] retry() operator precedence — network errors must retry", () => {
    it("retries network errors up to 2 times and resolves on the third attempt", async () => {
      const networkError = new Error("Network Error"); // no .response — genuine network failure
      verifySessionApi
        .mockRejectedValueOnce(networkError) // attempt 1 — fail
        .mockRejectedValueOnce(networkError) // attempt 2 (retry 1) — fail
        .mockResolvedValueOnce(fakeUser); // attempt 3 (retry 2) — succeed

      render(<SessionConsumer />, {
        wrapper: makeWrapper({ allowRetry: true }),
      });

      await waitFor(
        () =>
          expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
        { timeout: 8000 }, // retries have internal backoff delays
      );

      // All 3 calls were made — retry config is working correctly
      expect(verifySessionApi).toHaveBeenCalledTimes(3);
      // The eventual success was reflected in auth state
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    });

    it("does NOT retry 401 errors — they are definitive auth failures", async () => {
      verifySessionApi.mockRejectedValue({ response: { status: 401 } });
      refreshTokenApi.mockRejectedValue({ response: { status: 401 } });

      render(<SessionConsumer />, {
        wrapper: makeWrapper({ allowRetry: true }),
      });

      await waitFor(() =>
        expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
      );

      // 401 is caught inside queryFn: verifySessionApi() → 401 → refreshTokenApi() → 401
      // → inner catch returns null. The second verifySessionApi() is never reached.
      // retry() never sees a 401 because queryFn returned null (didn't throw).
      expect(verifySessionApi).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    });
  });

  // ── GAP 3 REGRESSION ──────────────────────────────────────────────────────
  //
  //  ORIGINAL BUG: loading = !isInitialized.
  //  isInitialized is set true once and never reset. Background refetches
  //  triggered by "tokenRefreshed" events showed loading=false throughout —
  //  spinners didn't spin, stale UI appeared current.
  //
  //  FIX IN NEW CODE: loading = !isInitialized || isFetching
  //
  //  KEY ASSERTION: loading=true while a background refetch is in flight.
  //
  describe("[GAP 3] loading must be true during background refetch after token rotation", () => {
    it("exposes loading=true while re-verifying after a tokenRefreshed event", async () => {
      let resolveRefetch;
      verifySessionApi
        .mockResolvedValueOnce(fakeUser) // initial load — fast
        .mockReturnValueOnce(
          // refetch — held open
          new Promise((res) => {
            resolveRefetch = res;
          }),
        );

      render(<SessionConsumer />, { wrapper: makeWrapper() });

      await waitFor(() =>
        expect(screen.getByTestId("authenticated")).toHaveTextContent("true"),
      );

      // Fire token rotation event — this invalidates cache and starts a refetch
      act(() => window.dispatchEvent(new CustomEvent("tokenRefreshed")));

      // While the refetch is in flight, loading must be true so consumers
      // (spinners, disabled buttons) can respond correctly
      await waitFor(() =>
        expect(screen.getByTestId("loading")).toHaveTextContent("true"),
      );

      // Resolve to clean up
      act(() => resolveRefetch(fakeUser));

      await waitFor(() =>
        expect(screen.getByTestId("loading")).toHaveTextContent("false"),
      );
    });
  });

  // ── GAP 4 REGRESSION ──────────────────────────────────────────────────────
  //
  //  ORIGINAL BUG: setUser() called setQueryData() but NOT invalidateQueries().
  //  The query was left in "fresh" state with optimistic data. On the next
  //  window-focus refetch, TanStack would skip re-verification (data was fresh)
  //  — creating "ghost sessions" where local state said logged-in but the server
  //  might disagree.
  //
  //  FIX IN NEW CODE: invalidateQueries({ queryKey: ["session"] }) added to setUser()
  //
  //  KEY ASSERTION: queryState.isInvalidated === true after setUser().
  //
  //  WRAPPER NOTE: productionStale:true is REQUIRED. With staleTime:0 (test default)
  //  ALL data is immediately stale after setQueryData, so isInvalidated appears true
  //  even without calling invalidateQueries — the bug is invisible. We must use
  //  the component's real staleTime (5 min) to expose this correctly.
  //
  describe("[GAP 4] setUser() must invalidate query cache to prevent ghost sessions", () => {
    it("marks the session query as invalidated after setUser so the next refetch re-verifies", async () => {
      verifySessionApi.mockResolvedValue(null);

      const Wrapper = makeWrapper({ productionStale: true });
      render(<SessionConsumer />, { wrapper: Wrapper });

      await waitFor(() =>
        expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
      );

      act(() => screen.getByTestId("btn-set-user").click());

      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");

      // With 5 min staleTime, setQueryData alone would leave the query "fresh"
      // (isInvalidated=false). The fix calls invalidateQueries() which marks it
      // as stale, guaranteeing the next window focus re-verifies with the server.
      const queryState = Wrapper.queryClient.getQueryState(["session"]);
      expect(queryState.isInvalidated).toBe(true);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION C — New code gaps
//
// Bugs introduced or exposed by the refactor. These assert CORRECT behaviour
// and currently FAIL against the new code.
// ══════════════════════════════════════════════════════════════════════════════

describe("SessionProvider — new code gaps", () => {
  // ── NEW GAP A ─────────────────────────────────────────────────────────────
  //
  //  clearAuth() calls setQueryData(null) but does NOT call invalidateQueries().
  //
  //  This creates an asymmetry with setUser() (which was fixed in GAP 4).
  //  After logout, the query cache holds fresh null data. On the next window-
  //  focus, TanStack considers the data fresh and skips re-verification.
  //
  //  Production impact: if a logout call fails silently (network error),
  //  the server session may still be alive. The next window focus should
  //  re-verify and discover the session is still valid — but it won't,
  //  because the cache is fresh with null. The user remains incorrectly
  //  logged-out in the UI even though their server session survived.
  //
  //  FIX: add to clearAuth():
  //    queryClient.invalidateQueries({ queryKey: ["session"] });
  //
  describe("[NEW GAP A] clearAuth() must invalidate the query cache on logout", () => {
    it("marks session query as invalidated after clearAuth so next focus re-verifies", async () => {
      verifySessionApi.mockResolvedValue(fakeUser);

      const Wrapper = makeWrapper({ productionStale: true });
      render(<SessionConsumer />, { wrapper: Wrapper });

      await waitFor(() =>
        expect(screen.getByTestId("authenticated")).toHaveTextContent("true"),
      );

      act(() => screen.getByTestId("btn-clear-auth").click());

      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");

      // After logout, the query must be invalidated so that on next window focus
      // TanStack re-runs verifySessionApi() to confirm the session is truly gone.
      // Without this, a failed logout leaves the cache fresh with null — the user
      // appears logged out locally even if the server session survived.
      const queryState = Wrapper.queryClient.getQueryState(["session"]);
      expect(queryState.isInvalidated).toBe(true);
    });
  });

  // ── NEW GAP B ─────────────────────────────────────────────────────────────
  //
  //  After ALL retries are exhausted with network errors, the component must
  //  initialise as "not authenticated" WITHOUT calling clearRefreshTimer.
  //
  //  This is the "uncertain session" scenario: the server was unreachable
  //  (not a definitive 401/403), so we have no proof the session is invalid.
  //  The correct behaviour is:
  //    - isInitialized = true  (component has settled — stop showing spinner)
  //    - isAuthenticated = false (we can't confirm the user)
  //    - clearRefreshTimer NOT called (session not confirmed dead — don't cancel
  //      the refresh scheduler if it was previously running)
  //
  //  This distinguishes "network failure" from "auth failure" at init time.
  //
  describe("[NEW GAP B] exhausted network retries must not actively destroy session state", () => {
    it("sets initialized=true and unauthenticated WITHOUT calling clearRefreshTimer after all retries fail", async () => {
      // All 3 attempts (original + 2 retries) fail with network errors.
      const networkError = new Error("Network Error"); // no .response
      verifySessionApi
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError);

      render(<SessionConsumer />, {
        wrapper: makeWrapper({ allowRetry: true }),
      });

      await waitFor(
        () =>
          expect(screen.getByTestId("initialized")).toHaveTextContent("true"),
        { timeout: 8000 },
      );

      // Component has settled — all retries exhausted
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
      expect(screen.getByTestId("loading")).toHaveTextContent("false");

      // CRITICAL: clearRefreshTimer must NOT be called.
      // We have no server confirmation the session is dead — it was a network failure.
      // Calling clearRefreshTimer here would cancel the background scheduler on a
      // potentially still-valid session, causing the user to be kicked out by a
      // temporary network blip rather than a real auth failure.
      expect(clearRefreshTimer).not.toHaveBeenCalled();
    });
  });
});
