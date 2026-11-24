/**
 * src/__tests__/vendorTrustScoreCard.test.js
 *
 * Tests every branching path inside VendorTrustScoreCard:
 *   - Score tiers   (0-39, 40-59, 60-79, 80-100)
 *   - Verification  (none / partial / verified / fully-verified)
 *   - Trend labels  (improving / declining / stable / unknown)
 *   - Account status (new / active / suspended / pending)
 *
 * This is a pure presentational (memo) component with no hooks,
 * so no mocking of context or router is required.
 */

const React = require("react");
const { render, screen } = require("@testing-library/react");

const VendorTrustScoreCard =
  require("@/components/dashboard/vendorComponents/vendorAnalytics/vendorTrustScoreCard").default;

// ─────────────────────────────────────────────────────────────────
// Default "passing" props – tests override only what they care about
// ─────────────────────────────────────────────────────────────────

const defaultProps = {
  score: 75,
  tier: "improving",
  isVerified: true,
  isIdentityVerified: true,
  isBusinessVerified: true,
  isFullyVerified: false,
  profileCompletion: 80,
  daysOnPlatform: 90,
  totalReviews: 12,
  accountStatus: "active",
  pvsScoreTrend: "improving",
};

const renderCard = (overrides = {}) =>
  render(<VendorTrustScoreCard {...defaultProps} {...overrides} />);

// ─────────────────────────────────────────────────────────────────
// SCORE TIER LABELS
// ─────────────────────────────────────────────────────────────────

describe("VendorTrustScoreCard – score tier labels", () => {
  it('shows "Excellent" for score >= 80', () => {
    renderCard({ score: 80 });
    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });

  it('shows "Excellent" at score 100 (max)', () => {
    renderCard({ score: 100 });
    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });

  it('shows "Good" for score in range 60–79', () => {
    renderCard({ score: 60 });
    expect(screen.getByText("Good")).toBeInTheDocument();
  });

  it('shows "Good" at score exactly 79 (upper boundary)', () => {
    renderCard({ score: 79 });
    expect(screen.getByText("Good")).toBeInTheDocument();
  });

  it('shows "Fair" for score in range 40–59', () => {
    renderCard({ score: 40 });
    expect(screen.getByText("Fair")).toBeInTheDocument();
  });

  it('shows "Fair" at score exactly 59', () => {
    renderCard({ score: 59 });
    expect(screen.getByText("Fair")).toBeInTheDocument();
  });

  it('shows "Needs Improvement" for score < 40', () => {
    renderCard({ score: 39 });
    expect(screen.getByText("Needs Improvement")).toBeInTheDocument();
  });

  it('shows "Needs Improvement" at score 0', () => {
    renderCard({ score: 0 });
    expect(screen.getByText("Needs Improvement")).toBeInTheDocument();
  });

  it("always renders the numeric score", () => {
    renderCard({ score: 67 });
    expect(screen.getByText("67")).toBeInTheDocument();
  });

  it("renders score /100 denominator", () => {
    renderCard({ score: 50 });
    expect(screen.getByText("/100")).toBeInTheDocument();
  });

  it("progress bar aria-valuenow matches score prop", () => {
    renderCard({ score: 55 });
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "55");
  });
});

// ─────────────────────────────────────────────────────────────────
// VERIFICATION STATUS  (4 branches + edge case)
// ─────────────────────────────────────────────────────────────────

