/**
 * USEAUTH HOOKS TESTS
 * Tests for: src/utils/hooks/useAuth.js
 *
 * Run: npx jest useAuth.test.js
 */

import React from "react";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useAuth,
  useCurrentUser,
  useIsAuthenticated,
  useIsAdmin,
  useCanAccessEvents,
  useCanAccessVendorTools,
  useLogin,
  useSignup,
  useLogout,
} from "@/utils/hooks/useAuth";
import { AuthContext } from "@/provider/sessionProvider";

// Mock API functions
jest.mock("@/services/authAPI", () => ({
  loginApi: jest.fn(),
  signupApi: jest.fn(),
  logoutApi: jest.fn(),
  forgotPasswordApi: jest.fn(),
  verifyResetTokenApi: jest.fn(),
  resetPasswordApi: jest.fn(),
}));

jest.mock("@/axiosConfig/tokenService", () => ({
  initializeTokenRefresh: jest.fn(),
  clearRefreshTimer: jest.fn(),
}));

import { loginApi, signupApi, logoutApi } from "@/services/authAPI";
import {
  initializeTokenRefresh,
  clearRefreshTimer,
} from "@/axiosConfig/tokenService";

// ==============================================================
// TEST UTILITIES
// ==============================================================

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

// Helper: create a wrapper with controlled auth context
const createWrapper = (contextValue) => {
  const queryClient = createQueryClient();
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={contextValue}>
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  Wrapper.displayName = "TestAuthWrapper";
  return Wrapper;
};

const baseAuthContext = {
  user: null,
  isAuthenticated: false,
  isInitialized: true,
  loading: false,
  setUser: jest.fn(),
  clearAuth: jest.fn(),
  refetchSession: jest.fn(),
};

// ==============================================================
// useAuth() — Core hook
// ==============================================================

describe("useAuth()", () => {
  it("returns context values when inside SessionProvider", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(baseAuthContext),
    });

    expect(result.current).toMatchObject({
      user: null,
      isAuthenticated: false,
    });
  });

  it("throws when called outside of SessionProvider", () => {
    const queryClient = createQueryClient();
    const NoSessionWrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    NoSessionWrapper.displayName = "NoSessionWrapper";

    expect(() => {
      renderHook(() => useAuth(), { wrapper: NoSessionWrapper });
    }).toThrow("useAuth must be used within SessionProvider");
  });
});

// ==============================================================
// useCurrentUser()
// ==============================================================

describe("useCurrentUser()", () => {
  it("returns null when not logged in", () => {
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper({ ...baseAuthContext, user: null }),
    });
    expect(result.current).toBeNull();
  });

  it("returns user object when logged in", () => {
    const user = { id: 1, email: "test@test.com", role: "customer" };
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper({ ...baseAuthContext, user }),
    });
    expect(result.current).toEqual(user);
  });
});

// ==============================================================
// useIsAdmin()
// ==============================================================

describe("useIsAdmin()", () => {
  it("returns false for customer role", () => {
    const { result } = renderHook(() => useIsAdmin(), {
      wrapper: createWrapper({
        ...baseAuthContext,
        user: { role: "customer" },
      }),
    });
    expect(result.current).toBe(false);
  });

  it("returns false for vendor role", () => {
    const { result } = renderHook(() => useIsAdmin(), {
      wrapper: createWrapper({
        ...baseAuthContext,
        user: { role: "vendor" },
      }),
    });
    expect(result.current).toBe(false);
  });

  it("returns true for admin role", () => {
    const { result } = renderHook(() => useIsAdmin(), {
      wrapper: createWrapper({
        ...baseAuthContext,
        user: { role: "admin" },
      }),
    });
    expect(result.current).toBe(true);
  });

  it("returns false when user is null", () => {
    const { result } = renderHook(() => useIsAdmin(), {
      wrapper: createWrapper({ ...baseAuthContext, user: null }),
    });
    expect(result.current).toBe(false);
  });
});

// ==============================================================
// useCanAccessEvents()
// ==============================================================

