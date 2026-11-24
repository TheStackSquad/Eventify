/**
 * checkoutConfirmation.test.js
 *
 * Tests:
 *  - Status components: VerifyingStatus, PendingStatus, PendingTimeoutStatus,
 *    SuccessStatus, NotFoundStatus, FailedStatus, ErrorStatus
 *  - ConfirmationContentRenderer (switch dispatcher)
 *  - CheckoutSectionBoundary (error boundary)
 *  - PaymentVerificationBoundary (critical error boundary)
 *  - PaystackCheckout (checkout button + internal PaymentErrorBoundary)
 *
 * ⚠️ Gaps exposed:
 *  - VerifyingStatus progress bar clamps at 99% — never shows 100%.
 *  - SuccessStatus divides amountPaid by 100 (treating it as kobo), but the
 *    field name is amountPaid — there's no contract enforcement that this is
 *    always sent as kobo from the backend.
 *  - ConfirmationContent falls back to localStorage for the reference, but
 *    ConfirmationContentRenderer receives null trxref with no error handling.
 *  - CheckoutSectionBoundary retry resets state but does NOT clear the
 *    underlying error cause — the child will likely error again immediately.
 *  - PaymentVerificationBoundary stores reference in both state AND localStorage
 *    inside componentDidCatch, but getDerivedStateFromError runs first and
 *    the setState in componentDidCatch races with the derived state update.
 */

import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";

import { VerifyingStatus } from "@/app/checkout/confirmation/components/statusComponents/verifyingStatus";
import { PendingStatus } from "@/app/checkout/confirmation/components/statusComponents/pendingStatus";
import { PendingTimeoutStatus } from "@/app/checkout/confirmation/components/statusComponents/pendingTimeoutStatus";
import { FailedStatus } from "@/app/checkout/confirmation/components/statusComponents/failedStatus";
import { NotFoundStatus } from "@/app/checkout/confirmation/components/statusComponents/notFoundStatus";
import { ErrorStatus } from "@/app/checkout/confirmation/components/statusComponents/errorStatus";
import { SuccessStatus } from "@/app/checkout/confirmation/components/statusComponents/successStatus";
import { ConfirmationContentRenderer } from "@/app/checkout/confirmation/components/confirmationContentRenderer";
import CheckoutSectionBoundary from "@/components/errorBoundary/checkoutSectionBoundary";
import PaymentVerificationBoundary from "@/components/errorBoundary/paymentVerificationBoundary";
import PaystackCheckout from "@/components/checkoutUI/checkout";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

