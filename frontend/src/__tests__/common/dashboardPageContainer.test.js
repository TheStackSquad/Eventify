/**
 * src/__tests__/dashboardPageContainer.test.js
 *
 * Tests for DashboardPageContainer (dashboardContent.js in the app folder):
 *   1. Loading states  (isInitialized=false / activeView=null)
 *   2. Auth guard      (unauthenticated → redirect)     ⚠️  reveals a bug
 *   3. View initialisation from user flags
 *   4. handleViewChange – non-vendor guard
 *   5. Modal open/close interactions
 *
 * All child components and hooks are mocked.
 */

const React = require("react");
const {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} = require("@testing-library/react");

const {
  makeUser,
  makeUserWithEvents,
  makeVendorUser,
  makeAuthContext,
  makeUnauthenticatedContext,
  makeLoadingAuthContext,
} = require("@/__fixtures__/dashboardFixtures");

// ─────────────────────────────────────────────────────────────────
// Module mocks (must be before the component require)
// ─────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

const mockInvalidateQueries = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  useMutation: jest.fn(),
}));

jest.mock("@/utils/hooks/useAuth", () => ({
  useAuth: jest.fn(),
  useLogout: jest.fn(),
}));

jest.mock("@/utils/hooks/useEvents", () => ({
  useUserEvents: jest.fn(),
  eventKeys: { user: (id) => ["events", "user", id] },
}));

// Lightweight child mocks
jest.mock(
  "@/components/dashboard/eventComponents/dashboardLayout",
  () =>
    function MockDashboardLayout({ children }) {
      return <div data-testid="dashboard-layout">{children}</div>;
    },
);

jest.mock(
  "@/components/dashboard/dashboardSwitcher",
  () =>
    function MockDashboardSwitcher({ activeView }) {
      return (
        <div data-testid="dashboard-switcher" data-active-view={activeView} />
      );
    },
);

jest.mock(
  "@/components/modal/delete",
  () =>
    function MockDeleteModal({ isOpen, onClose, eventId, eventTitle }) {
      return isOpen ? (
        <div
          data-testid="delete-modal"
          data-event-id={eventId}
          data-event-title={eventTitle}
        >
          <button onClick={onClose}>close-delete</button>
        </div>
      ) : null;
    },
);

jest.mock(
  "@/components/modal/analytics",
  () =>
    function MockAnalyticsModal({ isOpen, onClose, eventId }) {
      return isOpen ? (
        <div data-testid="analytics-modal" data-event-id={eventId}>
          <button onClick={onClose}>close-analytics</button>
        </div>
      ) : null;
    },
);

// Import the component under test AFTER mocks are in place
const DashboardPageContainer =
  require("@/app/dashboard/components/dashboardLayout/dashboardContent").default;

// ─────────────────────────────────────────────────────────────────
// Pull in the mocked hooks for per-test configuration
// ─────────────────────────────────────────────────────────────────

const { useAuth, useLogout } = require("@/utils/hooks/useAuth");
const { useUserEvents } = require("@/utils/hooks/useEvents");
const { useMutation } = require("@tanstack/react-query");

// ─────────────────────────────────────────────────────────────────
// Default hook setup
// ─────────────────────────────────────────────────────────────────

const defaultLogoutMutate = jest.fn();