describe("useCanAccessEvents()", () => {
  it("returns false when user has no events and is not a vendor", () => {
    const { result } = renderHook(() => useCanAccessEvents(), {
      wrapper: createWrapper({
        ...baseAuthContext,
        user: { hasEvents: false, isVendor: false },
      }),
    });
    expect(result.current).toBe(false);
  });

  it("returns true when user has events", () => {
    const { result } = renderHook(() => useCanAccessEvents(), {
      wrapper: createWrapper({
        ...baseAuthContext,
        user: { hasEvents: true, isVendor: false },
      }),
    });
    expect(result.current).toBe(true);
  });

  it("returns true when user is a vendor", () => {
    const { result } = renderHook(() => useCanAccessEvents(), {
      wrapper: createWrapper({
        ...baseAuthContext,
        user: { hasEvents: false, isVendor: true },
      }),
    });
    expect(result.current).toBe(true);
  });

  it("returns false when user is null", () => {
    const { result } = renderHook(() => useCanAccessEvents(), {
      wrapper: createWrapper({ ...baseAuthContext, user: null }),
    });
    expect(result.current).toBe(false);
  });
});

// ==============================================================
// useCanAccessVendorTools()
// ==============================================================

describe("useCanAccessVendorTools()", () => {
  it("returns false for non-vendor", () => {
    const { result } = renderHook(() => useCanAccessVendorTools(), {
      wrapper: createWrapper({
        ...baseAuthContext,
        user: { isVendor: false, hasEvents: true },
      }),
    });
    expect(result.current).toBe(false);
  });

  it("returns true for vendor", () => {
    const { result } = renderHook(() => useCanAccessVendorTools(), {
      wrapper: createWrapper({
        ...baseAuthContext,
        user: { isVendor: true },
      }),
    });
    expect(result.current).toBe(true);
  });
});

// ==============================================================
// useLogin()
// ==============================================================

describe("useLogin()", () => {
  let queryClient;
  let mockSetUser;

  beforeEach(() => {
    queryClient = createQueryClient();
    mockSetUser = jest.fn();
    jest.clearAllMocks();
  });

  const getWrapper = () => {
    const LoginWrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{ ...baseAuthContext, setUser: mockSetUser }}
        >
          {children}
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    LoginWrapper.displayName = "LoginTestWrapper";
    return LoginWrapper;
  };

  it("calls loginApi with credentials on mutate", async () => {
    const mockUser = { id: 1, email: "user@test.com" };
    loginApi.mockResolvedValueOnce({ user: mockUser });

    const { result } = renderHook(() => useLogin(), { wrapper: getWrapper() });

    await act(async () => {
      result.current.mutate({ email: "user@test.com", password: "Pass1!" });
    });

    // TanStack Query v5 passes a second context arg to mutationFn
    // — check only the first arg (the actual credentials payload)
    expect(loginApi.mock.calls[0][0]).toEqual({
      email: "user@test.com",
      password: "Pass1!",
    });
  });

  it("calls setUser with user data on success", async () => {
    const mockUser = { id: 1, email: "user@test.com" };
    loginApi.mockResolvedValueOnce({ user: mockUser });

    const { result } = renderHook(() => useLogin(), { wrapper: getWrapper() });

    await act(async () => {
      result.current.mutate({ email: "user@test.com", password: "Pass1!" });
    });

    expect(mockSetUser).toHaveBeenCalledWith(mockUser);
  });

  it("calls initializeTokenRefresh on successful login", async () => {
    loginApi.mockResolvedValueOnce({ user: { id: 1 } });

    const { result } = renderHook(() => useLogin(), { wrapper: getWrapper() });

    await act(async () => {
      result.current.mutate({ email: "user@test.com", password: "Pass1!" });
    });

    expect(initializeTokenRefresh).toHaveBeenCalled();
  });

  it("does NOT call setUser on error", async () => {
    loginApi.mockRejectedValueOnce(new Error("Invalid credentials"));

    const { result } = renderHook(() => useLogin(), { wrapper: getWrapper() });

    await act(async () => {
      result.current.mutate({ email: "user@test.com", password: "wrong" });
    });

    expect(mockSetUser).not.toHaveBeenCalled();
  });

  it("sets queryData for ['session'] key on success", async () => {
    const mockUser = { id: 1, email: "user@test.com" };
    loginApi.mockResolvedValueOnce({ user: mockUser });

    const { result } = renderHook(() => useLogin(), { wrapper: getWrapper() });

    await act(async () => {
      result.current.mutate({ email: "user@test.com", password: "Pass1!" });
    });

    const cachedSession = queryClient.getQueryData(["session"]);
    expect(cachedSession).toEqual(mockUser);
  });
});

