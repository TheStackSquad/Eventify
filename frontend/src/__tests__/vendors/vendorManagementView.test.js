/**
 * src/__tests__/vendorManagementView.test.js
 *
 * Tests every branch inside VendorManagementView (vendorsDashboard.js):
 *   - No user.id              → LoadingSpinner
 *   - "vendor" + no vendorId  → VendorRegistrationView  (⚠️  code-gap log)
 *   - "vendor" + vendorId     → VendorAnalyticsDashboard
 *   - "vendor-register"       → VendorRegistrationView (edit mode when vendorId present)
 *   - unknown view + vendorId → VendorAnalyticsDashboard (default fallback)
 *   - unknown view + none     → VendorRegistrationView  (default fallback)
 *
 * All heavy children are mocked so this test is a pure routing unit test.
 */

const React = require("react");
const { render, screen } = require("@testing-library/react");

const {
  makeUser,
  makeVendorUser,
  makeVendorUserWithoutId,
} = require("@/__fixtures__/dashboardFixtures");

// ─────────────────────────────────────────────────────────────────
// Mock heavy children to keep the test isolated
// ─────────────────────────────────────────────────────────────────

jest.mock(
  "@/components/common/loading/loadingSpinner",
  () =>
    function MockLoadingSpinner({ message }) {
      return <div data-testid="loading-spinner">{message}</div>;
    },
);

jest.mock(
  "@/components/vendorUI/components/form/vendorRegistrationView",
  () =>
    function MockVendorRegistrationView({ userId, vendorId }) {
      return (
        <div
          data-testid="vendor-registration-view"
          data-user-id={userId}
          data-vendor-id={vendorId ?? "none"}
        />
      );
    },
);

jest.mock(
  "@/components/dashboard/vendorComponents/vendorAnalytics/vendorAnalyticsDashboard",
  () =>
    function MockVendorAnalyticsDashboard({ vendorId, userId }) {
      return (
        <div
          data-testid="vendor-analytics-dashboard"
          data-vendor-id={vendorId}
          data-user-id={userId}
        />
      );
    },
);

// Import the component under test AFTER mocks are set up
const VendorManagementView =
  require("@/components/dashboard/vendorComponents/vendorDashboard").default;

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const renderView = (activeView, user, onViewChange = jest.fn()) =>
  render(
    <VendorManagementView
      activeView={activeView}
      user={user}
      onViewChange={onViewChange}
    />,
  );

// ─────────────────────────────────────────────────────────────────
// LOADING STATE – no user.id
// ─────────────────────────────────────────────────────────────────

describe("VendorManagementView – loading state", () => {
  it("renders LoadingSpinner when user is null", () => {
    renderView("vendor", null);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("renders LoadingSpinner when user exists but has no id", () => {
    renderView("vendor", { name: "Ghost" }); // no .id
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("does NOT render vendor content while loading", () => {
    renderView("vendor", null);
    expect(
      screen.queryByTestId("vendor-analytics-dashboard"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("vendor-registration-view"),
    ).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// activeView = "vendor"
// ─────────────────────────────────────────────────────────────────

describe('VendorManagementView – activeView "vendor"', () => {
  it("renders VendorAnalyticsDashboard when user has a vendorId", () => {
    renderView("vendor", makeVendorUser());
    expect(
      screen.getByTestId("vendor-analytics-dashboard"),
    ).toBeInTheDocument();
  });

  it("passes vendorId to VendorAnalyticsDashboard", () => {
    renderView("vendor", makeVendorUser({ vendorId: "vendor-42" }));
    expect(screen.getByTestId("vendor-analytics-dashboard")).toHaveAttribute(
      "data-vendor-id",
      "vendor-42",
    );
  });

  it("passes userId to VendorAnalyticsDashboard", () => {
    renderView("vendor", makeVendorUser({ id: "user-99", vendorId: "v-1" }));
    expect(screen.getByTestId("vendor-analytics-dashboard")).toHaveAttribute(
      "data-user-id",
      "user-99",
    );
  });

  // ── Code-gap: vendor flag set but no vendorId yet ─────────────
  it("falls back to VendorRegistrationView when isVendor but vendorId is null", () => {
    // This case should not occur in production, but the component handles it.
    // The console.warn reveals the data inconsistency.
    renderView("vendor", makeVendorUserWithoutId());
    expect(screen.getByTestId("vendor-registration-view")).toBeInTheDocument();
  });

  it("pre-fills userId on registration view for vendor-without-id fallback", () => {
    const user = makeVendorUserWithoutId({ id: "user-007" });
    renderView("vendor", user);
    expect(screen.getByTestId("vendor-registration-view")).toHaveAttribute(
      "data-user-id",
      "user-007",
    );
  });
});

// ─────────────────────────────────────────────────────────────────
// activeView = "vendor-register"
// ─────────────────────────────────────────────────────────────────

describe('VendorManagementView – activeView "vendor-register"', () => {
  it("renders VendorRegistrationView", () => {
    renderView("vendor-register", makeVendorUser());
    expect(screen.getByTestId("vendor-registration-view")).toBeInTheDocument();
  });

  it("passes vendorId to VendorRegistrationView (edit mode)", () => {
    renderView(
      "vendor-register",
      makeVendorUser({ vendorId: "vendor-edit-01" }),
    );
    expect(screen.getByTestId("vendor-registration-view")).toHaveAttribute(
      "data-vendor-id",
      "vendor-edit-01",
    );
  });

  it("passes vendorId=none for a new vendor (create mode)", () => {
    renderView("vendor-register", makeVendorUserWithoutId());
    expect(screen.getByTestId("vendor-registration-view")).toHaveAttribute(
      "data-vendor-id",
      "none",
    );
  });

  it("passes userId to VendorRegistrationView", () => {
    renderView("vendor-register", makeVendorUser({ id: "user-abc" }));
    expect(screen.getByTestId("vendor-registration-view")).toHaveAttribute(
      "data-user-id",
      "user-abc",
    );
  });
});

// ─────────────────────────────────────────────────────────────────
// DEFAULT / UNKNOWN view (fallback logic)
// ─────────────────────────────────────────────────────────────────

describe("VendorManagementView – unknown/default activeView", () => {
  it("shows VendorAnalyticsDashboard as fallback when user has vendorId", () => {
    renderView("totally-unknown-view", makeVendorUser());
    expect(
      screen.getByTestId("vendor-analytics-dashboard"),
    ).toBeInTheDocument();
  });

  it("shows VendorRegistrationView as fallback when user has no vendorId", () => {
    renderView("totally-unknown-view", makeUser({ id: "user-new" }));
    expect(screen.getByTestId("vendor-registration-view")).toBeInTheDocument();
  });

  it("passes correct vendorId in fallback analytics case", () => {
    renderView("unknown", makeVendorUser({ vendorId: "v-fallback" }));
    expect(screen.getByTestId("vendor-analytics-dashboard")).toHaveAttribute(
      "data-vendor-id",
      "v-fallback",
    );
  });
});

// ─────────────────────────────────────────────────────────────────
// onViewChange prop passthrough
// ─────────────────────────────────────────────────────────────────

describe("VendorManagementView – onViewChange passthrough", () => {
  it("passes onViewChange to VendorAnalyticsDashboard (for Edit Profile button)", () => {
    // We can't assert a prop directly on a DOM element with data-* in this mock,
    // so we verify the dashboard is rendered (prop is accepted without throwing)
    const onViewChange = jest.fn();
    renderView("vendor", makeVendorUser(), onViewChange);
    expect(
      screen.getByTestId("vendor-analytics-dashboard"),
    ).toBeInTheDocument();
  });
});
