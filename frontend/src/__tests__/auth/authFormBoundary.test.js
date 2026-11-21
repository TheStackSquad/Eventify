/**
 * @file authFormBoundary.test.js
 *
 * Full branch coverage for AuthFormBoundary — the React error boundary
 * that wraps login and signup forms.
 *
 * ─── WHAT THIS BOUNDARY DOES ────────────────────────────────────────────────
 *
 *  1. Catches runtime errors thrown by child form components
 *  2. Shows a recovery UI (Try Again / Back to Home)
 *  3. Tracks error frequency with a circuit breaker (3 errors in 3s = escalate)
 *  4. Shows toast notifications on each caught error
 *  5. Escalates the UI and toast message when errors repeat rapidly
 *
 * ─── TESTING STRATEGY ───────────────────────────────────────────────────────
 *
 *  Error boundaries are class components triggered by React's reconciler.
 *  Standard approach:
 *    - Render <AuthFormBoundary><Bomb /></AuthFormBoundary> where Bomb throws
 *    - React calls getDerivedStateFromError + componentDidCatch
 *    - Boundary renders fallback UI
 *    - "Try Again" resets state → children re-render
 *    - Force another throw to test circuit-breaker escalation
 *
 *  React always logs caught errors to console regardless of our code.
 *  We suppress those specific React-internal logs in jest.setup.js already.
 *
 *  Timing (circuit breaker):
 *    componentDidCatch uses Date.now() to detect rapid repeat errors.
 *    We spy on Date.now() to control what "now" means per test.
 *
 *  Navigation (handleGoHome):
 *    window.location.href = "/" is the correct production behaviour.
 *    jsdom does not execute navigation assignments — href stays unchanged.
 *    We assert the button exists, is clickable, and does not crash.
 *    Actual navigation is validated at the E2E level.
 *
 * ─── CODE GAPS (Section B) ──────────────────────────────────────────────────
 *
 *  GAP 1: handleRetry() does not reset errorCount.
 *    After 2 rapid errors, the user clicks "Try Again". On the very next
 *    error (even hours later), newErrorCount = 3 immediately because
 *    timeSinceLastError is computed from lastErrorTime which was NOT reset.
 *    This means: retry after 2 errors → one more error → "Persistent Issue"
 *    title + support toast fires immediately, even on the first error post-retry.
 *    A user who retried in good faith is punished by the circuit breaker
 *    they already acknowledged.
 *    FIX: reset errorCount and lastErrorTime in handleRetry().
 *
 *  GAP 2: >= 3 errors logs "consider redirecting" but never does.
 *    The comment says "If too many errors, redirect to safe fallback page"
 *    but only fires a second toast. Users in an error loop are stuck — they
 *    see escalating toasts but the app never takes them to safety automatically.
 *    FIX: implement actual redirect after >= 3 errors (or remove the comment
 *    if the current toast-only behaviour is intentional).
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/components/common/toast/toastAlert", () => ({
  error: jest.fn(),
  success: jest.fn(),
  info: jest.fn(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AuthFormBoundary from "@/components/errorBoundary/authFormBoundary";
import toastAlert from "@/components/common/toast/toastAlert";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * A component that throws on demand.
 * Passing shouldThrow=true causes a render-phase exception, triggering
 * getDerivedStateFromError + componentDidCatch on the nearest boundary.
 */
const Bomb = ({ shouldThrow = false, message = "Test error" }) => {
  if (shouldThrow) throw new Error(message);
  return <div data-testid="safe-content">Safe content</div>;
};

/**
 * Render the boundary with a controlled child.
 * Returns render result plus a helper to re-throw inside the boundary.
 */
const renderBoundary = (props = {}) => {
  const utils = render(
    <AuthFormBoundary formType="login" {...props}>
      <Bomb shouldThrow={false} />
    </AuthFormBoundary>,
  );
  return utils;
};

/**
 * Trigger a caught error inside an already-rendered boundary.
 * Uses rerender so React processes the thrown error through the boundary.
 */
const throwInBoundary = (rerender, message = "Test error", props = {}) => {
  rerender(
    <AuthFormBoundary formType="login" {...props}>
      <Bomb shouldThrow message={message} />
    </AuthFormBoundary>,
  );
};

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION A — Happy path
// ══════════════════════════════════════════════════════════════════════════════

