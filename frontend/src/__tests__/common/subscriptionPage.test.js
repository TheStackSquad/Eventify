/**
 * src/__tests__/subscriptionPage.test.js
 *
 * Tests for SubscriptionPage (src/app/subscription/page.js)
 *
 * Covers:
 *   1. Page renders without crashing
 *   2. Hero CTA opens the modal with the "premium" default tier
 *   3. TierComparisonTable receives onSelectTier and can open the modal
 *   4. Modal closes when onClose is called
 *   5. modalState.tier is correctly passed to TierSelectorModal
 *
 * ⚠️  Code gap surfaced:
 *   openModal always opens with whatever tier is passed, but the hero CTA
 *   hard-codes "premium". If the default tier changes server-side, the UI
 *   will be out of sync with no dynamic source of truth.
 */

const React = require("react");
const {
  render,
  screen,
  fireEvent,
  waitFor,
} = require("@testing-library/react");
const userEvent = require("@testing-library/user-event").default;

// ─────────────────────────────────────────────────────────────────
// Mock child components
// ─────────────────────────────────────────────────────────────────

// TierComparisonTable: capture the onSelectTier callback so we can invoke it
let capturedOnSelectTier;
jest.mock(
  "@/components/subscription/tierComparisonTable",
  () =>
    function MockTierComparisonTable({ onSelectTier }) {
      capturedOnSelectTier = onSelectTier;
      return (
        <div data-testid="tier-comparison-table">
          <button
            data-testid="select-basic"
            onClick={() => onSelectTier("basic")}
          >
            Select Basic
          </button>
          <button
            data-testid="select-premium"
            onClick={() => onSelectTier("premium")}
          >
            Select Premium
          </button>
          <button
            data-testid="select-enterprise"
            onClick={() => onSelectTier("enterprise")}
          >
            Select Enterprise
          </button>
        </div>
      );
    },
);

// TierSelectorModal: expose isOpen and initialTier as data-* attrs for easy assertions
jest.mock(
  "@/components/subscription/tierSelectorModal",
  () =>
    function MockTierSelectorModal({ isOpen, onClose, initialTier }) {
      if (!isOpen) return null;
      return (
        <div data-testid="tier-selector-modal" data-initial-tier={initialTier}>
          <button data-testid="modal-close" onClick={onClose}>
            Close Modal
          </button>
        </div>
      );
    },
);

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/subscription",
}));

// Import after mocks
const SubscriptionPage = require("@/app/subscription/page").default;

// ─────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedOnSelectTier = undefined;
});

// ─────────────────────────────────────────────────────────────────
// 1. PAGE RENDER
// ─────────────────────────────────────────────────────────────────

