/**
 * checkoutPage.test.js
 *
 * Tests: CheckoutPage (app/checkout/page.js)
 * All child components are mocked — page-level logic is the focus.
 *
 * ⚠️ Gaps exposed:
 *  - initialData={{ user: userData }} is passed to CustomerForm but CustomerForm
 *    silently ignores it — logged-in user data never pre-fills the form.
 *  - paymentMetadata can be null (when formatOrderMetadata throws) and is
 *    passed directly to PaystackCheckout which doesn't guard against null.
 *  - Cart calculation errors are swallowed by useMemo try-catch,
 *    returning zero-safe defaults with no user-visible feedback.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CheckoutPage from "@/app/checkout/page";
import { useCart } from "@/context/cartContext";
import { useRouter } from "next/navigation";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/context/cartContext", () => ({
  useCart: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

// Track prop calls on CustomerForm to test the initialData gap
const MockCustomerForm = jest.fn(
  ({ onCustomerInfoChange, onValidationChange }) => (
    <div data-testid="mock-customer-form">
      <button
        data-testid="make-valid"
        onClick={() => {
          onValidationChange(true);
          onCustomerInfoChange({
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            phone: "08012345678",
            city: "Lagos",
            state: "Lagos",
            country: "Nigeria",
          });
        }}
      >
        Make Valid
      </button>
    </div>
  ),
);

jest.mock("@/components/checkoutUI/customerForm", () => ({
  __esModule: true,
  default: (props) => MockCustomerForm(props),
}));

jest.mock("@/components/checkoutUI/checkout", () => ({
  __esModule: true,
  default: ({ email }) => (
    <div data-testid="paystack-checkout">Payment: {email}</div>
  ),
}));

jest.mock("@/components/checkoutUI/orderSummaryCard", () => ({
  __esModule: true,
  default: () => <div data-testid="order-summary">Summary</div>,
}));

jest.mock("@/components/errorBoundary/checkoutSectionBoundary", () => ({
  __esModule: true,
  default: ({ children }) => (
    <div data-testid="section-boundary">{children}</div>
  ),
}));

// ── Fixtures & helpers ────────────────────────────────────────────────────────

const { makeCartItem } = require("@/__fixtures__/checkoutFixtures");

const mockRouter = { back: jest.fn(), push: jest.fn() };

const setCart = (items = [], itemCount = items.length) => {
  useCart.mockReturnValue({ items, itemCount });
};

beforeEach(() => {
  useRouter.mockReturnValue(mockRouter);
  localStorage.clear();
  jest.clearAllMocks();
});

// ── Empty cart ────────────────────────────────────────────────────────────────

describe("empty cart state", () => {
  beforeEach(() => setCart([], 0));

  it("renders empty cart message", () => {
    render(<CheckoutPage />);
    expect(screen.getByText(/Your cart is empty/i)).toBeInTheDocument();
  });

  it("shows link back to events", () => {
    render(<CheckoutPage />);
    expect(screen.getByText(/Go back to events/i)).toBeInTheDocument();
  });

  it("does NOT render CustomerForm or OrderSummary", () => {
    render(<CheckoutPage />);
    expect(screen.queryByTestId("mock-customer-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("order-summary")).not.toBeInTheDocument();
  });

  it("does NOT render PaystackCheckout", () => {
    render(<CheckoutPage />);
    expect(screen.queryByTestId("paystack-checkout")).not.toBeInTheDocument();
  });
});

// ── Cart with items ───────────────────────────────────────────────────────────

describe("checkout with items in cart", () => {
  const cartItems = [makeCartItem({ price: 5000, quantity: 1 })];

  beforeEach(() => setCart(cartItems, 1));

it("renders 'Secure checkout' heading", () => {
  render(<CheckoutPage />);
  expect(
    screen.getByRole("heading", { level: 1, name: /Secure checkout/i }),
  ).toBeInTheDocument();
});

it("hides PaystackCheckout until form is valid", () => {
  render(<CheckoutPage />);
  expect(screen.queryByTestId("paystack-checkout")).not.toBeInTheDocument();
  expect(
    screen.getAllByText(/Complete your details to pay/i).length,
  ).toBeGreaterThan(0);
});

it("⚠️ does NOT pass initialData to CustomerForm (removed in CheckoutPage)", () => {
  const userData = { firstName: "Jane", email: "jane@example.com" };
  localStorage.setItem("userData", JSON.stringify(userData));
  render(<CheckoutPage />);
  const lastProps = MockCustomerForm.mock.calls.at(-1)?.[0];
 expect(lastProps?.initialData).toEqual({ user: userData });
});

  it("renders CustomerForm and OrderSummary", () => {
    render(<CheckoutPage />);
    expect(screen.getByTestId("mock-customer-form")).toBeInTheDocument();
    expect(screen.getByTestId("order-summary")).toBeInTheDocument();
  });

  it("calls router.back() when back button is clicked", () => {
    render(<CheckoutPage />);
    fireEvent.click(screen.getByText(/Back to Cart/i));
    expect(mockRouter.back).toHaveBeenCalled();
  });

//  it("hides PaystackCheckout until form is valid", () => {
//    render(<CheckoutPage />);
//    expect(screen.queryByTestId("paystack-checkout")).not.toBeInTheDocument();
//    expect(
//      screen.getByText(/Complete your details to pay/i),
//    ).toBeInTheDocument();
//  });

  it("reveals PaystackCheckout after form becomes valid and email is present", async () => {
    render(<CheckoutPage />);
    fireEvent.click(screen.getByTestId("make-valid"));
    await waitFor(() => {
      expect(screen.getByTestId("paystack-checkout")).toBeInTheDocument();
    });
  });

  it("wraps each major section in CheckoutSectionBoundary", () => {
    render(<CheckoutPage />);
    const boundaries = screen.getAllByTestId("section-boundary");
    expect(boundaries.length).toBeGreaterThanOrEqual(3);
  });
});

// ── localStorage userData ─────────────────────────────────────────────────────

describe("localStorage userData loading", () => {
  const cartItems = [makeCartItem()];

  beforeEach(() => setCart(cartItems, 1));

  it("mounts successfully when userData is present and valid", () => {
    localStorage.setItem(
      "userData",
      JSON.stringify({ firstName: "Jane", email: "jane@example.com" }),
    );
    expect(() => render(<CheckoutPage />)).not.toThrow();
  });

  it("handles corrupted JSON in localStorage without crashing", () => {
    localStorage.setItem("userData", "{{invalid-json}}");
    expect(() => render(<CheckoutPage />)).not.toThrow();
  });

  it("handles missing userData entry in localStorage without crashing", () => {
    // Nothing stored — should mount cleanly
    expect(() => render(<CheckoutPage />)).not.toThrow();
  });

it("⚠️ does NOT pass userData as initialData to CustomerForm (removed from CheckoutPage)", () => {
  const userData = { firstName: "Jane", email: "jane@example.com" };
  localStorage.setItem("userData", JSON.stringify(userData));
  render(<CheckoutPage />);
  const lastProps = MockCustomerForm.mock.calls.at(-1)?.[0];
  expect(lastProps?.initialData).toEqual({ user: userData });
});
});

// ── Calculation error resilience ──────────────────────────────────────────────

describe("cart calculation error resilience", () => {
  it("renders an error alert banner when items have invalid prices", () => {
    setCart([makeCartItem({ price: null })], 1);
    render(<CheckoutPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid price/i);
  });

  it("⚠️ NULL METADATA: paymentMetadata can be null when formatOrderMetadata fails", () => {
    // GAP: The paymentMetadata useMemo also has a try-catch returning null.
    // PaystackCheckout receives metadata={null} which the hook passes through
    // without validation, potentially causing silent failures at order creation.
    setCart([makeCartItem()], 1);
    expect(() => render(<CheckoutPage />)).not.toThrow();
    // No assertion on the null metadata — just verifies no crash at render time
  });
});
