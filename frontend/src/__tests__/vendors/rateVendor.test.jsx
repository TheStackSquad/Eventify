/**
 * @file rateVendor.test.jsx
 *
 * ─── WHAT THIS FILE TESTS ───────────────────────────────────────────────────
 *
 *  RateVendor is a review submission form that owns:
 *    1. Field rendering (name/email for unauthenticated users, stars, textarea)
 *    2. Star rating interaction (click to set, hover to preview)
 *    3. Form validation via validateReview + toastAlert.error on failure
 *    4. Submission via useReview.postReview with success/error callbacks
 *    5. Form reset and modal close after successful submission
 *
 * ─── GAPS EXPOSED ────────────────────────────────────────────────────────────
 *
 *  GAP 1: validateForm() is a dead function — handleSubmit never calls it.
 *         toastAlert.error() is therefore never called on submit validation
 *         failure. Tests assert toast is NOT called (current behaviour) and
 *         document that it SHOULD be called (desired behaviour).
 *
 *  GAP 2: handleSubmit calls validateReview(reviewData) without the
 *         { requireUserInfo: !user } option. When user auth is wired,
 *         logged-in users will hit name/email validation errors on submit.
 *
 *  GAP 3: postReview onError only calls console.error — no user-facing
 *         toast. Submission failures are silent.
 *
 *  GAP 4: resetForm does not reset hoverRating — after a successful submit
 *         the hover highlight can persist if the mouse was over a star.
 *
 *  GAP 5: onClose is called inside setTimeout with no cleanup — fires on
 *         unmounted component if the modal is closed before 2 seconds.
 *
 * ─── MOCKS ──────────────────────────────────────────────────────────────────
 *
 *  - useReview     → controlled postReview jest.fn() + isPosting flag
 *  - validateReview → jest.fn() so we control pass/fail per test
 *  - toastAlert    → jest.fn() stubs for .error() and .success()
 *  - @tanstack/react-query → real QueryClient via wrapper (useReview is mocked
 *    so no network calls are made)
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/utils/hooks/useReview", () => ({
  useReview: jest.fn(),
}));

jest.mock("@/utils/validate/contactValidate", () => ({
  __esModule: true,
  default: jest.fn(),
  validateReview: jest.fn(),
}));

jest.mock("@/components/common/toast/toastAlert", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RateVendor from "@/components/common/rateVendor";
import { useReview } from "@/utils/hooks/useReview";
import validateReview from "@/utils/validate/contactValidate";
import toastAlert from "@/components/common/toast/toastAlert";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const defaultProps = {
  vendorId: "vendor-123",
  vendorName: "Lagos Caterers",
  onClose: jest.fn(),
};

/** Renders RateVendor with default props and optional overrides. */
const renderComponent = (props = {}) =>
  render(<RateVendor {...defaultProps} {...props} />, {
    wrapper: makeWrapper(),
  });

/** Returns a valid review payload that passes validateReview. */
const validReviewPass = () => ({
  isValid: true,
  errors: {},
});

/** Returns a failing validation result with all fields errored. */
const validationFail = (overrides = {}) => ({
  isValid: false,
  errors: {
    user_name: "Name is required",
    email: "Email is required",
    rating: "Please select a star rating",
    comment: "Please share your experience",
    ...overrides,
  },
});

// ─── Global setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default: idle hook state
  useReview.mockReturnValue({
    postReview: jest.fn(),
    isPosting: false,
  });

  // Default: validation passes
  validateReview.mockReturnValue(validReviewPass());
});

// ══════════════════════════════════════════════════════════════════════════════
// Rendering
// ══════════════════════════════════════════════════════════════════════════════

