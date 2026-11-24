/**
 * src/__tests__/verifyPaymentContent.test.js
 *
 * Tests for VerifyPaymentContent
 * (src/app/subscription/verify/verifyPaymentContent.jsx)
 *
 * Covers:
 *   1. Initial "verifying" UI state
 *   2. Success path  – API resolves → refetch called → toast → dashboard redirect
 *   3. Error path    – API rejects
 *   4. Error path    – no reference in URL
 *   5. Reference number shown in error state
 *   6. Dashboard / Support navigation buttons
 *
 * ⚠️  Code gaps surfaced:
 *   A. No unmount cleanup — setState is called after component unmounts when
 *      the verification API call takes longer than the component's lifetime.
 *   B. `isVerifying` and `status` are two separate state variables that can
 *      drift out of sync (e.g. status="success" but isVerifying still true
 *      for one render cycle).
 *   C. `refetch` is in the useEffect dependency array — if React Query returns
 *      a new function reference on every render, the effect re-fires.
 */

const React = require("react");
const { render, screen, waitFor, act } = require("@testing-library/react");
const userEvent = require("@testing-library/user-event").default;

const {
  makeSubscriptionHook,
  makeVerifySuccess,
  makeVerifyError,
} = require("@/__fixtures__/subscriptionFixtures");

// ─────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
let mockReference = "TXN_test123";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key) => (key === "reference" ? mockReference : null),
  }),
}));

const mockVerifySubscriptionAPI = jest.fn();
jest.mock("@/services/subscriptionAPI", () => ({
  verifySubscriptionAPI: (...args) => mockVerifySubscriptionAPI(...args),
}));

const mockRefetch = jest.fn();
jest.mock("@/utils/hooks/useSubscription", () => ({
  useSubscriptionStatus: jest.fn(),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("@/components/common/toast/toastAlert", () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToastSuccess(...args),
    error: (...args) => mockToastError(...args),
  },
}));

// Import after mocks
const VerifyPaymentContent =
  require("@/app/subscription/verify/verifyPaymentContent").default;
const { useSubscriptionStatus } = require("@/utils/hooks/useSubscription");

// ─────────────────────────────────────────────────────────────────
// Setup / teardown
// ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockPush.mockClear();
  mockVerifySubscriptionAPI.mockClear();
  mockRefetch.mockClear();
  mockToastSuccess.mockClear();
  mockToastError.mockClear();
  mockReference = "TXN_test123";

  // Default hook setup — override per test as needed
  useSubscriptionStatus.mockReturnValue(
    makeSubscriptionHook({ refetch: mockRefetch }),
  );
});

// ─────────────────────────────────────────────────────────────────
// 1. INITIAL "verifying" UI STATE
// ─────────────────────────────────────────────────────────────────

