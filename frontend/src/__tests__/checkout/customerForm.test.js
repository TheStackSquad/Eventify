/**
 * customerForm.test.js
 *
 * Tests: CustomerForm, SaveStatusIndicator, DraftRecoveryBanner
 *
 * ⚠️ Gaps exposed:
 *  - initialData prop is passed by both parent components (CheckoutPage,
 *    CheckoutForm) but CustomerForm never destructures or uses it.
 *    Logged-in user data never pre-fills the form.
 *  - setHasSavedDraft() is called inside useState's lazy initializer —
 *    a React anti-pattern that causes an extra synchronous render cycle.
 *    The correct fix is useEffect(() => { setHasSavedDraft(true) }, []).
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CustomerForm from "@/components/checkoutUI/customerForm";
import SaveStatusIndicator from "@/components/checkoutUI/saveStatusIndicator";
import DraftRecoveryBanner from "@/components/checkoutUI/draftRecoveryBanner";
import { useFormPersistence } from "@/utils/hooks/useFormPersistence";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("framer-motion", () => ({
  motion: {
    p: ({ children, ...p }) => <p {...p}>{children}</p>,
    div: ({ children, ...p }) => <div {...p}>{children}</div>,
    button: ({ children, ...p }) => <button {...p}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

jest.mock("@/utils/hooks/useFormPersistence", () => ({
  useFormPersistence: jest.fn(),
}));

// useDebounce is transitively used by useFormPersistence; mocking the hook
// above means we don't need to mock useDebounce separately.

const mockClearData = jest.fn();

beforeEach(() => {
  useFormPersistence.mockReturnValue({
    saveStatus: "idle",
    clearData: mockClearData,
  });
  sessionStorage.clear();
  jest.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderForm = (props = {}) => {
  const onCustomerInfoChange = jest.fn();
  const onValidationChange = jest.fn();
  const result = render(
    <CustomerForm
      onCustomerInfoChange={onCustomerInfoChange}
      onValidationChange={onValidationChange}
      {...props}
    />,
  );
  return { ...result, onCustomerInfoChange, onValidationChange };
};

const STORAGE_KEY = "checkout_customer_draft";
const DISMISSED_KEY = "checkout_draft_dismissed";

const validDraft = {
  firstName: "Emeka",
  lastName: "Obi",
  email: "emeka@example.com",
  phone: "08011111111",
  city: "Abuja",
  state: "FCT Abuja",
  country: "Nigeria",
};

// ── Rendering ─────────────────────────────────────────────────────────────────

describe("CustomerForm — rendering", () => {
  it("renders all required input fields with correct test IDs", () => {
    renderForm();
    [
      "input-firstName",
      "input-lastName",
      "input-email",
      "input-phone",
      "input-city",
      "select-state",
    ].forEach((id) => expect(screen.getByTestId(id)).toBeInTheDocument());
  });

  it("all fields start empty (no auto-fill)", () => {
    renderForm();
    expect(screen.getByTestId("input-firstName")).toHaveValue("");
    expect(screen.getByTestId("input-email")).toHaveValue("");
  });

  it("state dropdown contains Nigerian states", () => {
    renderForm();
    const select = screen.getByTestId("select-state");
    // 37 states + FCT + empty "Select State" option = 39
    expect(select.options.length).toBeGreaterThan(35);
  });
});

// ── ⚠️ initialData prop gap ───────────────────────────────────────────────────

describe("initialData prop — pre-fills returning user fields", () => {
  it("pre-fills firstName and email from initialData.user", () => {
    render(
      <CustomerForm
        onCustomerInfoChange={jest.fn()}
        onValidationChange={jest.fn()}
        initialData={{
          user: { firstName: "Jane", email: "jane@example.com" },
        }}
      />,
    );
    expect(screen.getByTestId("input-firstName")).toHaveValue("Jane");
    expect(screen.getByTestId("input-email")).toHaveValue("jane@example.com");
  });
});

// ── Validation callbacks ──────────────────────────────────────────────────────

describe("validation callbacks", () => {
  it("calls onValidationChange(false) on initial render (empty form is invalid)", () => {
    const { onValidationChange } = renderForm();
    expect(onValidationChange).toHaveBeenCalledWith(false);
  });

  it("calls onCustomerInfoChange with updated object on field input", () => {
    const { onCustomerInfoChange } = renderForm();
    fireEvent.change(screen.getByTestId("input-firstName"), {
      target: { value: "Ada" },
    });
    expect(onCustomerInfoChange).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Ada" }),
    );
  });

  it("onCustomerInfoChange always receives all fields, not just the changed one", () => {
    const { onCustomerInfoChange } = renderForm();
    fireEvent.change(screen.getByTestId("input-email"), {
      target: { value: "test@test.com" },
    });
    const lastCall =
      onCustomerInfoChange.mock.calls[
        onCustomerInfoChange.mock.calls.length - 1
      ][0];
    expect(lastCall).toHaveProperty("firstName");
    expect(lastCall).toHaveProperty("phone");
    expect(lastCall).toHaveProperty("country", "Nigeria"); // default preserved
  });
});

// ── Error display on blur ─────────────────────────────────────────────────────

describe("field error display", () => {
  it("does NOT show error before a field is touched", () => {
    renderForm();
    expect(
      screen.queryByText(/First Name is required/i),
    ).not.toBeInTheDocument();
  });

  it("shows required error after blurring empty firstName", async () => {
    renderForm();
    fireEvent.blur(screen.getByTestId("input-firstName"));
    await waitFor(() => {
      expect(screen.getByText(/First Name is required/i)).toBeInTheDocument();
    });
  });

  it("clears error once user types a valid value", async () => {
    renderForm();
    fireEvent.blur(screen.getByTestId("input-firstName"));
    await waitFor(() => screen.getByText(/First Name is required/i));
    fireEvent.change(screen.getByTestId("input-firstName"), {
      target: { value: "Ada" },
    });
    await waitFor(() => {
      expect(
        screen.queryByText(/First Name is required/i),
      ).not.toBeInTheDocument();
    });
  });
});

// ── Draft recovery ────────────────────────────────────────────────────────────

describe("draft recovery banner", () => {
  it("does NOT show banner when sessionStorage is empty", () => {
    renderForm();
    expect(screen.queryByText(/Resume Your Checkout/i)).not.toBeInTheDocument();
  });

  it("shows recovery banner when sessionStorage has meaningful draft data", async () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(validDraft));
    renderForm();
    await waitFor(() => {
      expect(screen.getByText(/Resume Your Checkout/i)).toBeInTheDocument();
    });
  });

  it("does NOT show banner when draft only contains default country value", () => {
    // hasData check: Object.values(parsed).some(val => val && val !== "Nigeria")
    // A draft with only { country: "Nigeria" } should NOT trigger the banner
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ country: "Nigeria" }));
    renderForm();
    expect(screen.queryByText(/Resume Your Checkout/i)).not.toBeInTheDocument();
  });

  it("does NOT show banner if user previously dismissed it (DISMISSED_KEY set)", () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(validDraft));
    sessionStorage.setItem(DISMISSED_KEY, "true");
    renderForm();
    expect(screen.queryByText(/Resume Your Checkout/i)).not.toBeInTheDocument();
  });

  it("restores draft into form fields on 'Restore My Info' click", async () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(validDraft));
    renderForm();
    await waitFor(() => screen.getByText(/Restore My Info/i));
    fireEvent.click(screen.getByText(/Restore My Info/i));
    await waitFor(() => {
      expect(screen.getByTestId("input-firstName")).toHaveValue("Emeka");
    });
  });

  it("dismisses banner and calls clearData on 'Start Fresh' click", async () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(validDraft));
    renderForm();
    await waitFor(() => screen.getByText(/Start Fresh/i));
    fireEvent.click(screen.getByText(/Start Fresh/i));
    await waitFor(() => {
      expect(
        screen.queryByText(/Resume Your Checkout/i),
      ).not.toBeInTheDocument();
    });
    expect(mockClearData).toHaveBeenCalled();
  });
});

// ── SaveStatusIndicator ───────────────────────────────────────────────────────

describe("SaveStatusIndicator", () => {
  it("renders nothing when status is 'idle'", () => {
    const { container } = render(<SaveStatusIndicator status="idle" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for unrecognised status", () => {
    const { container } = render(<SaveStatusIndicator status="unknown" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'Saving…' for saving status", () => {
    render(<SaveStatusIndicator status="saving" />);
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  it("shows 'Saved' for saved status", () => {
    render(<SaveStatusIndicator status="saved" />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("shows 'Couldn’t save' for error status", () => {
    render(<SaveStatusIndicator status="error" />);
    expect(screen.getByText("Couldn’t save")).toBeInTheDocument();
  });
});

// ── DraftRecoveryBanner ───────────────────────────────────────────────────────

describe("DraftRecoveryBanner", () => {
  it("renders restore and dismiss action buttons", () => {
    render(<DraftRecoveryBanner onRestore={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.getByText(/Restore My Info/i)).toBeInTheDocument();
    expect(screen.getByText(/Start Fresh/i)).toBeInTheDocument();
  });

  it("calls onRestore when 'Restore My Info' is clicked", () => {
    const onRestore = jest.fn();
    render(<DraftRecoveryBanner onRestore={onRestore} onDismiss={jest.fn()} />);
    fireEvent.click(screen.getByText(/Restore My Info/i));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when the X icon button is clicked", () => {
    const onDismiss = jest.fn();
    render(<DraftRecoveryBanner onRestore={jest.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when 'Start Fresh' is clicked", () => {
    const onDismiss = jest.fn();
    render(<DraftRecoveryBanner onRestore={jest.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText(/Start Fresh/i));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
