/**
 * src/__tests__/subscriptionCard.test.js
 *
 * Tests for SubscriptionCard – the date-logic-heavy component that
 * drives isExpired / isExpiringSoon / Active display states.
 *
 * Strategy:
 *  - Fake timers anchor "now" to MOCK_NOW so daysUntilExpiry is deterministic.
 *  - Tests are deliberately ordered from null → expired → boundary → active
 *    to mirror production triage order.
 */

const React = require("react");
const { render, screen, fireEvent } = require("@testing-library/react");

const SubscriptionCard =
   require("../../components/dashboard/vendorComponents/vendorAnalytics/subscriptionCard")
     .default;

const {
  MOCK_NOW,
  makeSubscription,
  makeExpiredSubscription,
  makeExpiringSoonSubscription,
  makeExpiringOnBoundarySubscription,
  makeActiveBoundarySubscription,
  makeExpiringTodaySubscription,
} = require("@/__fixtures__/dashboardFixtures");

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

jest.mock("../../utils/navigation", () => ({ redirectTo: jest.fn() }));

const { redirectTo } = require("../../utils/navigation");

// ─────────────────────────────────────────────────────────────────
// window.location setup (component does href assignment on button click)
// ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(MOCK_NOW));
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────
// NULL / MISSING subscription
// ─────────────────────────────────────────────────────────────────

describe("SubscriptionCard – no subscription", () => {
  it("renders a fallback message when subscription is null", () => {
    render(<SubscriptionCard subscription={null} />);
    expect(screen.getByText("No active subscription")).toBeInTheDocument();
  });

  it("does NOT crash when subscription is undefined", () => {
    expect(() =>
      render(<SubscriptionCard subscription={undefined} />),
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────
// ACTIVE subscription (30 days left)
// ─────────────────────────────────────────────────────────────────

describe("SubscriptionCard – active state", () => {
  it("displays Active badge", () => {
    render(<SubscriptionCard subscription={makeSubscription()} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows tier name capitalised", () => {
    render(
      <SubscriptionCard subscription={makeSubscription({ tier: "premium" })} />,
    );
    expect(screen.getByText(/Premium Plan/i)).toBeInTheDocument();
  });

  it("shows price formatted in Naira (₦5,000 for 500 000 kobo)", () => {
    render(
      <SubscriptionCard subscription={makeSubscription({ price: 500000 })} />,
    );
    expect(screen.getByText(/₦5,000/)).toBeInTheDocument();
  });

  it("does NOT show a renewal button for a healthy active subscription", () => {
    render(<SubscriptionCard subscription={makeSubscription()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does NOT show the amber warning banner", () => {
    render(<SubscriptionCard subscription={makeSubscription()} />);
    expect(
      screen.queryByText(/Renew now to keep your premium features/i),
    ).not.toBeInTheDocument();
  });

  // ── 8-day boundary (just outside warning window) ────────────────
  it("shows Active badge when exactly 8 days remain (not expiring soon)", () => {
    render(
      <SubscriptionCard subscription={makeActiveBoundarySubscription()} />,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText("Expiring Soon")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// EXPIRING SOON  (≤ 7 days)
// ─────────────────────────────────────────────────────────────────

describe("SubscriptionCard – expiring soon state", () => {
  it("shows Expiring Soon badge when 5 days remain", () => {
    render(<SubscriptionCard subscription={makeExpiringSoonSubscription()} />);
    expect(screen.getByText("Expiring Soon")).toBeInTheDocument();
  });

  it("shows amber warning banner with day count", () => {
    render(<SubscriptionCard subscription={makeExpiringSoonSubscription()} />);
    // 5 days remain: "expires in 5 days"
    expect(
      screen.getByText(/Renew now to keep your premium features/i),
    ).toHaveTextContent(/expires in 5 days/i);
  });

  it("uses singular 'day' when exactly 1 day remains", () => {
    const sub = makeSubscription({ expiresAt: "2024-06-16T00:00:00.000Z" }); // 1 day
    render(<SubscriptionCard subscription={sub} />);
    expect(screen.getByText(/expires in 1 day\./i)).toBeInTheDocument();
  });

  it("shows Renew Now button when expiring soon", () => {
    render(<SubscriptionCard subscription={makeExpiringSoonSubscription()} />);
    expect(
      screen.getByRole("button", { name: /renew now/i }),
    ).toBeInTheDocument();
  });

  // ── 7-day boundary (exactly on the warning threshold) ───────────
  it("shows Expiring Soon badge when exactly 7 days remain (boundary inclusive)", () => {
    render(
      <SubscriptionCard subscription={makeExpiringOnBoundarySubscription()} />,
    );
    expect(screen.getByText("Expiring Soon")).toBeInTheDocument();
  });

  // ── Today expiry (0 days) – expiring but NOT yet expired ────────
  it("shows Expiring Soon (not Expired) when subscription expires today", () => {
    render(<SubscriptionCard subscription={makeExpiringTodaySubscription()} />);
    expect(screen.getByText("Expiring Soon")).toBeInTheDocument();
    expect(screen.queryByText("Expired")).not.toBeInTheDocument();
  });

  it("navigates to renewal page on Renew Now click", () => {
    render(<SubscriptionCard subscription={makeExpiringSoonSubscription()} />);
    fireEvent.click(screen.getByRole("button", { name: /renew now/i }));
    expect(redirectTo).toHaveBeenCalledWith("/dashboard/subscription/renew");
  });
});

// ─────────────────────────────────────────────────────────────────
// EXPIRED subscription
// ─────────────────────────────────────────────────────────────────

describe("SubscriptionCard – expired state", () => {
  it("shows Expired badge", () => {
    render(<SubscriptionCard subscription={makeExpiredSubscription()} />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("does NOT show Expiring Soon badge when already expired", () => {
    render(<SubscriptionCard subscription={makeExpiredSubscription()} />);
    expect(screen.queryByText("Expiring Soon")).not.toBeInTheDocument();
  });

  it("shows Reactivate Subscription button", () => {
    render(<SubscriptionCard subscription={makeExpiredSubscription()} />);
    expect(
      screen.getByRole("button", { name: /reactivate subscription/i }),
    ).toBeInTheDocument();
  });

  it("does NOT show the amber 'expires in X days' warning for expired subs", () => {
    render(<SubscriptionCard subscription={makeExpiredSubscription()} />);
    // isExpiringSoon && !isExpired guard hides the message
    expect(screen.queryByText(/expires in/i)).not.toBeInTheDocument();
  });

  it("navigates to renewal page on Reactivate click", () => {
    render(<SubscriptionCard subscription={makeExpiredSubscription()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /reactivate subscription/i }),
    );
    expect(redirectTo).toHaveBeenCalledWith("/dashboard/subscription/renew");
  });

  it("shows expiry distance text (e.g. '5 days ago') in the date row", () => {
    render(<SubscriptionCard subscription={makeExpiredSubscription()} />);
    // formatDistanceToNow adds "ago" suffix
    expect(screen.getByText(/ago/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// TIER NAME FORMATTING
// ─────────────────────────────────────────────────────────────────

describe("SubscriptionCard – tier formatting", () => {
  it.each([
    ["basic", "Basic Plan"],
    ["premium", "Premium Plan"],
    ["standard", "Standard Plan"],
  ])("capitalises '%s' tier correctly as '%s'", (tier, expected) => {
    render(<SubscriptionCard subscription={makeSubscription({ tier })} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