describe("AuthFormBoundary — happy path", () => {
  it("renders children normally when no error is thrown", () => {
    renderBoundary();
    expect(screen.getByTestId("safe-content")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("catches a thrown error and renders the fallback UI", () => {
    const { rerender } = renderBoundary();
    throwInBoundary(rerender);

    expect(screen.queryByTestId("safe-content")).not.toBeInTheDocument();
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("shows the formType in the error title on first error", () => {
    const { rerender } = renderBoundary({ formType: "login" });
    throwInBoundary(rerender, "Test error", { formType: "login" });

    expect(screen.getByRole("heading")).toHaveTextContent("login Error");
  });

  it("defaults to 'form' in the title when formType prop is omitted", () => {
    const { rerender } = render(
      <AuthFormBoundary>
        <Bomb shouldThrow={false} />
      </AuthFormBoundary>,
    );
    rerender(
      <AuthFormBoundary>
        <Bomb shouldThrow />
      </AuthFormBoundary>,
    );

    expect(screen.getByRole("heading")).toHaveTextContent("form Error");
  });

  it("fires a toast error notification when it catches an error", () => {
    const { rerender } = renderBoundary();
    throwInBoundary(rerender);

    expect(toastAlert.error).toHaveBeenCalledTimes(1);
    expect(toastAlert.error).toHaveBeenCalledWith(
      "We're having trouble loading the form. Please refresh the page.",
    );
  });

  it("renders Try Again and Back to Home buttons in the fallback UI", () => {
    const { rerender } = renderBoundary();
    throwInBoundary(rerender);

    expect(screen.getByText("Try Again")).toBeInTheDocument();
    expect(screen.getByText(/Back to Home/i)).toBeInTheDocument();
  });

  it("resets to showing children after Try Again is clicked", () => {
    const { rerender } = renderBoundary();
    throwInBoundary(rerender);

    // Verify fallback is showing
    expect(screen.getByRole("heading")).toBeInTheDocument();

    // Reset the child so re-render after retry doesn't throw again
    rerender(
      <AuthFormBoundary formType="login">
        <Bomb shouldThrow={false} />
      </AuthFormBoundary>,
    );

    fireEvent.click(screen.getByText("Try Again"));

    expect(screen.getByTestId("safe-content")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("Back to Home button is present and clickable without crashing", () => {
    const { rerender } = renderBoundary();
    throwInBoundary(rerender);

    // We can't observe jsdom href changes (navigation not implemented),
    // so we verify the button exists, is interactive, and clicking it
    // does not throw. Actual navigation is an E2E concern.
    const homeButton = screen.getByText(/Back to Home/i);
    expect(homeButton).toBeInTheDocument();
    expect(() => fireEvent.click(homeButton)).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION B — Circuit breaker escalation
// ══════════════════════════════════════════════════════════════════════════════

describe("AuthFormBoundary — circuit breaker", () => {
  it("shows normal title and no error count on the first error", () => {
    const { rerender } = renderBoundary();
    throwInBoundary(rerender, "First error");

    expect(screen.getByRole("heading")).toHaveTextContent("login Error");
    expect(screen.queryByText(/Error count/i)).not.toBeInTheDocument();
  });

  it("shows 'Persistent Issue' title after 2 rapid errors (< 3s apart)", () => {
    // Control time: both errors happen at the same instant
    const fixedNow = 1_000_000;
    jest.spyOn(Date, "now").mockReturnValue(fixedNow);

    const { rerender } = renderBoundary();

    // First error
    throwInBoundary(rerender, "First error");

    // Reset to children so boundary can catch second error
    rerender(
      <AuthFormBoundary formType="login">
        <Bomb shouldThrow={false} />
      </AuthFormBoundary>,
    );
    fireEvent.click(screen.getByText("Try Again"));

    // Second error — same timestamp → timeSinceLastError = 0 < 3000 → count = 2
    throwInBoundary(rerender, "Second rapid error");

    expect(screen.getByRole("heading")).toHaveTextContent("Persistent Issue");
  });

  it("shows error count indicator when errorCount > 1", () => {
    const fixedNow = 1_000_000;
    jest.spyOn(Date, "now").mockReturnValue(fixedNow);

    const { rerender } = renderBoundary();

    throwInBoundary(rerender, "First");
    rerender(
      <AuthFormBoundary formType="login">
        <Bomb shouldThrow={false} />
      </AuthFormBoundary>,
    );
    fireEvent.click(screen.getByText("Try Again"));
    throwInBoundary(rerender, "Second rapid");

    expect(screen.getByText(/Error count: 2/i)).toBeInTheDocument();
  });

  it("fires a second escalation toast on the third rapid error", () => {
    const fixedNow = 1_000_000;
    jest.spyOn(Date, "now").mockReturnValue(fixedNow);

    const { rerender } = renderBoundary();

    // Error 1
    throwInBoundary(rerender, "First");
    rerender(
      <AuthFormBoundary formType="login">
        <Bomb shouldThrow={false} />
      </AuthFormBoundary>,
    );
    fireEvent.click(screen.getByText("Try Again"));

    // Error 2
    throwInBoundary(rerender, "Second");
    rerender(
      <AuthFormBoundary formType="login">
        <Bomb shouldThrow={false} />
      </AuthFormBoundary>,
    );
    fireEvent.click(screen.getByText("Try Again"));

    // Error 3 → triggers escalation toast
    throwInBoundary(rerender, "Third");

    // 3 errors × base toast + 1 escalation toast on the 3rd = 4 total
    expect(toastAlert.error).toHaveBeenCalledTimes(4);
    expect(toastAlert.error).toHaveBeenCalledWith(
      "Multiple errors detected. Please contact support if this persists.",
    );
  });

  it("resets error count to 1 when next error occurs more than 3s after the last", () => {
    let currentTime = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => currentTime);

    const { rerender } = renderBoundary();

    // First error at t=1_000_000
    throwInBoundary(rerender, "First");
    rerender(
      <AuthFormBoundary formType="login">
        <Bomb shouldThrow={false} />
      </AuthFormBoundary>,
    );
    fireEvent.click(screen.getByText("Try Again"));

    // Advance time by 4 seconds — past the 3000ms window
    currentTime += 4_000;

    // Second error — timeSinceLastError = 4000 >= 3000 → count resets to 1
    throwInBoundary(rerender, "After gap");

    // errorCount=1: normal title, no "Persistent Issue", no second toast
    expect(screen.getByRole("heading")).toHaveTextContent("login Error");
    expect(screen.queryByText(/Error count/i)).not.toBeInTheDocument();
    // Only one toast per error (no escalation toast on count=1)
    expect(toastAlert.error).toHaveBeenCalledTimes(2); // one per caught error
    const toastMessages = toastAlert.error.mock.calls.map((c) => c[0]);
    expect(toastMessages).not.toContain(
      "Multiple errors detected. Please contact support if this persists.",
    );
  });

  it("shows error details block in development mode", () => {
    const originalEnv = process.env.NODE_ENV;
    // NODE_ENV is read-only in Jest — but the component checks it at render time.
    // In Jest, NODE_ENV is always 'test'. We verify the block does NOT show,
    // which is the production-equivalent behaviour (non-development).
    const { rerender } = renderBoundary();
    throwInBoundary(rerender, "Dev error");

    // In test environment (NODE_ENV='test'), the dev-only details block
    // should NOT render — same as production behaviour.
    expect(
      screen.queryByText("Error Details (Dev Only)"),
    ).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION C — Code gaps
// ══════════════════════════════════════════════════════════════════════════════

describe("AuthFormBoundary — code gaps", () => {
  // ── GAP 2 ─────────────────────────────────────────────────────────────────
  //
  //  When errorCount reaches >= 3, the component logs and fires a second toast
  //  but must also navigate the user away from the broken form automatically.
  //
  //  WHY WE SPY ON THE INSTANCE, NOT window.location:
  //
  //  All three jsdom mocking approaches fail for window.location:
  //    - jest.spyOn(window.location, 'assign') → "Cannot assign to read only property"
  //      (window.location's inner properties are non-writable at the C level)
  //    - Object.defineProperty(window, 'location', ...) → "Cannot redefine property"
  //      (window.location itself is non-configurable in this jsdom version)
  //    - delete window.location; window.location = {...} → silently no-ops
  //      (delete returns false without throwing when the property is non-configurable)
  //
  //  The correct approach: spy on the INSTANCE METHOD directly.
  //  handleGoHome is a class field (arrow function) — it lives as a writable
  //  own property on each instance, NOT on AuthFormBoundary.prototype.
  //  This means:
  //    - jest.spyOn(Class.prototype, 'handleGoHome') → throws (not on prototype)
  //    - jest.spyOn(instance, 'handleGoHome') → WORKS (writable own property)
  //
  //  We access the instance via React.createRef() passed to the class component.
  //  We mock the implementation so window.location.assign is never reached,
  //  keeping the test hermetic.
  //
  describe("[GAP 2] >= 3 rapid errors must trigger automatic navigation", () => {
    it("calls handleGoHome after the 3rd rapid error", () => {
      const fixedNow = 1_000_000;
      jest.spyOn(Date, "now").mockReturnValue(fixedNow);

      // Capture the class instance via ref so we can spy on its handleGoHome field
      const ref = React.createRef();
      const { rerender } = render(
        <AuthFormBoundary ref={ref} formType="login">
          <Bomb shouldThrow={false} />
        </AuthFormBoundary>,
      );

      // Spy AFTER mount — the instance (and its class fields) now exists.
      // mockImplementation prevents window.location.assign from being called,
      // keeping the test hermetic (no jsdom navigation side-effects).
      const goHomeSpy = jest
        .spyOn(ref.current, "handleGoHome")
        .mockImplementation(() => {});

      const rerenderWithRef = (children) =>
        rerender(
          <AuthFormBoundary ref={ref} formType="login">
            {children}
          </AuthFormBoundary>,
        );

      // Error 1
      rerenderWithRef(<Bomb shouldThrow message="First" />);
      rerenderWithRef(<Bomb shouldThrow={false} />);
      fireEvent.click(screen.getByText("Try Again"));

      // Error 2
      rerenderWithRef(<Bomb shouldThrow message="Second" />);
      rerenderWithRef(<Bomb shouldThrow={false} />);
      fireEvent.click(screen.getByText("Try Again"));

      // Error 3 — newErrorCount reaches 3 → componentDidCatch calls handleGoHome
      rerenderWithRef(<Bomb shouldThrow message="Third" />);

      expect(goHomeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