describe("RateVendor — rendering", () => {
  it("renders the vendor name in the heading", () => {
    renderComponent();
    expect(screen.getByText(/Rate Lagos Caterers/i)).toBeInTheDocument();
  });

  it("renders name and email fields when user is not authenticated", () => {
    renderComponent();
    // user is hardcoded null — these fields always render currently
    expect(screen.getByPlaceholderText(/Ade Santana/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/santana@gmail\.com/i),
    ).toBeInTheDocument();
  });

  it("renders 5 star rating buttons", () => {
    renderComponent();
    const stars = screen.getAllByRole("button", { name: /rate \d star/i });
    expect(stars).toHaveLength(5);
  });

  it("renders the review textarea", () => {
    renderComponent();
    expect(
      screen.getByPlaceholderText(/What made it great/i),
    ).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    renderComponent();
    expect(
      screen.getByRole("button", { name: /submit review/i }),
    ).toBeInTheDocument();
  });

  it("shows 'Processing...' and disables submit when isPosting is true", () => {
    useReview.mockReturnValue({ postReview: jest.fn(), isPosting: true });
    renderComponent();
    const btn = screen.getByRole("button", { name: /processing/i });
    expect(btn).toBeDisabled();
  });

  it("renders the character counter at 0/500 initially", () => {
    renderComponent();
    expect(screen.getByText("0/500")).toBeInTheDocument();
  });

  it("updates character counter as user types", () => {
    renderComponent();
    fireEvent.change(screen.getByPlaceholderText(/What made it great/i), {
      target: { value: "Great service!" },
    });
    expect(screen.getByText("14/500")).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Star rating interaction
// ══════════════════════════════════════════════════════════════════════════════

describe("RateVendor — star rating interaction", () => {
  it("shows 'Tap to rate' text initially", () => {
    renderComponent();
    expect(screen.getByText(/Tap to rate/i)).toBeInTheDocument();
  });

  it("updates rating label when a star is clicked", () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /rate 4 stars/i }));
    expect(screen.getByText(/Very Good/i)).toBeInTheDocument();
  });

  it("shows hover preview when mouse enters a star", () => {
    renderComponent();
    fireEvent.mouseEnter(screen.getByRole("button", { name: /rate 5 stars/i }));
    expect(screen.getByText(/Excellent/i)).toBeInTheDocument();
  });

  it("restores clicked rating when mouse leaves stars", () => {
    renderComponent();
    // Click 3 stars
    fireEvent.click(screen.getByRole("button", { name: /rate 3 stars/i }));
    // Hover 5
    fireEvent.mouseEnter(screen.getByRole("button", { name: /rate 5 stars/i }));
    expect(screen.getByText(/Excellent/i)).toBeInTheDocument();
    // Leave
    fireEvent.mouseLeave(screen.getByRole("button", { name: /rate 5 stars/i }));
    expect(screen.getByText(/Good/i)).toBeInTheDocument();
  });

  it("shows 'Poor' for 1 star click", () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /rate 1 star/i }));
    expect(screen.getByText(/Poor/i)).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Form field state
// ══════════════════════════════════════════════════════════════════════════════

