/**
 * headerUserPanel.test.js
 *
 * Tests for the UserPanel and ProfileCircle sub-components inside Header.js
 * (not separately exported — tested through <Header />).
 *
 * Covers:
 *   - Guest state: welcome message, login + create account links visible
 *   - Logged-in state: user name, email, avatar, role badge
 *   - Vendor badge shown when user.isVendor = true
 *   - Profile image falls back to placeholder when profileImage is absent
 *   - Clicking ProfileCircle opens UserPanel
 *   - Clicking outside UserPanel closes it
 *   - Email Preferences button closes panel and opens modal
 *   - Dashboard and Settings links present when logged in
 *   - Active status badge visible when logged in
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";


// Header renders UserPanel twice (desktop and mobile); only CSS hides one, and jsdom ignores CSS.
const byText = (...args) => screen.getAllByText(...args)[0];
const byRole = (...args) => screen.getAllByRole(...args)[0];
// ─── Standard mocks (mirrors header.test.js setup) ───────────────────────────


jest.mock(
  "next/link",
  () =>
    function MockLink({ href, children, ...rest }) {
      return (
        <a href={href} {...rest}>
          {children}
        </a>
      );
    },
);

jest.mock(
  "next/image",
  () =>
    function MockImage({ src, alt }) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt={alt} />;
    },
);

jest.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag) =>
        function MockMotion({ children, ...rest }) {
          const {
            whileHover,
            whileTap,
            animate,
            initial,
            exit,
            transition,
            ...domProps
          } = rest;
          return React.createElement(tag, domProps, children);
        },
    },
  ),
  AnimatePresence: ({ children }) => <>{children}</>,
}));

jest.mock("lucide-react", () => {
  const icon = (name) =>
    function Icon(props) {
      return <svg data-testid={`icon-${name}`} {...props} />;
    };
  return {
    Menu: icon("menu"),
    X: icon("x"),
    User: icon("user"),
    LogOut: icon("logout"),
    Settings: icon("settings"),
    LayoutDashboard: icon("dashboard"),
    Mail: icon("mail"),
    CheckCircle2: icon("check-circle"),
    ChevronDown: icon("chevron-down"),
    Bell: icon("bell"),
    BellOff: icon("bell-off"),
    CheckCircle: icon("check"),
    Loader2: icon("loader"),
  };
});

jest.mock(
  "@/components/common/nav/desktopNav",
  () =>
    function MockDesktopNav() {
      return <nav data-testid="desktop-nav" />;
    },
);

jest.mock(
  "@/components/common/nav/mobileMenu",
  () =>
    function MockMobileMenu() {
      return null;
    },
);

jest.mock(
  "@/components/common/cartIcon",
  () =>
    function MockCartIcon() {
      return <div data-testid="cart-icon" />;
    },
);

jest.mock(
  "@/components/modal/emailPreferencesModal",
  () =>
    function MockEmailPreferencesModal({ isOpen, onClose }) {
      return isOpen ? (
        <div data-testid="email-pref-modal">
          <button onClick={onClose}>Close Email Modal</button>
        </div>
      ) : null;
    },
);

jest.mock("@/utils/hooks/useDropdown", () => ({
  useDropdown: jest.fn(() => [
    { current: null },
    false,
    jest.fn(),
    jest.fn(),
    jest.fn(),
  ]),
}));

jest.mock("@/utils/hooks/useEmailPreferences", () => ({
  useEmailPreferences: jest.fn(() => ({
    allowReminders: true,
    isLoading: false,
    error: null,
    updatePreference: jest.fn(),
  })),
}));

const mockUseAuth = jest.fn();
jest.mock("@/utils/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/services/authAPI", () => ({
  logoutApi: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/components/common/toast/toastAlert", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

// ─── SUT ──────────────────────────────────────────────────────────────────────

import Header from "@/components/common/Header";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const guestAuth = { user: null, isAuthenticated: false, isInitialized: true };

const makeUser = (overrides = {}) => ({
  id: "u-001",
  name: "Amara Okonkwo",
  email: "amara@test.com",
  profileImage: "/amara.jpg",
  role: "vendor",
  isVendor: false,
  ...overrides,
});

const loggedInAuth = (userOverrides = {}) => ({
  user: makeUser(userOverrides),
  isAuthenticated: true,
  isInitialized: true,
});

// ─── Helper: open the user panel ─────────────────────────────────────────────
// ProfileCircle renders two img tags (desktop + mobile versions). Click the first.
const openPanel = () => {
  const profileImgs = screen.getAllByAltText("User Profile");
  fireEvent.click(profileImgs[0]);
};

const openGuestPanel = () => {
  const profileImgs = screen.getAllByAltText("Placeholder Profile");
  fireEvent.click(profileImgs[0]);
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Guest state ──────────────────────────────────────────────────────────────

describe("UserPanel — guest state", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(guestAuth);
  });

  it("shows 'Welcome!' heading in the panel when not logged in", () => {
    render(<Header />);
    openGuestPanel();
    expect(byText("Welcome!")).toBeInTheDocument();
  });

  it("shows 'Sign in to unlock all features' prompt", () => {
    render(<Header />);
    openGuestPanel();
    expect(
      byText(/Sign in to unlock all features/i),
    ).toBeInTheDocument();
  });

  it("renders a Login link pointing to the login page", () => {
    render(<Header />);
    openGuestPanel();
    const loginLinks = screen.getAllByRole("link", { name: /^login$/i });
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks[0]).toHaveAttribute("href", "/account/auth/login");
  });

  it("renders a Create Account link pointing to the signup page", () => {
    render(<Header />);
    openGuestPanel();
    const signupLinks = screen.getAllByRole("link", {
      name: /Create Account/i,
    });
    expect(signupLinks.length).toBeGreaterThan(0);
    expect(signupLinks[0]).toHaveAttribute(
      "href",
      "/account/auth/create-account",
    );
  });

  it("does NOT show Dashboard, Settings, or Logout in guest panel", () => {
    render(<Header />);
    openGuestPanel();
    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.queryByText("Settings")).toBeNull();
    expect(screen.queryByText("Logout")).toBeNull();
  });

  it("profile circle renders placeholder image alt text for guests", () => {
    render(<Header />);
    expect(
      screen.getAllByAltText("Placeholder Profile").length,
    ).toBeGreaterThan(0);
  });
});

// ─── Logged-in state ──────────────────────────────────────────────────────────

describe("UserPanel — logged-in state", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(loggedInAuth());
  });

  it("displays the user's name in the panel", () => {
    render(<Header />);
    openPanel();
    expect(byText("Amara Okonkwo")).toBeInTheDocument();
  });

  it("displays the user's email in the panel", () => {
    render(<Header />);
    openPanel();
    expect(byText("amara@test.com")).toBeInTheDocument();
  });

  it("shows the 'Active' status badge", () => {
    render(<Header />);
    openPanel();
    expect(byText("Active")).toBeInTheDocument();
  });

  it("renders the user's role badge when role is provided", () => {
    render(<Header />);
    openPanel();
    expect(byText("vendor")).toBeInTheDocument();
  });

  it("does NOT render a role badge when user.role is absent", () => {
    mockUseAuth.mockReturnValue(loggedInAuth({ role: undefined }));
    render(<Header />);
    openPanel();
    // Should not find "vendor" or "admin" etc
    expect(screen.queryByText("vendor")).toBeNull();
  });

  it("renders the vendor verified badge when user.isVendor is true", () => {
    mockUseAuth.mockReturnValue(loggedInAuth({ isVendor: true }));
    render(<Header />);
    openPanel();
    // CheckCircle2 icon rendered inside the badge
    expect(screen.getAllByTestId("icon-check-circle"))[0].toBeInTheDocument();
  });

  it("does NOT render the vendor badge when user.isVendor is false", () => {
    render(<Header />);
    openPanel();
    expect(screen.queryByTestId("icon-check-circle")).toBeNull();
  });

  it("renders a Dashboard link in the panel", () => {
    render(<Header />);
    openPanel();
    expect(byRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("renders a Settings link pointing to notification settings", () => {
    render(<Header />);
    openPanel();
    expect(byRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/settings/notifications",
    );
  });

  it("renders the Email Preferences button", () => {
    render(<Header />);
    openPanel();
    expect(
      byRole("button", { name: /Email Preferences/i }),
    ).toBeInTheDocument();
  });

  it("renders the Logout button", () => {
    render(<Header />);
    openPanel();
    expect(byRole("button", { name: /logout/i })).toBeInTheDocument();
  });
});

// ─── Profile image fallback ───────────────────────────────────────────────────

describe("UserPanel — profile image", () => {
  it("uses provided profileImage as avatar src in the panel", () => {
    mockUseAuth.mockReturnValue(loggedInAuth({ profileImage: "/custom.jpg" }));
    render(<Header />);
    openPanel();
    const imgs = screen.getAllByAltText("User Profile");
    expect(imgs.some((img) => img.getAttribute("src") === "/custom.jpg")).toBe(
      true,
    );
  });

  it("falls back to /img/placeholder.jpg when profileImage is absent", () => {
    mockUseAuth.mockReturnValue(loggedInAuth({ profileImage: null }));
    render(<Header />);
    openPanel();
    const imgs = screen.getAllByAltText("User Profile");
    expect(
      imgs.some((img) => img.getAttribute("src") === "/img/placeholder.jpg"),
    ).toBe(true);
  });

  it("falls back to 'User' display name when user.name is absent", () => {
    mockUseAuth.mockReturnValue(loggedInAuth({ name: undefined }));
    render(<Header />);
    openPanel();
    expect(byText("User")).toBeInTheDocument();
  });
});

// ─── Panel open / close ───────────────────────────────────────────────────────

describe("UserPanel — open and close", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(loggedInAuth());
  });

  it("panel is not visible before ProfileCircle is clicked", () => {
    render(<Header />);
    // Panel content (Active badge) should not be present before open
    expect(screen.queryByText("Active")).toBeNull();
  });

  it("panel becomes visible after ProfileCircle click", () => {
    render(<Header />);
    openPanel();
    expect(byText("Active")).toBeInTheDocument();
  });

  it("clicking ProfileCircle again closes the panel", () => {
    render(<Header />);
    const imgs = () => screen.getAllByAltText("User Profile");
    fireEvent.click(imgs()[0]); // open
    fireEvent.click(imgs()[0]); // close
    expect(screen.queryByText("Active")).toBeNull();
  });

  it("clicking outside the panel closes it", () => {
    render(<Header />);
    openPanel();
    // Fire mousedown on document body (outside panel)
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Active")).toBeNull();
  });

  it("Dashboard link click closes the panel", () => {
    render(<Header />);
    openPanel();
    fireEvent.click(byRole("link", { name: /dashboard/i }));
    expect(screen.queryByText("Active")).toBeNull();
  });
});

// ─── Email Preferences button ─────────────────────────────────────────────────

describe("UserPanel — Email Preferences", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(loggedInAuth());
  });

  it("closes the user panel when Email Preferences is clicked", () => {
    render(<Header />);
    openPanel();
    fireEvent.click(byRole("button", { name: /Email Preferences/i }));
    expect(screen.queryByText("Active")).toBeNull();
  });

  it("opens the email preferences modal when Email Preferences is clicked", () => {
    render(<Header />);
    openPanel();
    fireEvent.click(byRole("button", { name: /Email Preferences/i }));
    expect(screen.getByTestId("email-pref-modal")).toBeInTheDocument();
  });
});