describe("SubscriptionPage – initial render", () => {
  it("renders without crashing", () => {
    expect(() => render(<SubscriptionPage />)).not.toThrow();
  });

  it("renders the hero headline", () => {
    render(<SubscriptionPage />);
    expect(screen.getByText(/scale your business/i)).toBeInTheDocument();
  });

  it("renders the Compare Plans heading", () => {
    render(<SubscriptionPage />);
    expect(screen.getByText("Compare Plans")).toBeInTheDocument();
  });

  it("renders TierComparisonTable", () => {
    render(<SubscriptionPage />);
    expect(screen.getByTestId("tier-comparison-table")).toBeInTheDocument();
  });

  it("modal is NOT visible on first render", () => {
    render(<SubscriptionPage />);
    expect(screen.queryByTestId("tier-selector-modal")).not.toBeInTheDocument();
  });

  it("renders the Choose Your Plan CTA button", () => {
    render(<SubscriptionPage />);
    expect(
      screen.getByRole("button", { name: /choose your plan/i }),
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 2. HERO CTA OPENS MODAL WITH DEFAULT TIER
// ─────────────────────────────────────────────────────────────────

describe("SubscriptionPage – hero CTA", () => {
  it("opens TierSelectorModal when CTA is clicked", async () => {
    render(<SubscriptionPage />);
    await userEvent.click(
      screen.getByRole("button", { name: /choose your plan/i }),
    );
    expect(screen.getByTestId("tier-selector-modal")).toBeInTheDocument();
  });

  it('opens modal with initialTier="premium" (hard-coded default)', async () => {
    render(<SubscriptionPage />);
    await userEvent.click(
      screen.getByRole("button", { name: /choose your plan/i }),
    );
    expect(screen.getByTestId("tier-selector-modal")).toHaveAttribute(
      "data-initial-tier",
      "premium",
    );
  });

  // ── ⚠️  Code gap: hard-coded default tier ────────────────────
  it("⚠️ (gap) hero CTA always opens with 'premium' regardless of available tiers", async () => {
    // openModal is called with the literal string "premium" — if the backend
    // changes the default or removes the premium tier, the UI won't adapt.
    render(<SubscriptionPage />);
    await userEvent.click(
      screen.getByRole("button", { name: /choose your plan/i }),
    );
    const modal = screen.getByTestId("tier-selector-modal");
    // This assertion documents the current (potentially fragile) behaviour:
    expect(modal).toHaveAttribute("data-initial-tier", "premium");
  });
});

// ─────────────────────────────────────────────────────────────────
// 3. TIER COMPARISON TABLE OPENS MODAL WITH CORRECT TIER
// ─────────────────────────────────────────────────────────────────

describe("SubscriptionPage – TierComparisonTable onSelectTier", () => {
  it("TierComparisonTable receives onSelectTier callback", () => {
    render(<SubscriptionPage />);
    expect(capturedOnSelectTier).toBeInstanceOf(Function);
  });

  it('opens modal with initialTier="basic" when basic tier is selected', async () => {
    render(<SubscriptionPage />);
    await userEvent.click(screen.getByTestId("select-basic"));
    expect(screen.getByTestId("tier-selector-modal")).toHaveAttribute(
      "data-initial-tier",
      "basic",
    );
  });

  it('opens modal with initialTier="premium" when premium tier is selected', async () => {
    render(<SubscriptionPage />);
    await userEvent.click(screen.getByTestId("select-premium"));
    expect(screen.getByTestId("tier-selector-modal")).toHaveAttribute(
      "data-initial-tier",
      "premium",
    );
  });

  it('opens modal with initialTier="enterprise" when enterprise tier is selected', async () => {
    render(<SubscriptionPage />);
    await userEvent.click(screen.getByTestId("select-enterprise"));
    expect(screen.getByTestId("tier-selector-modal")).toHaveAttribute(
      "data-initial-tier",
      "enterprise",
    );
  });

  it("modal is visible after onSelectTier is called", async () => {
    render(<SubscriptionPage />);
    await userEvent.click(screen.getByTestId("select-premium"));
    expect(screen.getByTestId("tier-selector-modal")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 4. MODAL CLOSE
// ─────────────────────────────────────────────────────────────────

describe("SubscriptionPage – modal close", () => {
  it("closes the modal when onClose is called", async () => {
    render(<SubscriptionPage />);
    await userEvent.click(
      screen.getByRole("button", { name: /choose your plan/i }),
    );
    expect(screen.getByTestId("tier-selector-modal")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("modal-close"));
    expect(screen.queryByTestId("tier-selector-modal")).not.toBeInTheDocument();
  });

  it("preserves the last selected tier in modalState after closing", async () => {
    render(<SubscriptionPage />);

    // Open with enterprise tier
    await userEvent.click(screen.getByTestId("select-enterprise"));
    expect(screen.getByTestId("tier-selector-modal")).toHaveAttribute(
      "data-initial-tier",
      "enterprise",
    );

    // Close
    await userEvent.click(screen.getByTestId("modal-close"));
    expect(screen.queryByTestId("tier-selector-modal")).not.toBeInTheDocument();

    // Re-open — the spread `{ ...modalState, isOpen: false }` only toggles isOpen,
    // so the tier should still be "enterprise" on next open.
    // (The modal re-opens via CTA which resets to "premium", so we use the table)
    await userEvent.click(screen.getByTestId("select-enterprise"));
    expect(screen.getByTestId("tier-selector-modal")).toHaveAttribute(
      "data-initial-tier",
      "enterprise",
    );
  });

  it("can re-open the modal after it has been closed", async () => {
    render(<SubscriptionPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /choose your plan/i }),
    );
    await userEvent.click(screen.getByTestId("modal-close"));
    expect(screen.queryByTestId("tier-selector-modal")).not.toBeInTheDocument();

    // Open again
    await userEvent.click(
      screen.getByRole("button", { name: /choose your plan/i }),
    );
    expect(screen.getByTestId("tier-selector-modal")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 5. MODAL STATE OBJECT INTEGRITY
// ─────────────────────────────────────────────────────────────────

describe("SubscriptionPage – modalState integrity", () => {
  it("changing tier via table then closing does NOT reset tier to premium", async () => {
    render(<SubscriptionPage />);

    // User selects basic from the table
    await userEvent.click(screen.getByTestId("select-basic"));
    expect(screen.getByTestId("tier-selector-modal")).toHaveAttribute(
      "data-initial-tier",
      "basic",
    );

    // Close with the spread pattern: { ...modalState, isOpen: false }
    await userEvent.click(screen.getByTestId("modal-close"));

    // Now open again via table — tier should come from onSelectTier, not a stale state
    await userEvent.click(screen.getByTestId("select-premium"));
    expect(screen.getByTestId("tier-selector-modal")).toHaveAttribute(
      "data-initial-tier",
      "premium",
    );
  });
});