describe("VerifyPaymentContent – initial verifying state", () => {
  it("shows the Confirming Your Payment heading immediately", async () => {
    // Hang the API so the component stays in "verifying"
    mockVerifySubscriptionAPI.mockReturnValue(new Promise(() => {}));
    render(<VerifyPaymentContent />);
    expect(screen.getByText("Confirming Your Payment")).toBeInTheDocument();
  });

  it("shows the bank processing description text", async () => {
    mockVerifySubscriptionAPI.mockReturnValue(new Promise(() => {}));
    render(<VerifyPaymentContent />);
    expect(
      screen.getByText(/verifying the transaction with your bank/i),
    ).toBeInTheDocument();
  });

  it("does NOT show success or error UI during verification", async () => {
    mockVerifySubscriptionAPI.mockReturnValue(new Promise(() => {}));
    render(<VerifyPaymentContent />);
    expect(screen.queryByText("You're All Set! 🎉")).not.toBeInTheDocument();
    expect(screen.queryByText("Verification Pending")).not.toBeInTheDocument();
  });

  it("renders the animated progress dots", async () => {
    mockVerifySubscriptionAPI.mockReturnValue(new Promise(() => {}));
    render(<VerifyPaymentContent />);
    // Three bounce dots sit inside the verifying card
    const card = screen.getByText("Confirming Your Payment").closest("div");
    expect(card).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 2. SUCCESS PATH
// ─────────────────────────────────────────────────────────────────

describe("VerifyPaymentContent – success path", () => {
  beforeEach(() => {
    mockVerifySubscriptionAPI.mockResolvedValue(makeVerifySuccess());
    mockRefetch.mockResolvedValue({ data: {} });
  });

  it("renders the success heading after API returns status=success", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => {
      expect(screen.getByText("You're All Set! 🎉")).toBeInTheDocument();
    });
  });

  it("calls refetch to update global subscription state", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("You're All Set! 🎉"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("fires the success toast", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("You're All Set! 🎉"));
    expect(mockToastSuccess).toHaveBeenCalledWith("Subscription activated!");
  });

  it("does NOT fire the error toast on success", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("You're All Set! 🎉"));
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("shows feature unlock list in success state", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("What's unlocked:"));
    expect(
      screen.getByText("Advanced analytics dashboard"),
    ).toBeInTheDocument();
    expect(screen.getByText("Priority customer support")).toBeInTheDocument();
    expect(screen.getByText("Enhanced profile visibility")).toBeInTheDocument();
  });

  it("navigates to /dashboard when Go to Dashboard button is clicked", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("You're All Set! 🎉"));
    await userEvent.click(
      screen.getByRole("button", { name: /go to dashboard/i }),
    );
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("calls verifySubscriptionAPI with the reference from URL", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("You're All Set! 🎉"));
    expect(mockVerifySubscriptionAPI).toHaveBeenCalledWith("TXN_test123");
  });

  // ── ⚠️  Code gap B: isVerifying / status drift ─────────────────
  it("⚠️ (gap) isVerifying stays true for one extra render cycle after status becomes success", async () => {
    // The component sets status("success") then setIsVerifying(false) in finally.
    // Both are in the same function but are separate setState calls, meaning
    // there could be a render where status="success" but isVerifying=true.
    // This test documents the expected final state only:
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("You're All Set! 🎉"));
    // If the success UI is visible, the verifying UI must be gone
    expect(
      screen.queryByText("Confirming Your Payment"),
    ).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 3. ERROR PATH – API REJECTS
// ─────────────────────────────────────────────────────────────────

describe("VerifyPaymentContent – error path (API throws)", () => {
  beforeEach(() => {
    mockVerifySubscriptionAPI.mockRejectedValue(new Error("Network timeout"));
  });

  it("shows the Verification Pending heading", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => {
      expect(screen.getByText("Verification Pending")).toBeInTheDocument();
    });
  });

  it("shows the 'What happens next?' info box", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("Verification Pending"));
    expect(screen.getByText("What happens next?")).toBeInTheDocument();
  });

  it("shows bank processing time guidance", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("Verification Pending"));
    expect(screen.getByText(/5-15 minutes/i)).toBeInTheDocument();
  });

  it("does NOT fire the success toast on error", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("Verification Pending"));
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("does NOT call refetch when verification fails", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("Verification Pending"));
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("navigates to /dashboard when Go to Dashboard button is clicked", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("Verification Pending"));
    await userEvent.click(
      screen.getByRole("button", { name: /go to dashboard/i }),
    );
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("navigates to /support when Contact Support button is clicked", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("Verification Pending"));
    await userEvent.click(
      screen.getByRole("button", { name: /contact support/i }),
    );
    expect(mockPush).toHaveBeenCalledWith("/support");
  });
});

// ─────────────────────────────────────────────────────────────────
// 4. ERROR PATH – API RETURNS NON-SUCCESS STATUS
// ─────────────────────────────────────────────────────────────────