describe("RateVendor — form field state", () => {
  it("updates name field value as user types", () => {
    renderComponent();
    const input = screen.getByPlaceholderText(/Ade Santana/i);
    fireEvent.change(input, { target: { value: "Tunde Bello" } });
    expect(input.value).toBe("Tunde Bello");
  });

  it("updates email field value as user types", () => {
    renderComponent();
    const input = screen.getByPlaceholderText(/santana@gmail\.com/i);
    fireEvent.change(input, { target: { value: "tunde@email.com" } });
    expect(input.value).toBe("tunde@email.com");
  });

  it("updates textarea value as user types", () => {
    renderComponent();
    const textarea = screen.getByPlaceholderText(/What made it great/i);
    fireEvent.change(textarea, { target: { value: "Amazing experience!" } });
    expect(textarea.value).toBe("Amazing experience!");
  });

  it("applies red border to name field when errors.user_name is set", () => {
    validateReview.mockReturnValue(validationFail());
    renderComponent();
    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );
    const input = screen.getByPlaceholderText(/Ade Santana/i);
    expect(input.className).toContain("border-red-500");
  });

  it("applies red border to email field when errors.email is set", () => {
    validateReview.mockReturnValue(validationFail());
    renderComponent();
    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );
    const input = screen.getByPlaceholderText(/santana@gmail\.com/i);
    expect(input.className).toContain("border-red-500");
  });

  it("applies red border to textarea when errors.comment is set", () => {
    validateReview.mockReturnValue(validationFail());
    renderComponent();
    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );
    const textarea = screen.getByPlaceholderText(/What made it great/i);
    expect(textarea.className).toContain("border-red-500");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Form submission — happy path
// ══════════════════════════════════════════════════════════════════════════════

describe("RateVendor — successful submission", () => {
  it("calls postReview with the correct payload on valid submit", () => {
    const postReview = jest.fn();
    useReview.mockReturnValue({ postReview, isPosting: false });
    validateReview.mockReturnValue(validReviewPass());

    renderComponent();

    fireEvent.change(screen.getByPlaceholderText(/Ade Santana/i), {
      target: { value: "Tunde Bello" },
    });
    fireEvent.change(screen.getByPlaceholderText(/santana@gmail\.com/i), {
      target: { value: "tunde@email.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /rate 4 stars/i }));
    fireEvent.change(screen.getByPlaceholderText(/What made it great/i), {
      target: { value: "Great service overall!" },
    });

    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );

    expect(postReview).toHaveBeenCalledWith(
      expect.objectContaining({
        rating: 4,
        comment: "Great service overall!",
        vendor_id: "vendor-123",
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("resets form fields after onSuccess callback fires", () => {
    jest.useFakeTimers();
    let capturedCallbacks;
    const postReview = jest.fn((_data, callbacks) => {
      capturedCallbacks = callbacks;
    });
    useReview.mockReturnValue({ postReview, isPosting: false });
    validateReview.mockReturnValue(validReviewPass());

    renderComponent();

    fireEvent.change(screen.getByPlaceholderText(/Ade Santana/i), {
      target: { value: "Tunde Bello" },
    });
    fireEvent.change(screen.getByPlaceholderText(/What made it great/i), {
      target: { value: "Loved it!" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );

    act(() => capturedCallbacks.onSuccess());

    expect(screen.getByPlaceholderText(/Ade Santana/i).value).toBe("");
    expect(screen.getByPlaceholderText(/What made it great/i).value).toBe("");

    jest.useRealTimers();
  });

  it("calls onClose after 2 seconds following successful submission", () => {
    jest.useFakeTimers();
    let capturedCallbacks;
    const postReview = jest.fn((_data, callbacks) => {
      capturedCallbacks = callbacks;
    });
    useReview.mockReturnValue({ postReview, isPosting: false });
    validateReview.mockReturnValue(validReviewPass());

    const onClose = jest.fn();
    renderComponent({ onClose });

    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );

    act(() => capturedCallbacks.onSuccess());
    expect(onClose).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(2000));
    expect(onClose).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it("does not throw when onClose is undefined", () => {
    jest.useFakeTimers();
    let capturedCallbacks;
    const postReview = jest.fn((_data, callbacks) => {
      capturedCallbacks = callbacks;
    });
    useReview.mockReturnValue({ postReview, isPosting: false });
    validateReview.mockReturnValue(validReviewPass());

    renderComponent({ onClose: undefined });

    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );

    expect(() => {
      act(() => {
        capturedCallbacks.onSuccess();
        jest.advanceTimersByTime(2000);
      });
    }).not.toThrow();

    jest.useRealTimers();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Form submission — validation failure
// ══════════════════════════════════════════════════════════════════════════════

describe("RateVendor — validation failure", () => {
  it("does NOT call postReview when validation fails", () => {
    const postReview = jest.fn();
    useReview.mockReturnValue({ postReview, isPosting: false });
    validateReview.mockReturnValue(validationFail());

    renderComponent();
    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );

    expect(postReview).not.toHaveBeenCalled();
  });

  it("sets field errors in state when validation fails", () => {
    validateReview.mockReturnValue(validationFail());
    renderComponent();
    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );

    // Red borders are the visual proof errors were set
    expect(screen.getByPlaceholderText(/Ade Santana/i).className).toContain(
      "border-red-500",
    );
  });

  // ── GAP 1 ─────────────────────────────────────────────────────────────────
  // validateForm() is defined but NEVER called from handleSubmit.
  // toastAlert.error() therefore never fires on submit validation failure.
  // This test documents the CURRENT (broken) behaviour.
  // When the gap is fixed, change .not.toHaveBeenCalled() to .toHaveBeenCalled().
  it("[GAP 1] toastAlert.error is NOT called on submit validation failure — validateForm() is dead code", () => {
    validateReview.mockReturnValue(validationFail());
    renderComponent();
    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );

    // CURRENT behaviour: toast never fires because validateForm() is not called
    // DESIRED behaviour: toastAlert.error should fire with the first error message
    expect(toastAlert.error).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GAP 2 — requireUserInfo option missing from handleSubmit
// ══════════════════════════════════════════════════════════════════════════════

describe("[GAP 2] handleSubmit does not pass requireUserInfo option to validateReview", () => {
  it("calls validateReview WITHOUT the requireUserInfo option on submit", () => {
    validateReview.mockReturnValue(validReviewPass());
    renderComponent();

    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );

    // handleSubmit calls validateReview(reviewData) — no second argument.
    // When user auth is wired, this will require name/email even for logged-in users.
    // DESIRED: validateReview(reviewData, { requireUserInfo: false }) for authenticated users
    expect(validateReview).toHaveBeenCalledWith(
      expect.any(Object),
      // No second argument — the options object is absent
    );
    // Confirm the options argument was NOT passed
    expect(validateReview.mock.calls[0][1]).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GAP 3 — onError is silent (no toast)
// ══════════════════════════════════════════════════════════════════════════════

describe("[GAP 3] postReview onError provides no user-facing feedback", () => {
  it("does NOT call toastAlert.error when postReview onError fires", () => {
    let capturedCallbacks;
    const postReview = jest.fn((_data, callbacks) => {
      capturedCallbacks = callbacks;
    });
    useReview.mockReturnValue({ postReview, isPosting: false });
    validateReview.mockReturnValue(validReviewPass());

    renderComponent();
    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );

    act(() => capturedCallbacks.onError(new Error("Network Error")));

    // CURRENT behaviour: toast is never called — failure is silent
    // DESIRED behaviour: toastAlert.error should be called with the error
    expect(toastAlert.error).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GAP 4 — resetForm does not reset hoverRating
// ══════════════════════════════════════════════════════════════════════════════

describe("[GAP 4] resetForm does not reset hoverRating", () => {
  it("preserves hover highlight after form reset if mouse was over a star", () => {
    jest.useFakeTimers();
    let capturedCallbacks;
    const postReview = jest.fn((_data, callbacks) => {
      capturedCallbacks = callbacks;
    });
    useReview.mockReturnValue({ postReview, isPosting: false });
    validateReview.mockReturnValue(validReviewPass());

    renderComponent();

    // Hover over star 5 to set hoverRating = 5
    fireEvent.mouseEnter(screen.getByRole("button", { name: /rate 5 stars/i }));
    expect(screen.getByText(/Excellent/i)).toBeInTheDocument();

    // Submit the form
    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );

    // Trigger onSuccess → resetForm is called
    act(() => capturedCallbacks.onSuccess());

    // CURRENT behaviour: hoverRating is NOT reset — "Excellent" text persists
    // DESIRED behaviour: after reset, should show "Tap to rate"
    // This test documents the gap — it passes with the broken behaviour
    expect(screen.getByText(/Excellent/i)).toBeInTheDocument();

    jest.useRealTimers();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GAP 5 — setTimeout cleanup on unmount
// ══════════════════════════════════════════════════════════════════════════════

describe("[GAP 5] onClose setTimeout has no cleanup on unmount", () => {
  it("fires onClose even after component unmounts within the 2s window", () => {
    jest.useFakeTimers();
    let capturedCallbacks;
    const postReview = jest.fn((_data, callbacks) => {
      capturedCallbacks = callbacks;
    });
    useReview.mockReturnValue({ postReview, isPosting: false });
    validateReview.mockReturnValue(validReviewPass());

    const onClose = jest.fn();
    const { unmount } = renderComponent({ onClose });

    fireEvent.submit(
      screen.getByRole("button", { name: /submit review/i }).closest("form"),
    );

    act(() => capturedCallbacks.onSuccess());

    // Unmount BEFORE the 2s timer fires
    unmount();

    // CURRENT behaviour: setTimeout still fires after unmount — onClose is called
    // DESIRED behaviour: useEffect cleanup should clearTimeout on unmount
    act(() => jest.advanceTimersByTime(2000));
    expect(onClose).toHaveBeenCalled(); // documents the gap — fires despite unmount

    jest.useRealTimers();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// useReview integration
// ══════════════════════════════════════════════════════════════════════════════

describe("RateVendor — useReview integration", () => {
  it("calls useReview with the vendorId prop", () => {
    renderComponent({ vendorId: "vendor-abc" });
    expect(useReview).toHaveBeenCalledWith("vendor-abc");
  });

  it("disables submit and shows Processing when isPosting is true", () => {
    useReview.mockReturnValue({ postReview: jest.fn(), isPosting: true });
    renderComponent();
    expect(screen.getByRole("button", { name: /processing/i })).toBeDisabled();
  });

  it("enables submit when isPosting is false", () => {
    useReview.mockReturnValue({ postReview: jest.fn(), isPosting: false });
    renderComponent();
    expect(
      screen.getByRole("button", { name: /submit review/i }),
    ).not.toBeDisabled();
  });
});