function setupHooks(authOverrides = {}, eventsOverride = {}) {
  useAuth.mockReturnValue(makeAuthContext(authOverrides));
  useLogout.mockReturnValue({ mutate: defaultLogoutMutate });
  useMutation.mockReturnValue({ mutate: defaultLogoutMutate });
  useUserEvents.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
    ...eventsOverride,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────
// 1. LOADING STATES
// ─────────────────────────────────────────────────────────────────

describe("DashboardPageContainer – loading states", () => {
  it("shows loading screen when isInitialized is false", () => {
    setupHooks({ isInitialized: false, isAuthenticated: false, user: null });
    render(<DashboardPageContainer />);
    expect(screen.getByText(/verifying session/i)).toBeInTheDocument();
  });

  it("shows Loading Dashboard heading before init completes", () => {
    setupHooks({ isInitialized: false, user: null, isAuthenticated: false });
    render(<DashboardPageContainer />);
    expect(screen.getByText("Loading Dashboard")).toBeInTheDocument();
  });

  it("does NOT render DashboardLayout while still loading", () => {
    setupHooks({ isInitialized: false, user: null, isAuthenticated: false });
    render(<DashboardPageContainer />);
    expect(screen.queryByTestId("dashboard-layout")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────
// 2. AUTH GUARD  — BUG EXPOSURE TEST
//
// When isInitialized=true but isAuthenticated=false, the useEffect
// guard prevents activeView from ever being set, so the component
// remains stuck in the loading state instead of redirecting.
// The test below documents the EXPECTED behaviour and will fail
// against the current implementation – revealing the code gap.
// ─────────────────────────────────────────────────────────────────

describe("DashboardPageContainer – auth guard", () => {
  it("⚠️  (known gap) redirects unauthenticated user to /auth/login after init", async () => {
    useAuth.mockReturnValue(
      makeUnauthenticatedContext({ isInitialized: true }),
    );
    useLogout.mockReturnValue({ mutate: jest.fn() });
    useMutation.mockReturnValue({ mutate: jest.fn() });
    useUserEvents.mockReturnValue({ data: [], isLoading: false, error: null });

    render(<DashboardPageContainer />);

    // EXPECTED: component detects isAuthenticated=false and calls router.push.
    // ACTUAL (bug): activeView never gets set, component stays in loading state.
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/auth/login");
    });
  });

  it("shows the main dashboard when user is authenticated", async () => {
    setupHooks({ user: makeUserWithEvents() });
    render(<DashboardPageContainer />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// 3. VIEW INITIALISATION
// ─────────────────────────────────────────────────────────────────

describe("DashboardPageContainer – initial view selection", () => {
  it('sets activeView to "events" when user.hasEvents is true', async () => {
    setupHooks({ user: makeUserWithEvents() });
    render(<DashboardPageContainer />);

    await waitFor(() => {
      const switcher = screen.getByTestId("dashboard-switcher");
      expect(switcher).toHaveAttribute("data-active-view", "events");
    });
  });

  it('sets activeView to "vendor" when user.isVendor and no events', async () => {
    setupHooks({ user: makeVendorUser() }); // isVendor=true, hasEvents=false
    render(<DashboardPageContainer />);

    await waitFor(() => {
      const switcher = screen.getByTestId("dashboard-switcher");
      expect(switcher).toHaveAttribute("data-active-view", "vendor");
    });
  });

  it('defaults to "events" for a brand-new user (no events, no vendor)', async () => {
    setupHooks({ user: makeUser() }); // hasEvents=false, isVendor=false
    render(<DashboardPageContainer />);

    await waitFor(() => {
      const switcher = screen.getByTestId("dashboard-switcher");
      expect(switcher).toHaveAttribute("data-active-view", "events");
    });
  });

  it("does NOT reinitialise view once it has been set (guard: activeView !== null)", async () => {
    // hasEvents is true → initial view is "events"
    setupHooks({ user: makeUserWithEvents() });
    const { rerender } = render(<DashboardPageContainer />);

    await waitFor(() =>
      expect(screen.getByTestId("dashboard-switcher")).toHaveAttribute(
        "data-active-view",
        "events",
      ),
    );

    // Rerender does NOT reset view back to null
    rerender(<DashboardPageContainer />);
    expect(screen.getByTestId("dashboard-switcher")).toHaveAttribute(
      "data-active-view",
      "events",
    );
  });

  it("events takes priority over vendor flag (hasEvents=true, isVendor=true)", async () => {
    setupHooks({ user: makeVendorUser({ hasEvents: true }) });
    render(<DashboardPageContainer />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-switcher")).toHaveAttribute(
        "data-active-view",
        "events",
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// 4. handleViewChange GUARD
// ─────────────────────────────────────────────────────────────────
//
// Non-vendors requesting "vendor" view are redirected to "vendor-register".
// This test requires reaching inside the DashboardSwitcher mock which
// receives onViewChange – we simulate it through DashboardLayout's child.
//
// Strategy: render with a user who has events (so view starts as "events"),
// then invoke the onViewChange prop that DashboardLayout receives.
// ─────────────────────────────────────────────────────────────────

// Enhanced mocks that capture callbacks for this section
let capturedOnViewChange;
jest.mock(
  "@/components/dashboard/eventComponents/dashboardLayout",
  () =>
    function MockDashboardLayoutCapture({ children, onViewChange }) {
      capturedOnViewChange = onViewChange;
      return <div data-testid="dashboard-layout">{children}</div>;
    },
  { virtual: false },
);

describe("DashboardPageContainer – handleViewChange", () => {
  it('redirects non-vendor to "vendor-register" when they request the "vendor" view', async () => {
    // User is NOT a vendor
    setupHooks({ user: makeUserWithEvents({ isVendor: false }) });
    render(<DashboardPageContainer />);

    await waitFor(() => screen.getByTestId("dashboard-layout"));

    act(() => {
      capturedOnViewChange("vendor"); // non-vendor requests vendor analytics
    });

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-switcher")).toHaveAttribute(
        "data-active-view",
        "vendor-register",
      );
    });
  });

  it('allows a vendor to switch to the "vendor" view normally', async () => {
    setupHooks({ user: makeVendorUser({ hasEvents: true }) });
    render(<DashboardPageContainer />);

    await waitFor(() => screen.getByTestId("dashboard-layout"));

    act(() => {
      capturedOnViewChange("vendor"); // real vendor requests vendor analytics
    });

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-switcher")).toHaveAttribute(
        "data-active-view",
        "vendor",
      );
    });
  });

  it('allows switching to the "events" view without restrictions', async () => {
    setupHooks({ user: makeVendorUser() }); // starts on vendor view
    render(<DashboardPageContainer />);

    await waitFor(() => screen.getByTestId("dashboard-layout"));

    act(() => {
      capturedOnViewChange("events");
    });

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-switcher")).toHaveAttribute(
        "data-active-view",
        "events",
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// 5. MODAL STATE
// ─────────────────────────────────────────────────────────────────

let capturedSwitcherProps;
jest.mock(
  "@/components/dashboard/dashboardSwitcher",
  () =>
    function MockDashboardSwitcherCapture(props) {
      capturedSwitcherProps = props;
      return (
        <div
          data-testid="dashboard-switcher"
          data-active-view={props.activeView}
        />
      );
    },
  { virtual: false },
);

describe("DashboardPageContainer – modal management", () => {
  const setup = async () => {
    setupHooks({ user: makeUserWithEvents() });
    render(<DashboardPageContainer />);
    await waitFor(() => screen.getByTestId("dashboard-layout"));
  };

  it("DeleteModal is not visible initially", async () => {
    await setup();
    expect(screen.queryByTestId("delete-modal")).not.toBeInTheDocument();
  });

  it("opens DeleteModal with correct eventId and title", async () => {
    await setup();

    act(() => {
      capturedSwitcherProps.openDeleteModal("evt-abc", "My Great Event");
    });

    await waitFor(() => {
      const modal = screen.getByTestId("delete-modal");
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute("data-event-id", "evt-abc");
      expect(modal).toHaveAttribute("data-event-title", "My Great Event");
    });
  });

  it("closes DeleteModal when onClose is called", async () => {
    await setup();

    act(() => {
      capturedSwitcherProps.openDeleteModal("evt-abc", "Test");
    });

    await waitFor(() => screen.getByTestId("delete-modal"));
    fireEvent.click(screen.getByText("close-delete"));

    await waitFor(() => {
      expect(screen.queryByTestId("delete-modal")).not.toBeInTheDocument();
    });
  });

  it("AnalyticsModal is not visible initially", async () => {
    await setup();
    expect(screen.queryByTestId("analytics-modal")).not.toBeInTheDocument();
  });

  it("opens AnalyticsModal with the correct eventId", async () => {
    await setup();

    act(() => {
      capturedSwitcherProps.openAnalyticsModal("evt-analytics-99");
    });

    await waitFor(() => {
      const modal = screen.getByTestId("analytics-modal");
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute("data-event-id", "evt-analytics-99");
    });
  });

  it("closes AnalyticsModal when onClose is called", async () => {
    await setup();

    act(() => {
      capturedSwitcherProps.openAnalyticsModal("evt-x");
    });

    await waitFor(() => screen.getByTestId("analytics-modal"));
    fireEvent.click(screen.getByText("close-analytics"));

    await waitFor(() => {
      expect(screen.queryByTestId("analytics-modal")).not.toBeInTheDocument();
    });
  });

  it("refetchUserEvents calls queryClient.invalidateQueries with correct key", async () => {
    setupHooks({ user: makeUserWithEvents({ id: "user-007" }) });
    render(<DashboardPageContainer />);
    await waitFor(() => screen.getByTestId("dashboard-layout"));

    act(() => {
      capturedSwitcherProps.refetchUserEvents();
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["user-007"]),
      }),
    );
  });
});