// ==============================================================
// useSignup()
// ==============================================================

describe("useSignup()", () => {
  let queryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  const getWrapper = () => {
    const SignupWrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={baseAuthContext}>
          {children}
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    SignupWrapper.displayName = "SignupWrapper";
    return SignupWrapper;
  };

  it("calls signupApi with form data", async () => {
    signupApi.mockResolvedValueOnce({ user: { id: 2 } });

    const { result } = renderHook(() => useSignup(), { wrapper: getWrapper() });

    const formData = {
      name: "Jane",
      email: "jane@test.com",
      password: "Pass1!",
      confirmPassword: "Pass1!",
    };

    await act(async () => {
      result.current.mutate(formData);
    });

    // TanStack Query v5 passes a second context arg to mutationFn
    // — check only the first arg (the actual form payload)
    expect(signupApi.mock.calls[0][0]).toEqual(formData);
  });

  it("clears queryClient cache on success", async () => {
    signupApi.mockResolvedValueOnce({ user: { id: 2 } });
    const clearSpy = jest.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useSignup(), { wrapper: getWrapper() });

    await act(async () => {
      result.current.mutate({
        name: "Jane",
        email: "j@t.com",
        password: "P1!",
      });
    });

    expect(clearSpy).toHaveBeenCalled();
  });

  // ⚠️ BUG: useSignup does NOT call setUser after successful signup.
  // This means the user is NOT authenticated after signing up.
  // They are redirected to the login page to sign in again.
  // If auto-login after signup is desired, setUser must be called here.
  it("⚠️ [KNOWN DESIGN GAP] does NOT authenticate user after signup (no setUser call)", async () => {
    signupApi.mockResolvedValueOnce({ user: { id: 2 } });
    const mockSetUser = jest.fn();

    const SignupWrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{ ...baseAuthContext, setUser: mockSetUser }}
        >
          {children}
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    SignupWrapper.displayName = "SignupTestWrapper";

    const { result } = renderHook(() => useSignup(), {
      wrapper: SignupWrapper,
    });

    await act(async () => {
      result.current.mutate({
        name: "Jane",
        email: "j@t.com",
        password: "P1!",
      });
    });

    // setUser is NEVER called — user must manually log in after signup
    expect(mockSetUser).not.toHaveBeenCalled();
  });
});

// ==============================================================
// useLogout()
// ==============================================================

describe("useLogout()", () => {
  let queryClient;
  let mockClearAuth;

  beforeEach(() => {
    queryClient = createQueryClient();
    mockClearAuth = jest.fn();
    jest.clearAllMocks();
  });

  const getWrapper = () => {
    const LogoutWrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{ ...baseAuthContext, clearAuth: mockClearAuth }}
        >
          {children}
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    LogoutWrapper.displayName = "LogoutTestWrapper";
    return LogoutWrapper;
  };

  it("calls clearAuth on successful logout", async () => {
    logoutApi.mockResolvedValueOnce({ message: "Logged out" });

    const { result } = renderHook(() => useLogout(), { wrapper: getWrapper() });

    await act(async () => {
      result.current.mutate();
    });

    expect(mockClearAuth).toHaveBeenCalled();
  });

  it("calls clearRefreshTimer on logout", async () => {
    logoutApi.mockResolvedValueOnce({ message: "Logged out" });

    const { result } = renderHook(() => useLogout(), { wrapper: getWrapper() });

    await act(async () => {
      result.current.mutate();
    });

    expect(clearRefreshTimer).toHaveBeenCalled();
  });

  // ✅ This is correct defensive behavior
  it("still clears auth even when logoutApi fails (defensive logout)", async () => {
    logoutApi.mockRejectedValueOnce(new Error("Network Error"));

    const { result } = renderHook(() => useLogout(), { wrapper: getWrapper() });

    await act(async () => {
      result.current.mutate();
    });

    // Even on error, auth is cleared
    expect(mockClearAuth).toHaveBeenCalled();
    expect(clearRefreshTimer).toHaveBeenCalled();
  });

  it("clears queryClient on logout", async () => {
    logoutApi.mockResolvedValueOnce({});
    const clearSpy = jest.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useLogout(), { wrapper: getWrapper() });

    await act(async () => {
      result.current.mutate();
    });

    expect(clearSpy).toHaveBeenCalled();
  });
});
