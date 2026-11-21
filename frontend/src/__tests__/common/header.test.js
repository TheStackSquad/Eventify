/**
 * header.test.js
 *
 * Tests for src/components/common/Header.js
 *
 * Covers:
 *   - Skeleton state while auth is uninitialized
 *   - Full header rendered once initialized
 *   - Nav items rendered
 *   - Mobile menu toggle open / close
 *   - Logout success → toast + redirect
 *   - Logout failure → error toast, no redirect
 *   - EmailPreferencesModal only mounted when authenticated
 *   - useEmailPreferences called with userId when authenticated, null when not
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";

// ─── Next / framer / lucide mocks ─────────────────────────────────────────────

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

// ─── Internal component stubs ─────────────────────────────────────────────────

jest.mock(
  "@/components/common/nav/desktopNav",
  () =>
    function MockDesktopNav({ navItems }) {
      return (
        <nav data-testid="desktop-nav">
          {navItems.map((i) => (
            <a key={i.path} href={i.path}>
              {i.label}
            </a>
          ))}
        </nav>
      );
    },
);

jest.mock(
  "@/components/common/nav/mobileMenu",
  () =>
    function MockMobileMenu({ menuOpen, setMenuOpen }) {
      return menuOpen ? (
        <div data-testid="mobile-menu">
          <button onClick={() => setMenuOpen(false)}>Close Mobile Menu</button>
        </div>
      ) : null;
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

// ─── Hook & service mocks ─────────────────────────────────────────────────────

const mockUseDropdownReturn = [
  { current: null },
  false,
  jest.fn(),
  jest.fn(),
  jest.fn(),
];

jest.mock("@/utils/hooks/useDropdown", () => ({
  useDropdown: jest.fn(() => mockUseDropdownReturn),
}));

const mockUseEmailPreferences = jest.fn();
jest.mock("@/utils/hooks/useEmailPreferences", () => ({
  useEmailPreferences: (...args) => mockUseEmailPreferences(...args),
}));

const mockUseAuth = jest.fn();
jest.mock("@/utils/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockLogoutApi = jest.fn();
jest.mock("@/services/authAPI", () => ({
  logoutApi: (...args) => mockLogoutApi(...args),
}));

jest.mock("@/components/common/toast/toastAlert", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

// ─── Import SUT after all mocks ───────────────────────────────────────────────

import Header from "@/components/common/Header";
import toastAlert from "@/components/common/toast/toastAlert";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const guestAuth = { user: null, isAuthenticated: false, isInitialized: true };
const loggedInAuth = {
  user: {
    id: "u-001",
    name: "Amara",
    email: "amara@test.com",
    profileImage: "/amara.jpg",
  },
  isAuthenticated: true,
  isInitialized: true,
};
const uninitializedAuth = {
  user: null,
  isAuthenticated: false,
  isInitialized: false,
};

// ─── Global setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseEmailPreferences.mockReturnValue({
    allowReminders: true,
    isLoading: false,
    error: null,
    updatePreference: jest.fn(),
  });
});

// ─── Skeleton state ───────────────────────────────────────────────────────────

describe("Header — skeleton / uninitialized", () => {
  it("renders a skeleton placeholder when isInitialized is false", () => {
    mockUseAuth.mockReturnValue(uninitializedAuth);
    const { container } = render(<Header />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("does NOT render the desktop nav when uninitialized", () => {
    mockUseAuth.mockReturnValue(uninitializedAuth);
    render(<Header />);
    expect(screen.queryByTestId("desktop-nav")).toBeNull();
  });

  it("does NOT render the cart icon when uninitialized", () => {
    mockUseAuth.mockReturnValue(uninitializedAuth);
    render(<Header />);
    expect(screen.queryByTestId("cart-icon")).toBeNull();
  });
});

// ─── Full header rendering ────────────────────────────────────────────────────

describe("Header — initialized rendering", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(guestAuth);
  });

  it("renders the site brand / logo text", () => {
    render(<Header />);
    expect(screen.getByText("Bandhit")).toBeInTheDocument();
  });

  it("renders the desktop nav", () => {
    render(<Header />);
    expect(screen.getByTestId("desktop-nav")).toBeInTheDocument();
  });

  it("renders all 5 nav items", () => {
    render(<Header />);
    ["Events", "Vendor", "Dashboard", "For-You", "About Us"].forEach(
      (label) => {
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      },
    );
  });

  it("renders the cart icon", () => {
    render(<Header />);
    expect(screen.getAllByTestId("cart-icon").length).toBeGreaterThan(0);
  });

  it("renders the mobile menu toggle button", () => {
    render(<Header />);
    expect(
      screen.getByRole("button", { name: /toggle menu/i }),
    ).toBeInTheDocument();
  });
});

// ─── Mobile menu toggle ───────────────────────────────────────────────────────

describe("Header — mobile menu", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(guestAuth);
  });

  it("mobile menu is not visible before toggle", () => {
    render(<Header />);
    expect(screen.queryByTestId("mobile-menu")).toBeNull();
  });

  it("opens mobile menu when toggle button is clicked", () => {
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: /toggle menu/i }));
    expect(screen.getByTestId("mobile-menu")).toBeInTheDocument();
  });

  it("closes mobile menu on second toggle click", () => {
    render(<Header />);
    const btn = screen.getByRole("button", { name: /toggle menu/i });
    // Wrap each click in act() so React flushes the state update and
    // re-renders before the next click reads menuOpen. Without act(),
    // both clicks see the same stale closure value and the menu stays open.
    // Root cause in code: handleMenuToggle should use setMenuOpen(prev => !prev).
    act(() => {
      fireEvent.click(btn);
    }); // open  → menuOpen = true
    act(() => {
      fireEvent.click(btn);
    }); // close → menuOpen = false
    expect(screen.queryByTestId("mobile-menu")).toBeNull();
  });

  it("closes mobile menu when mobile menu itself calls setMenuOpen(false)", () => {
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: /toggle menu/i }));
    fireEvent.click(screen.getByText("Close Mobile Menu"));
    expect(screen.queryByTestId("mobile-menu")).toBeNull();
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

describe("Header — logout handler", () => {
  // window.location.href is read-only in jsdom and cannot be overridden with
  // jest.spyOn or a plain delete+reassign (jsdom resolves the string to a full
  // URL). Instead we use Object.defineProperty with a setter spy so we can
  // assert exactly what value the component tried to assign.
beforeAll(() => {
  delete window.location;
});

let hrefSetter;

beforeEach(() => {
  mockUseAuth.mockReturnValue(loggedInAuth);
  hrefSetter = jest.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      assign: jest.fn(),
      replace: jest.fn(),
      get href() {
        return "";
      },
      set href(v) {
        hrefSetter(v);
      },
    },
  });
});

afterEach(() => {
  delete window.location;
});

  // UserPanel renders twice (desktop + mobile), so getByRole with a shared
  // name finds two matches. Use getAllByRole(...)[0] to target the first.

  it("calls logoutApi when the logout button is clicked", async () => {
    mockLogoutApi.mockResolvedValue({});
    render(<Header />);

    fireEvent.click(screen.getAllByAltText("User Profile")[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /logout/i })[0]);

    await waitFor(() => {
      expect(mockLogoutApi).toHaveBeenCalledTimes(1);
    });
  });

  it("shows success toast and redirects to '/' on successful logout", async () => {
    mockLogoutApi.mockResolvedValue({});
    render(<Header />);

    fireEvent.click(screen.getAllByAltText("User Profile")[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /logout/i })[0]);

    await waitFor(() => {
      expect(toastAlert.success).toHaveBeenCalledWith(
        "Logged out successfully",
      );
      expect(hrefSetter).toHaveBeenCalledWith("/");
    });
  });

  it("shows error toast and does NOT redirect on logout failure", async () => {
    mockLogoutApi.mockRejectedValue(new Error("Session expired"));
    render(<Header />);

    fireEvent.click(screen.getAllByAltText("User Profile")[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /logout/i })[0]);

    await waitFor(() => {
      expect(toastAlert.error).toHaveBeenCalledWith(
        "Logout failed. Please try again.",
      );
      expect(hrefSetter).not.toHaveBeenCalled();
    });
  });
});

// ─── Email preferences modal gating ──────────────────────────────────────────

describe("Header — email preferences modal", () => {
  it("does NOT render EmailPreferencesModal when user is not authenticated", () => {
    mockUseAuth.mockReturnValue(guestAuth);
    render(<Header />);
    expect(screen.queryByTestId("email-pref-modal")).toBeNull();
  });

  it("renders EmailPreferencesModal when user is authenticated and opens it", () => {
    mockUseAuth.mockReturnValue(loggedInAuth);
    render(<Header />);
    fireEvent.click(screen.getAllByAltText("User Profile")[0]);
    // UserPanel renders twice → two "Email Preferences" buttons. Use [0].
    fireEvent.click(
      screen.getAllByRole("button", { name: /Email Preferences/i })[0],
    );
    expect(screen.getByTestId("email-pref-modal")).toBeInTheDocument();
  });

  it("closes email modal when onClose is called", () => {
    mockUseAuth.mockReturnValue(loggedInAuth);
    render(<Header />);
    fireEvent.click(screen.getAllByAltText("User Profile")[0]);
    fireEvent.click(
      screen.getAllByRole("button", { name: /Email Preferences/i })[0],
    );
    fireEvent.click(screen.getByText("Close Email Modal"));
    expect(screen.queryByTestId("email-pref-modal")).toBeNull();
  });
});

// ─── useEmailPreferences call signature ──────────────────────────────────────

describe("Header — useEmailPreferences hook call", () => {
  it("passes user.id to useEmailPreferences when authenticated", () => {
    mockUseAuth.mockReturnValue(loggedInAuth);
    render(<Header />);
    expect(mockUseEmailPreferences).toHaveBeenCalledWith("u-001");
  });

  it("passes null to useEmailPreferences when not authenticated", () => {
    mockUseAuth.mockReturnValue(guestAuth);
    render(<Header />);
    expect(mockUseEmailPreferences).toHaveBeenCalledWith(null);
  });
});
