/**
 * checkoutHooks.test.js
 *
 * Tests: usePaystackIntegration, usePaymentVerification
 *
 * ⚠️ Gaps exposed:
 *  - isLoading is NEVER reset to false after a successful redirect.
 *    If window.location.href fails silently, the Pay button is stuck disabled.
 *  - usePaymentVerification with null trxref spins "verifying" forever.
 *    Status should transition to 'error' immediately.
 *  - usePaymentVerification does not store trxref to localStorage before
 *    verification begins — if the browser closes mid-verify, recovery is lost.
 *  - Email regex mismatch: form accepts single-char TLD, hook rejects it.
 *  - Cart clearance happens before sessionStorage cleanup; if clearCart throws,
 *    the draft is never removed.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { usePaystackIntegration } from "@/utils/hooks/usePaystackIntegration";
import { usePaymentVerification } from "@/utils/hooks/usePaymentVerification";
import backendInstance from "@/axiosConfig/axios";
import { useCart } from "@/context/cartContext";
import toastAlert from "@/components/common/toast/toastAlert";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/axiosConfig/axios", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    isCancel: jest.fn((e) => e?.__isCanceled === true),
  },
  ENDPOINTS: {
    ORDERS: { INITIALIZE: "/api/orders/initialize" },
    PAYMENTS: { VERIFY: "/api/payments/verify" },
  },
}));

jest.mock("@/context/cartContext", () => ({
  useCart: jest.fn(),
}));

jest.mock("@/components/common/toast/toastAlert", () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const {
  makeCartItem,
  makePaystackInitResponse,
  makeVerifySuccessResponse,
} = require("@/__fixtures__/checkoutFixtures");

const VALID_EMAIL = "john@example.com";
const TRXREF = "TXN_TEST123";

const mockItems = [
  makeCartItem({ eventId: "evt-001", tierId: "tier-1", quantity: 2 }),
];

const mockMetadata = {
  customer_info: {
    firstName: "John",
    lastName: "Doe",
    phone: "08012345678",
  },
};

// ── navigate mock — injected into hook to observe redirects ─────────────────
// jsdom implements window.location.href as an IDL attribute backed by internal
// C++ slots. No JavaScript Object.defineProperty can intercept IDL writes, so
// asserting on window.location.href after a redirect always sees "".
// Solution: inject a jest.fn() as the navigate dependency — clean, explicit,
// and zero jsdom fighting.

let mockNavigate;

beforeEach(() => {
  mockNavigate = jest.fn();

  useCart.mockReturnValue({
    items: mockItems,
    clearCart: jest.fn(),
  });

  sessionStorage.clear();
  localStorage.clear();
  jest.clearAllMocks();

  // Re-apply useCart after clearAllMocks wipes it
  useCart.mockReturnValue({
    items: mockItems,
    clearCart: jest.fn(),
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
// usePaystackIntegration
// ════════════════════════════════════════════════════════════════════════════

describe("usePaystackIntegration", () => {
  const render = (overrides = {}) =>
    renderHook(() =>
      usePaystackIntegration({
        email: VALID_EMAIL,
        metadata: mockMetadata,
        navigate: mockNavigate,
        ...overrides,
      }),
    );

  // ── isReady ───────────────────────────────────────────────────────────────

  describe("isReady flag", () => {
    it("is true when email is valid and cart has items", () => {
      const { result } = render();
      expect(result.current.isReady).toBe(true);
    });

    it("is false for empty string email", () => {
      const { result } = render({ email: "" });
      expect(result.current.isReady).toBe(false);
    });

    it("is false for malformed email (no @)", () => {
      const { result } = render({ email: "notanemail" });
      expect(result.current.isReady).toBe(false);
    });

    it("is false when cart is empty", () => {
      useCart.mockReturnValue({ items: [], clearCart: jest.fn() });
      const { result } = render();
      expect(result.current.isReady).toBe(false);
    });

    it("is false when useCart returns undefined items", () => {
      useCart.mockReturnValue({ items: undefined, clearCart: jest.fn() });
      const { result } = render();
      expect(result.current.isReady).toBe(false);
    });

    it("⚠️ EMAIL REGEX MISMATCH: single-char TLD is false here, but passes form validation", () => {
      // form validator: /^[^\s@]+@[^\s@]+\.[^\s@]+$/    (no min TLD length)
      // hook validator: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ (requires 2+ chars)
      // "user@domain.c" shows a Pay button (form valid) that can never fire.
      const { result } = render({ email: "user@domain.c" });
      expect(result.current.isReady).toBe(false);
    });
  });

  // ── handlePayment — pre-flight ─────────────────────────────────────────────

  describe("handlePayment — pre-flight validation", () => {
    it("shows error toast and skips API call for bad email", async () => {
      const { result } = render({ email: "bad" });
      await act(async () => {
        await result.current.handlePayment();
      });
      expect(backendInstance.post).not.toHaveBeenCalled();
      expect(toastAlert.error).toHaveBeenCalledWith(
        expect.stringContaining("valid email"),
      );
    });

    it("shows error toast and skips API call when cart is empty", async () => {
      useCart.mockReturnValue({ items: [], clearCart: jest.fn() });
      const { result } = render();
      await act(async () => {
        await result.current.handlePayment();
      });
      expect(backendInstance.post).not.toHaveBeenCalled();
      expect(toastAlert.error).toHaveBeenCalledWith(
        expect.stringContaining("empty"),
      );
    });
  });

  // ── handlePayment — API call shape ────────────────────────────────────────

  describe("handlePayment — API call shape", () => {
    it("sends correct payload structure to ORDERS.INITIALIZE endpoint", async () => {
      backendInstance.post.mockResolvedValueOnce({
        data: makePaystackInitResponse(),
      });
      const { result } = render();
      await act(async () => {
        await result.current.handlePayment();
      });
      expect(backendInstance.post).toHaveBeenCalledWith(
        expect.stringContaining("initialize"),
        expect.objectContaining({
          email: VALID_EMAIL,
          firstName: "John",
          lastName: "Doe",
          items: expect.arrayContaining([
            expect.objectContaining({
              eventId: "evt-001",
              ticketTierId: "tier-1",
              quantity: 2,
            }),
          ]),
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("sets isLoading=true during API call", async () => {
      // Never resolves — keeps the loading state
      backendInstance.post.mockReturnValueOnce(new Promise(() => {}));
      const { result } = render();
      act(() => {
        result.current.handlePayment();
      });
      await waitFor(() => expect(result.current.isLoading).toBe(true));
    });
  });

  // ── handlePayment — success path ──────────────────────────────────────────

  describe("handlePayment — success path", () => {
    it("redirects to authorization_url on success", async () => {
      backendInstance.post.mockResolvedValueOnce({
        data: makePaystackInitResponse(),
      });
      const { result } = render();
      await act(async () => {
        await result.current.handlePayment();
      });
      // navigate() is the injected dependency — its argument is the redirect URL.
      expect(mockNavigate).toHaveBeenCalledWith(
        "https://paystack.com/pay/test-abc123",
      );
    });

    it("⚠️ LOADING STUCK: isLoading is NOT reset to false after successful redirect", async () => {
      // GAP: The success branch sets window.location.href and returns.
      // setIsLoading(false) is only called in the catch block.
      // If the redirect works, the button stays disabled (loading=true).
      // This matters for popup blockers that silently fail the assignment.
      backendInstance.post.mockResolvedValueOnce({
        data: makePaystackInitResponse(),
      });
      const { result } = render();
      await act(async () => {
        await result.current.handlePayment();
      });
      expect(result.current.isLoading).toBe(true); // stuck — never reset
    });

    it("throws error when authorization_url is missing from response", async () => {
      backendInstance.post.mockResolvedValueOnce({
        data: { status: "success", data: {} }, // no authorization_url
      });
      const { result } = render();
      await act(async () => {
        await result.current.handlePayment();
      });
      expect(toastAlert.error).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled(); // no redirect
    });
  });

  // ── handlePayment — error handling ────────────────────────────────────────

  describe("handlePayment — error handling", () => {
    it("shows sold-out toast for 409 response", async () => {
      const err = { response: { status: 409 } };
      backendInstance.post.mockRejectedValueOnce(err);
      const { result } = render();
      await act(async () => {
        await result.current.handlePayment();
      });
      expect(toastAlert.error).toHaveBeenCalledWith(
        expect.stringContaining("sold out"),
      );
      expect(result.current.isLoading).toBe(false);
    });

    it("shows server error toast for 500 response", async () => {
      backendInstance.post.mockRejectedValueOnce({
        response: { status: 500 },
      });
      const { result } = render();
      await act(async () => {
        await result.current.handlePayment();
      });
      expect(toastAlert.error).toHaveBeenCalledWith(
        expect.stringContaining("Server error"),
      );
      expect(result.current.isLoading).toBe(false);
    });

    it("shows timeout toast for ECONNABORTED error", async () => {
      backendInstance.post.mockRejectedValueOnce({
        code: "ECONNABORTED",
        message: "timeout of 30000ms exceeded",
      });
      const { result } = render();
      await act(async () => {
        await result.current.handlePayment();
      });
      expect(toastAlert.error).toHaveBeenCalledWith(
        expect.stringContaining("timed out"),
      );
    });

    it("shows server message for unknown non-network error", async () => {
      backendInstance.post.mockRejectedValueOnce({
        response: { status: 422, data: { message: "Invalid ticket tier" } },
      });
      const { result } = render();
      await act(async () => {
        await result.current.handlePayment();
      });
      expect(toastAlert.error).toHaveBeenCalledWith("Invalid ticket tier");
    });

    it("silently ignores cancelled requests (isCancel = true)", async () => {
      const cancelError = { __isCanceled: true };
      backendInstance.isCancel.mockReturnValueOnce(true);
      backendInstance.post.mockRejectedValueOnce(cancelError);
      const { result } = render();
      await act(async () => {
        await result.current.handlePayment();
      });
      expect(toastAlert.error).not.toHaveBeenCalled();
    });
  });

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  describe("cleanup", () => {
    it("AbortController aborts pending request on unmount", async () => {
      backendInstance.post.mockReturnValueOnce(new Promise(() => {}));
      const { result, unmount } = render();

      act(() => {
        result.current.handlePayment();
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      // Capture the signal before unmount
      const signal = backendInstance.post.mock.calls[0][2]?.signal;
      unmount();

      expect(signal?.aborted).toBe(true);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// usePaymentVerification
// ════════════════════════════════════════════════════════════════════════════

describe("usePaymentVerification", () => {
  // ── Initial state ─────────────────────────────────────────────────────────

  describe("initial state", () => {
    it("starts with verificationStatus='verifying'", () => {
      backendInstance.get.mockReturnValueOnce(new Promise(() => {})); // never resolves
      const { result } = renderHook(() => usePaymentVerification(TRXREF));
      expect(result.current.verificationStatus).toBe("verifying");
    });

    it("⚠️ NULL TRXREF: stays 'verifying' forever — should be 'error'", () => {
      // GAP: The effect guard is `if (!trxref || hasVerifiedRef.current) return`
      // When trxref is null, the effect returns early and never sets status to 'error'.
      // The user sees an infinite spinner with no recovery path.
      const { result } = renderHook(() => usePaymentVerification(null));
      expect(result.current.verificationStatus).toBe("verifying");
      // Should be 'error' — this is the gap being documented
    });

    it("exposes trxref, retryCount and formatCurrency in return value", () => {
      backendInstance.get.mockReturnValueOnce(new Promise(() => {}));
      const { result } = renderHook(() => usePaymentVerification(TRXREF));
      expect(result.current.trxref).toBe(TRXREF);
      expect(result.current.retryCount).toBe(0);
      expect(typeof result.current.formatCurrency).toBe("function");
    });
  });

  // ── Success path ──────────────────────────────────────────────────────────

  describe("success path", () => {
    it("transitions to 'success' on status='success' response", async () => {
      backendInstance.get.mockResolvedValueOnce({
        data: makeVerifySuccessResponse(),
      });
      const { result } = renderHook(() => usePaymentVerification(TRXREF));
      await waitFor(() =>
        expect(result.current.verificationStatus).toBe("success"),
      );
    });

    it("populates paymentData from response on success", async () => {
      backendInstance.get.mockResolvedValueOnce({
        data: makeVerifySuccessResponse(),
      });
      const { result } = renderHook(() => usePaymentVerification(TRXREF));
      await waitFor(() => expect(result.current.paymentData).not.toBeNull());
      expect(result.current.paymentData).toMatchObject({
        reference: TRXREF,
        amountPaid: expect.any(Number),
      });
    });

    it("calls clearCart on successful verification", async () => {
      const mockClearCart = jest.fn();
      useCart.mockReturnValue({ items: mockItems, clearCart: mockClearCart });
      backendInstance.get.mockResolvedValueOnce({
        data: makeVerifySuccessResponse(),
      });
      renderHook(() => usePaymentVerification(TRXREF));
      await waitFor(() => expect(mockClearCart).toHaveBeenCalledTimes(1));
    });

    it("clears checkout draft from sessionStorage on success", async () => {
      const DRAFT_KEY = "checkout_customer_draft";
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ firstName: "John" }));
      backendInstance.get.mockResolvedValueOnce({
        data: makeVerifySuccessResponse(),
      });
      renderHook(() => usePaymentVerification(TRXREF));
      await waitFor(() => expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull());
    });

    it("does NOT call verify again after first success (hasVerifiedRef guard)", async () => {
      backendInstance.get.mockResolvedValue({
        data: makeVerifySuccessResponse(),
      });
      renderHook(() => usePaymentVerification(TRXREF));
      await waitFor(() => expect(backendInstance.get).toHaveBeenCalledTimes(1));
      // Wait a tick to confirm no second call
      await new Promise((r) => setTimeout(r, 100));
      expect(backendInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  // ── Pending / retry path ──────────────────────────────────────────────────

  describe("pending path", () => {
    it("transitions to 'pending' on status='pending' response", async () => {
      backendInstance.get.mockResolvedValueOnce({
        data: { status: "pending", data: null },
      });
      const { result } = renderHook(() => usePaymentVerification(TRXREF));
      await waitFor(() =>
        expect(result.current.verificationStatus).toBe("pending"),
      );
    });

    it("transitions to 'pending_timeout' after 3 retries without success", async () => {
      jest.useFakeTimers();
      backendInstance.get.mockResolvedValue({
        data: { status: "pending", data: null },
      });

      const { result } = renderHook(() => usePaymentVerification(TRXREF));

      // Exhaust all 3 retries by advancing timers
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          jest.runAllTimers();
        });
      }

      await waitFor(() =>
        expect(result.current.verificationStatus).toBe("pending_timeout"),
      );

      jest.useRealTimers();
    });
  });

  // ── Error paths ───────────────────────────────────────────────────────────

  describe("error paths", () => {
    it("transitions to 'not_found' on 404 response", async () => {
      backendInstance.get.mockRejectedValueOnce({
        response: { status: 404 },
      });
      const { result } = renderHook(() => usePaymentVerification(TRXREF));
      await waitFor(() =>
        expect(result.current.verificationStatus).toBe("not_found"),
      );
    });

    it("transitions to 'failed' on 400 response", async () => {
      backendInstance.get.mockRejectedValueOnce({
        response: { status: 400 },
      });
      const { result } = renderHook(() => usePaymentVerification(TRXREF));
      await waitFor(() =>
        expect(result.current.verificationStatus).toBe("failed"),
      );
    });

    it("transitions to 'error' on unexpected network failure", async () => {
      backendInstance.get.mockRejectedValueOnce(new Error("Network Error"));
      const { result } = renderHook(() => usePaymentVerification(TRXREF));
      await waitFor(() =>
        expect(result.current.verificationStatus).toBe("error"),
      );
    });

    it("transitions to 'failed' when response status is not 'success' or 'pending'", async () => {
      backendInstance.get.mockResolvedValueOnce({
        data: { status: "cancelled", data: null },
      });
      const { result } = renderHook(() => usePaymentVerification(TRXREF));
      await waitFor(() =>
        expect(result.current.verificationStatus).toBe("failed"),
      );
    });
  });

  // ── formatCurrency ────────────────────────────────────────────────────────

  describe("formatCurrency helper", () => {
    it("formats naira with NGN locale and no fractional digits for round amounts", () => {
      backendInstance.get.mockReturnValueOnce(new Promise(() => {}));
      const { result } = renderHook(() => usePaymentVerification(TRXREF));
      const formatted = result.current.formatCurrency(5000);
      expect(formatted).toMatch(/5/); // value present
      expect(formatted).toMatch(/NGN|₦|N/); // currency symbol present
    });

    it("returns a string for 0 amount", () => {
      backendInstance.get.mockReturnValueOnce(new Promise(() => {}));
      const { result } = renderHook(() => usePaymentVerification(TRXREF));
      expect(typeof result.current.formatCurrency(0)).toBe("string");
    });
  });

  // ── localStorage ref preservation ─────────────────────────────────────────

  describe("⚠️ localStorage reference preservation gap", () => {
    it("does NOT store trxref in localStorage before verification begins", () => {
      // GAP: The hook only stores the reference (last_payment_reference) in
      // PaymentVerificationBoundary's componentDidCatch, not proactively in the
      // hook itself. If the browser crashes during the API call before any
      // boundary error, the reference is unrecoverable from localStorage.
      backendInstance.get.mockReturnValueOnce(new Promise(() => {}));
      renderHook(() => usePaymentVerification(TRXREF));
      // Reference is NOT in localStorage at this point — gap documented:
      expect(localStorage.getItem("last_payment_reference")).toBeNull();
    });
  });
});