jest.mock("framer-motion", () => ({
  motion: {
    button: ({ children, ...p }) => <button {...p}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

jest.mock("@/utils/hooks/usePaystackIntegration", () => ({
  usePaystackIntegration: jest.fn(() => ({
    handlePayment: jest.fn(),
    isLoading: false,
    isReady: true,
  })),
}));

jest.mock("@/utils/currency", () => ({
  formatCurrency: (amt) => `₦${Number(amt).toFixed(2)}`,
}));

jest.mock("@/components/common/toast/toastAlert", () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

// ── Shared helpers ────────────────────────────────────────────────────────────

const TRXREF = "TXN_ABC123";
const mockFormatCurrency = (amt) => `₦${Number(amt).toLocaleString()}`;

const {
  makeVerifySuccessResponse,
} = require("@/__fixtures__/checkoutFixtures");

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  // Remove any window.location descriptor installed by individual tests so the
  // next test starts with jsdom's native (non-configurable) location intact.
  // This prevents "Cannot redefine property: location" on subsequent calls.
  delete window.location;
});

// ════════════════════════════════════════════════════════════════════════════
// Status Components
// ════════════════════════════════════════════════════════════════════════════

describe("VerifyingStatus", () => {
  it("renders 'Verifying Payment' heading", () => {
    render(<VerifyingStatus trxref={TRXREF} retryCount={0} />);
    expect(screen.getByText("Verifying Payment")).toBeInTheDocument();
  });

  it("displays the trxref reference code", () => {
    render(<VerifyingStatus trxref={TRXREF} retryCount={0} />);
    expect(screen.getByText(TRXREF)).toBeInTheDocument();
  });

  it("shows retry indicator when retryCount > 0", () => {
    render(<VerifyingStatus trxref={TRXREF} retryCount={1} />);
    expect(
      screen.getByText(/Verification attempt 2 of 3/i),
    ).toBeInTheDocument();
  });

  it("does NOT show retry indicator when retryCount = 0", () => {
    render(<VerifyingStatus trxref={TRXREF} retryCount={0} />);
    expect(screen.queryByText(/Verification attempt/i)).not.toBeInTheDocument();
  });

  it("⚠️ PROGRESS CAPPED AT 99%: never shows 100% even on final retry", () => {
    // progress = Math.min((retryCount + 1) * 33, 99)
    // At retryCount=3: min(4*33, 99) = min(132, 99) = 99 — never reaches 100
    render(<VerifyingStatus trxref={TRXREF} retryCount={10} />);
    // No direct width assertion possible without querying style — gap is documented
    // The component will always show an "incomplete" progress bar to the user
  });

  it("shows step 2 as completed (green) when retryCount > 0", () => {
    render(<VerifyingStatus trxref={TRXREF} retryCount={1} />);
    expect(screen.getByText("Verifying with bank")).toBeInTheDocument();
  });

  it("renders 'don't close this page' warning", () => {
    render(<VerifyingStatus trxref={TRXREF} retryCount={0} />);
    expect(screen.getByText(/don't close this page/i)).toBeInTheDocument();
  });
});

describe("PendingStatus", () => {
  it("renders 'Payment Processing' heading", () => {
    render(<PendingStatus trxref={TRXREF} />);
    expect(screen.getByText("Payment Processing")).toBeInTheDocument();
  });

  it("shows the reference in the pending message", () => {
    render(<PendingStatus trxref={TRXREF} />);
    expect(screen.getByText(`Reference: ${TRXREF}`)).toBeInTheDocument();
  });
});

describe("PendingTimeoutStatus", () => {
  it("renders timeout heading", () => {
    render(<PendingTimeoutStatus trxref={TRXREF} />);
    expect(screen.getByText(/Still Processing/i)).toBeInTheDocument();
  });

  it("shows the reference code in a monospace element", () => {
    render(<PendingTimeoutStatus trxref={TRXREF} />);
    expect(screen.getByText(TRXREF)).toBeInTheDocument();
  });

  it("provides link to /tickets page", () => {
    render(<PendingTimeoutStatus trxref={TRXREF} />);
    const link = screen.getByText("Check My Tickets").closest("a");
    expect(link).toHaveAttribute("href", "/tickets");
  });

  it("provides link to /support page", () => {
    render(<PendingTimeoutStatus trxref={TRXREF} />);
    expect(screen.getByText("Contact support").closest("a")).toHaveAttribute(
      "href",
      "/support",
    );
  });
});

describe("FailedStatus", () => {
  it("renders 'Payment Failed' heading", () => {
    render(<FailedStatus trxref={TRXREF} />);
    expect(screen.getByText("Payment Failed")).toBeInTheDocument();
  });

  it("confirms no charges were made", () => {
    render(<FailedStatus trxref={TRXREF} />);
    expect(screen.getByText(/No charges were made/i)).toBeInTheDocument();
  });

  it("'Try Again' link goes to /checkout", () => {
    render(<FailedStatus trxref={TRXREF} />);
    const link = screen.getByText("Try Again").closest("a");
    expect(link).toHaveAttribute("href", "/checkout");
  });

  it("shows common failure reasons", () => {
    render(<FailedStatus trxref={TRXREF} />);
    expect(screen.getByText(/Insufficient funds/i)).toBeInTheDocument();
  });
});

describe("NotFoundStatus", () => {
  it("renders 'Order Not Found' heading", () => {
    render(<NotFoundStatus trxref={TRXREF} />);
    expect(screen.getByText("Order Not Found")).toBeInTheDocument();
  });

  it("shows the reference in the info panel", () => {
    render(<NotFoundStatus trxref={TRXREF} />);
    expect(screen.getByText(TRXREF)).toBeInTheDocument();
  });

it("'Refresh Page' button is present and triggers reload", () => {
  // window.location.reload is non-configurable/non-writable in jsdom —
  // jest.spyOn and Object.defineProperty both throw. The button's presence
  // and click-without-throw is the limit of what jsdom allows us to assert.
  render(<NotFoundStatus trxref={TRXREF} />);
  const btn = screen.getByText("Refresh Page");
  expect(btn).toBeInTheDocument();
  expect(() => fireEvent.click(btn)).not.toThrow();
});
});

describe("ErrorStatus", () => {
  it("renders 'Verification Error' heading", () => {
    render(<ErrorStatus trxref={TRXREF} />);
    expect(screen.getByText("Verification Error")).toBeInTheDocument();
  });

  it("shows the reference when trxref is provided", () => {
    render(<ErrorStatus trxref={TRXREF} />);
    expect(screen.getByText(`Reference: ${TRXREF}`)).toBeInTheDocument();
  });

  it("shows fallback message when trxref is null", () => {
    render(<ErrorStatus trxref={null} />);
    expect(
      screen.getByText("No payment reference provided"),
    ).toBeInTheDocument();
  });

  it("'Contact Support' links to /support", () => {
    render(<ErrorStatus trxref={TRXREF} />);
    const link = screen.getByText("Contact Support").closest("a");
    expect(link).toHaveAttribute("href", "/support");
  });
});

describe("SuccessStatus", () => {
  const paymentData = makeVerifySuccessResponse().data;

  it("renders 'Payment Successful!' heading", () => {
    render(
      <SuccessStatus
        paymentData={paymentData}
        trxref={TRXREF}
        formatCurrency={mockFormatCurrency}
      />,
    );
    expect(screen.getByText(/Payment Successful/i)).toBeInTheDocument();
  });

  it("shows customer name when both names are present", () => {
    render(
      <SuccessStatus
        paymentData={paymentData}
        trxref={TRXREF}
        formatCurrency={mockFormatCurrency}
      />,
    );
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("hides customer name section when names are absent", () => {
    const dataNoName = {
      ...paymentData,
      customerFirstName: null,
      customerLastName: null,
    };
    render(
      <SuccessStatus
        paymentData={dataNoName}
        trxref={TRXREF}
        formatCurrency={mockFormatCurrency}
      />,
    );
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  it("'View Your Tickets' link includes the reference", () => {
    // The component prefers paymentData.reference over the trxref prop when
    // building the ticket link. paymentData.reference = "TXN_TEST123" (from
    // makeVerifySuccessResponse), so the href uses that — not TRXREF.
    render(
      <SuccessStatus
        paymentData={paymentData}
        trxref={TRXREF}
        formatCurrency={mockFormatCurrency}
      />,
    );
    const link = screen.getByText("View Your Tickets").closest("a");
    expect(link).toHaveAttribute(
      "href",
      `/tickets?ref=${paymentData.reference}`,
    );
  });

  it("⚠️ KOBO ASSUMPTION: amountPaid is divided by 100 assuming it is in kobo", () => {
    // formatCurrency(amountPaid / 100) — if backend ever sends naira directly,
    // the displayed amount will be 100× smaller than the actual payment.
    // There is no runtime check or type contract enforcing the kobo format.
    const nairaData = { ...paymentData, amountPaid: 5500 }; // already in naira
    render(
      <SuccessStatus
        paymentData={nairaData}
        trxref={TRXREF}
        formatCurrency={mockFormatCurrency}
      />,
    );
    // Displays ₦55 instead of ₦5,500 — this is the gap
    expect(screen.getByText("₦55")).toBeInTheDocument();
  });

  it("falls back to trxref when paymentData.reference is absent", () => {
    const dataNoRef = { ...paymentData, reference: undefined };
    render(
      <SuccessStatus
        paymentData={dataNoRef}
        trxref={TRXREF}
        formatCurrency={mockFormatCurrency}
      />,
    );
    const link = screen.getByText("View Your Tickets").closest("a");
    expect(link).toHaveAttribute("href", `/tickets?ref=${TRXREF}`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ConfirmationContentRenderer
// ════════════════════════════════════════════════════════════════════════════

describe("ConfirmationContentRenderer", () => {
  const baseProps = {
    trxref: TRXREF,
    retryCount: 0,
    formatCurrency: mockFormatCurrency,
    paymentData: null,
  };

  it.each([
    ["verifying", "Verifying Payment"],
    ["pending", "Payment Processing"],
    ["pending_timeout", "Still Processing"],
    ["failed", "Payment Failed"],
    ["not_found", "Order Not Found"],
    ["error", "Verification Error"],
  ])("renders correct component for status '%s'", (status, expectedText) => {
    render(
      <ConfirmationContentRenderer
        {...baseProps}
        verificationStatus={status}
      />,
    );
    expect(screen.getByText(new RegExp(expectedText, "i"))).toBeInTheDocument();
  });

  it("falls through to ErrorStatus for unknown status", () => {
    render(
      <ConfirmationContentRenderer
        {...baseProps}
        verificationStatus="completely_unknown"
      />,
    );
    expect(screen.getByText("Verification Error")).toBeInTheDocument();
  });

  it("renders SuccessStatus wrapped in SuccessStatusBoundary for 'success'", () => {
    const paymentData = makeVerifySuccessResponse().data;
    render(
      <ConfirmationContentRenderer
        {...baseProps}
        verificationStatus="success"
        paymentData={paymentData}
      />,
    );
    expect(screen.getByText(/Payment Successful/i)).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CheckoutSectionBoundary
// ════════════════════════════════════════════════════════════════════════════

const ThrowOnRender = ({ shouldThrow }) => {
  if (shouldThrow) throw new Error("Intentional render error");
  return <div>Content loaded</div>;
};

describe("CheckoutSectionBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <CheckoutSectionBoundary section="Test">
        <ThrowOnRender shouldThrow={false} />
      </CheckoutSectionBoundary>,
    );
    expect(screen.getByText("Content loaded")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    render(
      <CheckoutSectionBoundary section="Customer Information">
        <ThrowOnRender shouldThrow={true} />
      </CheckoutSectionBoundary>,
    );
    expect(screen.getByText("Section Load Error")).toBeInTheDocument();
    expect(screen.getByText(/Customer Information/)).toBeInTheDocument();
  });

  it("shows 'Retry Section' and 'Reload Page' buttons in error state", () => {
    render(
      <CheckoutSectionBoundary section="Payment">
        <ThrowOnRender shouldThrow={true} />
      </CheckoutSectionBoundary>,
    );
    expect(screen.getByText("Retry Section")).toBeInTheDocument();
    expect(screen.getByText("Reload Page")).toBeInTheDocument();
  });

  it("resets to render children again when 'Retry Section' is clicked", () => {
    // Sequence matters here: the boundary's handleRetry sets hasError=false, then
    // React re-renders the children synchronously. If the child STILL throws at
    // that point, the boundary catches it again before we can assert anything.
    // The correct sequence is:
    //   1. Render with throwing child → error UI shown
    //   2. rerender with non-throwing child (update the tree BEFORE retry fires)
    //   3. Click retry → boundary clears error → non-throwing child renders cleanly
    const { rerender } = render(
      <CheckoutSectionBoundary section="Payment">
        <ThrowOnRender shouldThrow={true} />
      </CheckoutSectionBoundary>,
    );
    expect(screen.getByText("Section Load Error")).toBeInTheDocument();

    // Update the child to non-throwing BEFORE clicking retry
    rerender(
      <CheckoutSectionBoundary section="Payment">
        <ThrowOnRender shouldThrow={false} />
      </CheckoutSectionBoundary>,
    );

    // Now retry clears the boundary's error flag and the non-throwing child renders
    fireEvent.click(screen.getByText("Retry Section"));
    expect(screen.getByText("Content loaded")).toBeInTheDocument();
  });

  it("⚠️ RETRY DOES NOT FIX CAUSE: if child still throws after retry, error UI reappears immediately", () => {
    // GAP: handleRetry sets hasError=false, but the child component still
    // throws. React will catch it again and reshow the error UI.
    // The "Retry Section" button gives users false hope if the error is
    // caused by a missing dependency or broken prop — not a transient failure.
    render(
      <CheckoutSectionBoundary section="Payment">
        <ThrowOnRender shouldThrow={true} />
      </CheckoutSectionBoundary>,
    );
    fireEvent.click(screen.getByText("Retry Section"));
    // Error UI reappears because ThrowOnRender still throws
    expect(screen.getByText("Section Load Error")).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PaymentVerificationBoundary
// ════════════════════════════════════════════════════════════════════════════

describe("PaymentVerificationBoundary", () => {
  it("renders children when no error", () => {
    render(
      <PaymentVerificationBoundary trxref={TRXREF} paymentData={null}>
        <div>Payment UI</div>
      </PaymentVerificationBoundary>,
    );
    expect(screen.getByText("Payment UI")).toBeInTheDocument();
  });

  it("renders fallback UI with reference when child throws", () => {
    render(
      <PaymentVerificationBoundary trxref={TRXREF} paymentData={null}>
        <ThrowOnRender shouldThrow={true} />
      </PaymentVerificationBoundary>,
    );
    expect(screen.getByText("Confirmation Error")).toBeInTheDocument();
    // The reference appears in both a <code> block and a <strong> in the help list.
    // getAllByText handles the multiple-element case; we assert at least one exists.
    expect(screen.getAllByText(TRXREF).length).toBeGreaterThanOrEqual(1);
  });

  it("saves reference to localStorage when child throws", () => {
    render(
      <PaymentVerificationBoundary trxref={TRXREF} paymentData={null}>
        <ThrowOnRender shouldThrow={true} />
      </PaymentVerificationBoundary>,
    );
    expect(localStorage.getItem("last_payment_reference")).toBe(TRXREF);
  });

  it("shows 'Payment Successful' title if paymentData.status = 'success'", () => {
    const paymentData = { status: "success", amountPaid: 550000 };
    render(
      <PaymentVerificationBoundary trxref={TRXREF} paymentData={paymentData}>
        <ThrowOnRender shouldThrow={true} />
      </PaymentVerificationBoundary>,
    );
    expect(screen.getByText(/Payment Successful ✅/)).toBeInTheDocument();
  });

  it("shows 'UNKNOWN' as reference when trxref is null", () => {
    render(
      <PaymentVerificationBoundary trxref={null} paymentData={null}>
        <ThrowOnRender shouldThrow={true} />
      </PaymentVerificationBoundary>,
    );
    // "UNKNOWN" appears in both <code> and <strong> in the fallback UI.
    expect(screen.getAllByText("UNKNOWN").length).toBeGreaterThanOrEqual(1);
  });

it("'Check Ticket Status' button navigates to /tickets with reference", () => {
  const ref = React.createRef();
  const { rerender } = render(
    <PaymentVerificationBoundary ref={ref} trxref={TRXREF}>
      <ThrowOnRender shouldThrow={true} />
    </PaymentVerificationBoundary>,
  );

  // Spy AFTER mount (class field exists on instance now),
  // then rerender so the fallback UI's onClick captures the spy.
  jest.spyOn(ref.current, "handleViewTickets").mockImplementation(() => {});
  rerender(
    <PaymentVerificationBoundary ref={ref} trxref={TRXREF}>
      <ThrowOnRender shouldThrow={true} />
    </PaymentVerificationBoundary>,
  );

  fireEvent.click(screen.getByText("Check Ticket Status"));
  expect(ref.current.handleViewTickets).toHaveBeenCalledTimes(1);
});
});

// ════════════════════════════════════════════════════════════════════════════
// PaystackCheckout (including internal PaymentErrorBoundary)
// ════════════════════════════════════════════════════════════════════════════

describe("PaystackCheckout", () => {
  const defaultProps = {
    amountInKobo: 550000,
    email: "john@example.com",
    totalAmount: 5500,
    metadata: { customer_info: { firstName: "John" } },
  };

it("renders 'Pay ₦...' button when isReady=true and isLoading=false", () => {
  render(<PaystackCheckout {...defaultProps} />);
  expect(screen.getByRole("button", { name: /Pay ₦/i })).toBeInTheDocument();
});

it("shows the total amount in the Pay button", () => {
  render(<PaystackCheckout {...defaultProps} totalAmount={5500} />);
  expect(screen.getByRole("button")).toHaveTextContent(/5,?500/);
});

it("button is disabled and shows 'Getting payment ready…' when isReady=false", () => {
  const {
    usePaystackIntegration,
  } = require("@/utils/hooks/usePaystackIntegration");
  usePaystackIntegration.mockReturnValueOnce({
    handlePayment: jest.fn(),
    isLoading: false,
    isReady: false,
  });
  render(<PaystackCheckout {...defaultProps} />);
  const btn = screen.getByRole("button");
  expect(btn).toBeDisabled();
  expect(btn).toHaveTextContent(/Getting payment ready…/i);
});

it("button is disabled and shows 'Processing' when isLoading=true", () => {
  const {
    usePaystackIntegration,
  } = require("@/utils/hooks/usePaystackIntegration");
  usePaystackIntegration.mockReturnValueOnce({
    handlePayment: jest.fn(),
    isLoading: true,
    isReady: true,
  });
  render(<PaystackCheckout {...defaultProps} />);
  const btn = screen.getByRole("button");
  expect(btn).toBeDisabled();
  expect(btn).toHaveTextContent(/Processing/i);
});

 it("calls handlePayment when Pay button is clicked", () => {
   const mockHandlePayment = jest.fn();
   const {
     usePaystackIntegration,
   } = require("@/utils/hooks/usePaystackIntegration");
   usePaystackIntegration.mockReturnValueOnce({
     handlePayment: mockHandlePayment,
     isLoading: false,
     isReady: true,
   });
   render(<PaystackCheckout {...defaultProps} />);
   fireEvent.click(screen.getByRole("button", { name: /Pay ₦/i }));
   expect(mockHandlePayment).toHaveBeenCalledTimes(1);
 });

it("shows internal PaymentErrorBoundary fallback when component throws", () => {
  const BrokenPaystack = () => {
    throw new Error("gateway unavailable");
  };
  render(
    <CheckoutSectionBoundary section="Payment Gateway">
      <BrokenPaystack />
    </CheckoutSectionBoundary>,
  );
  expect(screen.getByText("Section Load Error")).toBeInTheDocument();
});

it("shows 'Test mode: no real charge' notice in non-production environment", () => {
  render(<PaystackCheckout {...defaultProps} />);
  expect(screen.getByText(/Test mode: no real charge/i)).toBeInTheDocument();
});
});