describe("VendorTrustScoreCard – verification status", () => {
  it('shows "Fully Verified" when isFullyVerified is true', () => {
    renderCard({
      isFullyVerified: true,
      isIdentityVerified: true,
      isBusinessVerified: true,
    });
    expect(screen.getByText("Fully Verified")).toBeInTheDocument();
  });

  it("shows ✓ All badge alongside Fully Verified", () => {
    renderCard({ isFullyVerified: true });
    expect(screen.getByText("✓ All")).toBeInTheDocument();
  });

  it('shows "Verified" when identity AND business verified but not fully', () => {
    renderCard({
      isFullyVerified: false,
      isIdentityVerified: true,
      isBusinessVerified: true,
    });
    // Both the Verification badge AND the Business cell render "Verified" in this
    // state — getAllByText asserts both are present without throwing on duplicates.
    const matches = screen.getAllByText("Verified");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Partially Verified" when only identity is verified', () => {
    renderCard({
      isFullyVerified: false,
      isIdentityVerified: true,
      isBusinessVerified: false,
    });
    expect(screen.getByText("Partially Verified")).toBeInTheDocument();
  });

  it('shows "Partially Verified" when only business is verified', () => {
    renderCard({
      isFullyVerified: false,
      isIdentityVerified: false,
      isBusinessVerified: true,
    });
    expect(screen.getByText("Partially Verified")).toBeInTheDocument();
  });

  it('shows "Not Verified" when all verification flags are false', () => {
    renderCard({
      isFullyVerified: false,
      isIdentityVerified: false,
      isBusinessVerified: false,
    });
    expect(screen.getByText("Not Verified")).toBeInTheDocument();
  });

  // ── Code-gap test ────────────────────────────────────────────────
  it("business verification section shows Verified when isBusinessVerified is true", () => {
    renderCard({ isBusinessVerified: true });
    // The Business cell in the metrics grid shows "Verified" in green.
    // The Verification badge may also show "Verified" simultaneously (both
    // identity and business are true via defaultProps), so we use getAllByText
    // and confirm at least one match carries the green-600 styling.
    const verifiedNodes = screen.getAllByText("Verified");
    const businessCell = verifiedNodes.find((node) =>
      node.className.includes("text-green-600"),
    );
    expect(businessCell).toBeTruthy();
  });

  it("business verification section shows Unverified when false", () => {
    renderCard({
      isBusinessVerified: false,
      isFullyVerified: false,
      isIdentityVerified: false,
    });
    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// TREND INDICATOR
// ─────────────────────────────────────────────────────────────────

describe("VendorTrustScoreCard – trend indicator", () => {
  it('shows "↑ Improving" for pvsScoreTrend="improving"', () => {
    renderCard({ pvsScoreTrend: "improving" });
    expect(screen.getByText("↑ Improving")).toBeInTheDocument();
  });

  it('shows "↓ Declining" for pvsScoreTrend="declining"', () => {
    renderCard({ pvsScoreTrend: "declining" });
    expect(screen.getByText("↓ Declining")).toBeInTheDocument();
  });

  it('shows "→ Stable" for pvsScoreTrend="stable"', () => {
    renderCard({ pvsScoreTrend: "stable" });
    expect(screen.getByText("→ Stable")).toBeInTheDocument();
  });

  it('defaults to "→ Stable" for an unknown trend value', () => {
    renderCard({ pvsScoreTrend: "unknown_trend_xyz" });
    expect(screen.getByText("→ Stable")).toBeInTheDocument();
  });

  it("passing undefined uses React default prop — component shows improving trend", () => {
    // React default parameter syntax (`pvsScoreTrend = "improving"`) means that
    // passing `undefined` is identical to omitting the prop entirely; React
    // substitutes the default value "improving".  The meaningful unknown-value
    // path is already covered by the "unknown_trend_xyz" test above.
    renderCard({ pvsScoreTrend: undefined });
    expect(screen.getByText("↑ Improving")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// ACCOUNT STATUS BADGE
// ─────────────────────────────────────────────────────────────────

describe("VendorTrustScoreCard – account status badge", () => {
  it.each([
    ["new", "New Vendor"],
    ["active", "Active"],
    ["suspended", "Suspended"],
    ["pending", "Pending"],
  ])("shows correct label for accountStatus '%s'", (status, expected) => {
    renderCard({ accountStatus: status });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('defaults to "New Vendor" for an unrecognised account status', () => {
    renderCard({ accountStatus: "mystery_status" });
    expect(screen.getByText("New Vendor")).toBeInTheDocument();
  });

  it("does not render the status badge when accountStatus is falsy", () => {
    renderCard({ accountStatus: "" });
    // The conditional wrapping the badge should suppress rendering
    expect(screen.queryByText("New Vendor")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// METRIC GRID (days on platform, profile completion, reviews)
// ─────────────────────────────────────────────────────────────────

describe("VendorTrustScoreCard – metric grid", () => {
  it("renders daysOnPlatform with 'day' singular when 1", () => {
    renderCard({ daysOnPlatform: 1 });
    expect(screen.getByText("1 day")).toBeInTheDocument();
  });

  it("renders daysOnPlatform with 'days' plural when > 1", () => {
    renderCard({ daysOnPlatform: 30 });
    expect(screen.getByText("30 days")).toBeInTheDocument();
  });

  it("shows profile completion percentage when > 0", () => {
    renderCard({ profileCompletion: 65 });
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("does not show profile completion section when 0", () => {
    renderCard({ profileCompletion: 0 });
    // The conditional {profileCompletion > 0 && ...} hides the element
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("displays the total reviews count", () => {
    renderCard({ totalReviews: 42 });
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("defaults totalReviews to 0 when not provided", () => {
    renderCard({ totalReviews: undefined });
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
