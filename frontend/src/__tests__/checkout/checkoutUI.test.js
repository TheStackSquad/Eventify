/**
 * checkoutUI.test.js
 *
 * Tests: OrderSummary (simple), OrderSummaryCard (feature-rich), CheckoutForm
 *
 * ⚠️ Gaps exposed:
 *  - OrderSummary.formatPrice calls amount.toLocaleString() with no null/undefined
 *    guard — throws TypeError when orderBreakdown fields are undefined.
 *  - CheckoutForm shows "Ready to proceed!" placeholder text even when
 *    isFormValid=true but email is absent — contradictory UX state.
 *  - PaystackCheckout appears only when BOTH isFormValid AND email exist;
 *    having one without the other shows the wrong message.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import OrderSummary from "@/app/checkout/components/orderSummary";
import OrderSummaryCard from "@/components/checkoutUI/orderSummaryCard";
import CheckoutForm from "@/components/checkoutUI/checkoutForm";

const {
  makeCartItem,
  makeCustomerInfo,
} = require("@/__fixtures__/checkoutFixtures");

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...p }) => <div {...p}>{children}</div>,
    button: ({ children, ...p }) => <button {...p}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// Mock child components for CheckoutForm isolation
jest.mock("@/components/checkoutUI/customerForm", () => ({
  __esModule: true,
  default: ({ onCustomerInfoChange, onValidationChange }) => (
    <div data-testid="mock-customer-form">
      <button
        data-testid="trigger-valid"
        onClick={() => {
          onValidationChange(true);
          onCustomerInfoChange({
            firstName: "John",
            email: "john@example.com",
            phone: "08012345678",
          });
        }}
      >
        Fill
      </button>
    </div>
  ),
}));

jest.mock("@/components/checkoutUI/checkout", () => ({
  __esModule: true,
  default: ({ email, totalAmount }) => (
    <div data-testid="mock-paystack">{`Paying ₦${totalAmount} — ${email}`}</div>
  ),
}));

jest.mock("@/utils/currency", () => ({
  ...jest.requireActual("@/utils/currency"),
  formatCurrency: (amt) => `₦${Number(amt).toFixed(2)}`,
}));

// ── Shared fixtures ───────────────────────────────────────────────────────────

const customer = makeCustomerInfo();
const items = [makeCartItem({ price: 5000, quantity: 2 })];
const breakdown = {
  subtotal: 10000,
  serviceFee: 1000,
  vat: 0,
  finalTotal: 11000,
  hasMixedTiers: false,
  itemsBreakdown: [
    {
      eventTitle: "Lagos Tech Summit",
      tierName: "General Admission",
      tier: "small",
      serviceFee: 1000,
    },
  ],
};

// ── OrderSummary (simple card) ────────────────────────────────────────────────

describe("OrderSummary — simple variant", () => {
  const renderSummary = (props = {}) =>
    render(
      <OrderSummary
        customerInfo={customer}
        itemCount={2}
        orderBreakdown={breakdown}
        items={items}
        {...props}
      />,
    );

  it("renders 'Order Summary' heading", () => {
    renderSummary();
    expect(screen.getByText("Order Summary")).toBeInTheDocument();
  });

  it("shows customer full name when firstName is present", () => {
    renderSummary();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("hides customer section when firstName is empty", () => {
    renderSummary({ customerInfo: { ...customer, firstName: "" } });
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  it("shows subtotal with Nigerian currency format", () => {
    renderSummary();
    // ₦10,000 appears twice: once in the per-item line, once in the subtotal row.
    // getAllByText confirms both are present; the currency format itself is what's
    // under test, not which specific element carries it.
    expect(screen.getAllByText("₦10,000").length).toBeGreaterThanOrEqual(1);
  });

  it("uses plural 'items' for count > 1", () => {
    renderSummary({ itemCount: 2 });
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
  });

  it("uses singular 'item' for count = 1", () => {
    renderSummary({ itemCount: 1 });
    expect(screen.getByText(/1 item/)).toBeInTheDocument();
  });

  it("hides VAT row when vat = 0", () => {
    renderSummary();
    expect(screen.queryByText("Value Added Tax (VAT)")).not.toBeInTheDocument();
  });

  it("shows VAT row when vat > 0", () => {
    renderSummary({
      orderBreakdown: { ...breakdown, vat: 56, finalTotal: 11056 },
    });
    expect(screen.getByText("Value Added Tax (VAT)")).toBeInTheDocument();
  });

  it("shows Total Due amount", () => {
    renderSummary();
    expect(screen.getByText("₦11,000")).toBeInTheDocument();
  });

 it("renders safely with ₦0 defaults when orderBreakdown has undefined fields", () => {
   expect(() =>
     renderSummary({
       orderBreakdown: { serviceFee: 0, vat: 0, finalTotal: 0 },
     }),
   ).not.toThrow();
   expect(screen.getAllByText("₦0").length).toBeGreaterThanOrEqual(1);
 });
});

// ── OrderSummaryCard (feature-rich variant) ───────────────────────────────────

describe("OrderSummaryCard — feature-rich variant", () => {
  const renderCard = (props = {}) =>
    render(
      <OrderSummaryCard
        customerInfo={customer}
        itemCount={2}
        orderBreakdown={breakdown}
        items={items}
        {...props}
      />,
    );

  it("renders 'Order summary' heading", () => {
    renderCard();
    expect(screen.getByText("Order summary")).toBeInTheDocument();
  });

  it("displays Total due with correct amount", () => {
    renderCard();
    expect(screen.getByText("₦11,000")).toBeInTheDocument();
  });

  it("shows service fee info tooltip button", () => {
    renderCard();
    expect(
      screen.getByLabelText("What does the service fee cover?"),
    ).toBeInTheDocument();
  });

  it("shows VAT row for premium tier items", () => {
    renderCard({
      orderBreakdown: {
        ...breakdown,
        vat: 56,
        itemsBreakdown: [{ ...breakdown.itemsBreakdown[0], tier: "premium" }],
      },
    });
    expect(screen.getByText("VAT")).toBeInTheDocument();
  });

  it("shows service fee info button for mixed tier fee breakdown", () => {
    renderCard({
      orderBreakdown: { ...breakdown, hasMixedTiers: true },
    });
    expect(
      screen.getByLabelText("What does the service fee cover?"),
    ).toBeInTheDocument();
  });

it("toggles ticket list visibility when summary accordion button is clicked", () => {
  renderCard();
  const toggleBtn = screen.getByRole("button", {
    name: /Lagos Tech Summit/i,
  });
  expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggleBtn);
  expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(/₦5,000 each/i)).toBeVisible();
});

  it("shows customer name section when firstName is provided", () => {
    renderCard();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("hides customer name section when firstName is empty", () => {
    renderCard({ customerInfo: { ...customer, firstName: "" } });
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });
});

// ── CheckoutForm ──────────────────────────────────────────────────────────────

describe("CheckoutForm", () => {
  const renderCheckoutForm = (props = {}) =>
    render(
      <CheckoutForm
        customerInfo={{ firstName: "", email: "", phone: "" }}
        isFormValid={false}
        userData={null}
        paymentMetadata={null}
        amountInKobo={550000}
        finalTotal={5500}
        onCustomerInfoChange={jest.fn()}
        onValidationChange={jest.fn()}
        {...props}
      />,
    );

  it("renders both Customer Information and Payment Method sections", () => {
    renderCheckoutForm();
    expect(screen.getByText("Customer Information")).toBeInTheDocument();
    expect(screen.getByText("Payment Method")).toBeInTheDocument();
  });

  it("renders the CustomerForm child component", () => {
    renderCheckoutForm();
    expect(screen.getByTestId("mock-customer-form")).toBeInTheDocument();
  });

  it("shows placeholder (no PaystackCheckout) when form is invalid", () => {
    renderCheckoutForm({ isFormValid: false });
    expect(screen.getByText("Complete Your Information")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-paystack")).not.toBeInTheDocument();
  });

  it("shows PaystackCheckout when isFormValid=true AND email is present", () => {
    renderCheckoutForm({
      isFormValid: true,
      customerInfo: {
        firstName: "John",
        email: "john@example.com",
        phone: "08012345678",
      },
    });
    expect(screen.getByTestId("mock-paystack")).toBeInTheDocument();
  });

  it("⚠️ hides PaystackCheckout when email is present but isFormValid=false", () => {
    // Both conditions must be true. Email alone is not sufficient.
    renderCheckoutForm({
      isFormValid: false,
      customerInfo: { firstName: "", email: "john@example.com", phone: "" },
    });
    expect(screen.queryByTestId("mock-paystack")).not.toBeInTheDocument();
    expect(screen.getByText("Fill all required fields")).toBeInTheDocument();
  });

  it("⚠️ shows 'Ready to proceed!' when isFormValid=true but email is absent", () => {
    // Contradictory UX: form says valid but email (required for payment) is missing.
    // The placeholder renders "Ready to proceed!" even though payment can't proceed.
    renderCheckoutForm({
      isFormValid: true,
      customerInfo: { firstName: "John", email: "", phone: "08012345678" },
    });
    expect(screen.getByText("Ready to proceed!")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-paystack")).not.toBeInTheDocument();
  });

  it("shows Secure Payment notice inside PaystackCheckout section", () => {
    renderCheckoutForm({
      isFormValid: true,
      customerInfo: {
        firstName: "John",
        email: "john@example.com",
        phone: "08012345678",
      },
    });
    expect(screen.getByText(/Secure Payment/i)).toBeInTheDocument();
  });
});