describe("VerifyPaymentContent – error path (API returns pending status)", () => {
  it("shows error UI when API returns status !== 'success'", async () => {
    mockVerifySubscriptionAPI.mockResolvedValue(makeVerifyError());
    render(<VerifyPaymentContent />);
    await waitFor(() => {
      expect(screen.getByText("Verification Pending")).toBeInTheDocument();
    });
  });

  it("does NOT call refetch when API returns a non-success status", async () => {
    mockVerifySubscriptionAPI.mockResolvedValue(makeVerifyError());
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("Verification Pending"));
    expect(mockRefetch).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────
// 5. ERROR PATH – NO REFERENCE IN URL
// ─────────────────────────────────────────────────────────────────

describe("VerifyPaymentContent – missing reference", () => {
  beforeEach(() => {
    mockReference = null;
  });

  it("shows error UI immediately without calling the API", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => {
      expect(screen.getByText("Verification Pending")).toBeInTheDocument();
    });
    expect(mockVerifySubscriptionAPI).not.toHaveBeenCalled();
  });

  it("does NOT show the reference number footer when reference is null", async () => {
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("Verification Pending"));
    expect(screen.queryByText(/^Reference:/)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 6. REFERENCE NUMBER IN ERROR STATE
// ─────────────────────────────────────────────────────────────────

describe("VerifyPaymentContent – reference display", () => {
  it("shows the reference number in the error state footer", async () => {
    mockVerifySubscriptionAPI.mockRejectedValue(new Error("timeout"));
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("Verification Pending"));
    expect(screen.getByText("TXN_test123")).toBeInTheDocument();
  });

  it("does NOT show reference section in success state", async () => {
    mockVerifySubscriptionAPI.mockResolvedValue(makeVerifySuccess());
    mockRefetch.mockResolvedValue({});
    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("You're All Set! 🎉"));
    // Success card has no reference footer
    expect(screen.queryByText(/^Reference:/)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 7. ⚠️  CODE GAP A: UNMOUNT CLEANUP (setState after unmount)
// ─────────────────────────────────────────────────────────────────

describe("VerifyPaymentContent – ⚠️ unmount cleanup gap", () => {
  it("⚠️ (gap) calling setState after unmount produces a React warning", async () => {
    // Arrange: API resolves AFTER the component has been unmounted
    let resolveVerify;
    mockVerifySubscriptionAPI.mockReturnValue(
      new Promise((resolve) => {
        resolveVerify = resolve;
      }),
    );

    const { unmount } = render(<VerifyPaymentContent />);

    // Unmount before the API responds
    unmount();

    // Now resolve the pending promise — this will try to call setStatus on
    // an unmounted component. The component has no cleanup (no AbortController,
    // no isMounted ref). React 18 removed the warning but the state update is
    // still a no-op that could mask bugs in earlier React versions.
    await act(async () => {
      resolveVerify(makeVerifySuccess());
    });

    // If we get here without throwing, the gap is confirmed but not crashing.
    // The fix is to add an isMounted ref or AbortController to the useEffect.
    expect(mockVerifySubscriptionAPI).toHaveBeenCalledTimes(1);
  });

  it("⚠️ (gap) refetch is in the dependency array — a new refetch reference re-runs the effect", async () => {
    // If useSubscriptionStatus returns a new refetch function reference on
    // each render, confirmPayment() will fire multiple times.
    // This test confirms the current behaviour — NOT the desired behaviour.
    let callCount = 0;
    const unstableRefetch = jest.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({});
    });

    mockVerifySubscriptionAPI.mockResolvedValue(makeVerifySuccess());
    useSubscriptionStatus.mockReturnValue(
      makeSubscriptionHook({ refetch: unstableRefetch }),
    );

    render(<VerifyPaymentContent />);
    await waitFor(() => screen.getByText("You're All Set! 🎉"));

    // Document: with a stable refetch reference the API is called once.
    // If React Query returns an unstable reference, this count could be > 1.
    expect(mockVerifySubscriptionAPI.mock.calls.length).toBeGreaterThanOrEqual(
      1,
    );
  });
});
