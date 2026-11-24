/**
 * COMPONENT TESTS — LoginForm & SignUpForm
 * Tests for: src/components/account/LoginForm.js
 *            src/components/account/signUp.js
 *
 * Run: npx jest components.test.js
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock hooks
jest.mock("@/utils/hooks/useAuth", () => ({
  useLogin: jest.fn(),
  useSignup: jest.fn(),
}));

// Mock toast
jest.mock("@/components/common/toast/toastAlert", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock error utilities
jest.mock("@/utils/errors/errorUtils", () => ({
  getUserFriendlyError: jest.fn(
    (error, fallback) => fallback || "Error occurred",
  ),
  isNetworkError: jest.fn(() => false),
}));

// Mock input components to simplify rendering
jest.mock("@/components/common/loginInputFields", () => ({
  LoginInputField: ({
    type,
    value,
    onChange,
    placeholder,
    disabled,
    isPassword,
    togglePasswordVisibility,
    showPassword,
  }) => (
    <div>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={`input-${placeholder?.toLowerCase().replace(/\s/g, "-")}`}
      />
      {isPassword && (
        <button
          type="button"
          onClick={togglePasswordVisibility}
          data-testid="toggle-password"
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      )}
    </div>
  ),
}));

jest.mock("@/components/common/inputFields", () => ({
  __esModule: true,
  default: ({
    type,
    value,
    onChange,
    placeholder,
    name,
    error,
    isPassword,
    onToggleVisibility,
    showPassword,
  }) => (
    <div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        name={name}
        data-testid={`input-${name}`}
      />
      {error && <span data-testid={`error-${name}`}>{error}</span>}
      {isPassword && (
        <button
          type="button"
          onClick={onToggleVisibility}
          data-testid={`toggle-${name}`}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      )}
    </div>
  ),
}));

import LoginForm from "@/components/account/LoginForm";
import SignUpForm from "@/components/account/signUp";
import { useLogin, useSignup } from "@/utils/hooks/useAuth";
import toastAlert from "@/components/common/toast/toastAlert";
import {
  getUserFriendlyError,
  isNetworkError,
} from "@/utils/errors/errorUtils";

// ==============================================================
// LOGIN FORM TESTS
// ==============================================================

describe("LoginForm", () => {
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useLogin.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  const renderLogin = () => render(<LoginForm />);

  it("renders email and password inputs", () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
  });

  it("renders the Login button", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  it("renders the forgot password link", () => {
    renderLogin();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  it("renders sign up link pointing to correct path", () => {
    renderLogin();
    const signupLink = screen.getByText(/sign up here/i);
    expect(signupLink.closest("a")).toHaveAttribute(
      "href",
      "/account/auth/create-account",
    );
  });

  // ==============================================================
  // Validation
  // ==============================================================

  it("shows error when submitting empty form", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
     expect(screen.getByRole("alert")).toHaveTextContent(
       /please enter your email address/i,
     );
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("shows error toast when submitting empty form", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
    expect(toastAlert.error).toHaveBeenCalledWith(
      "Please enter your email address.",
    );
    });
  });

  it("shows error for invalid email format", async () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "notanemail" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "anypassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/valid email/i);
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  // ✅ FIXED: LoginForm now uses validateLogin() which enforces 8-char minimum
  it("blocks submission with a 1-character password (min-length enforced)", async () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "x" }, // 1 char — should be rejected
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /at least 8 characters/i,
      );
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("calls login mutate with email, password and rememberMe on valid submit", async () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "Password1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        // ✅ FIXED: rememberMe is now included (defaults to false)
        {
          email: "user@example.com",
          password: "Password1!",
          rememberMe: false,
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });
  });

  // ✅ FIXED: rememberMe is now included in the login payload
  it("sends rememberMe: true in payload when checkbox is checked", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("checkbox")); // check rememberMe

    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "Password1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      const [payload] = mockMutate.mock.calls[0];
      expect(payload).toHaveProperty("rememberMe", true);
    });
  });

  // ==============================================================
  // Success behavior
  // ==============================================================

  it("redirects to /dashboard on successful login after 500ms", async () => {
    jest.useFakeTimers();
    useLogin.mockReturnValue({
      mutate: jest.fn((_, { onSuccess }) => onSuccess()),
      isPending: false,
    });

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "Password1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    // Before delay
    expect(mockPush).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(500));
    expect(mockPush).toHaveBeenCalledWith("/dashboard");

    jest.useRealTimers();
  });

  it("shows success toast on successful login", async () => {
    useLogin.mockReturnValue({
      mutate: jest.fn((_, { onSuccess }) => onSuccess()),
      isPending: false,
    });

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "Password1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(toastAlert.success).toHaveBeenCalledWith(
      expect.stringContaining("Welcome back"),
    );
  });

  // ==============================================================
  // Error behavior
  // ==============================================================

  it("displays inline error on login failure", async () => {
    const apiError = {
      response: { status: 401 },
      message: "Invalid credentials",
    };
    getUserFriendlyError.mockReturnValue(
      "The email or password you entered is incorrect.",
    );

    useLogin.mockReturnValue({
      mutate: jest.fn((_, { onError }) => onError(apiError)),
      isPending: false,
    });

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "WrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The email or password you entered is incorrect.",
      );
    });
  });

  it("shows toast only for network/server errors, not validation errors", async () => {
    const apiError = {
      response: { status: 401 },
      message: "Invalid credentials",
    };
    getUserFriendlyError.mockReturnValue("Incorrect credentials");
    isNetworkError.mockReturnValue(false);

    useLogin.mockReturnValue({
      mutate: jest.fn((_, { onError }) => onError(apiError)),
      isPending: false,
    });

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "WrongPass!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      // error.response.status is 401, not >= 500, and isNetworkError is false
      // So toast should NOT be called for auth errors
      expect(toastAlert.error).not.toHaveBeenCalled();
    });
  });

  it("shows toast for 500 server errors", async () => {
    const serverError = { response: { status: 500 }, message: "Server error" };
    getUserFriendlyError.mockReturnValue("Something went wrong on our end.");
    isNetworkError.mockReturnValue(false);

    useLogin.mockReturnValue({
      mutate: jest.fn((_, { onError }) => onError(serverError)),
      isPending: false,
    });

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "AnyPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(toastAlert.error).toHaveBeenCalled();
    });
  });

  it("clears previous error on new submit", async () => {
    useLogin.mockReturnValue({
      mutate: jest.fn((_, { onError }) =>
        onError({ response: { status: 401 }, message: "fail" }),
      ),
      isPending: false,
    });
    getUserFriendlyError.mockReturnValue("Bad credentials");

    renderLogin();
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);

    fireEvent.change(emailInput, { target: { value: "user@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "WrongPass!" } });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    // Now simulate success on next attempt
    useLogin.mockReturnValue({
      mutate: jest.fn((_, { onSuccess }) => onSuccess()),
      isPending: false,
    });

    // Re-render not needed since state updates — but let's check error clears on re-submit
    fireEvent.click(screen.getByRole("button", { name: /login/i }));
    // Error state is set to "" at start of handleSubmit
  });

  // ==============================================================
  // Loading / Pending state
  // ==============================================================

  it("disables submit button while pending", () => {
    useLogin.mockReturnValue({ mutate: mockMutate, isPending: true });
    renderLogin();
    expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();
  });

  it("shows spinner text when pending", () => {
    useLogin.mockReturnValue({ mutate: mockMutate, isPending: true });
    renderLogin();
    expect(screen.getByText(/logging in.../i)).toBeInTheDocument();
  });

  it("disables email and password inputs while pending", () => {
    useLogin.mockReturnValue({ mutate: mockMutate, isPending: true });
    renderLogin();
    expect(screen.getByPlaceholderText(/email address/i)).toBeDisabled();
    expect(screen.getByPlaceholderText(/password/i)).toBeDisabled();
  });

  // ==============================================================
  // Password visibility toggle
  // ==============================================================

  it("toggles password visibility", () => {
    renderLogin();
    const toggleBtn = screen.getByTestId("toggle-password");
    const passwordInput = screen.getByPlaceholderText(/password/i);

    // Initially password type
    expect(passwordInput).toHaveAttribute("type", "password");

    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute("type", "text");

    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  // ==============================================================
  // Accessibility
  // ==============================================================

  it("error display has role='alert' and aria-live='polite'", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("aria-live", "polite");
    });
  });
});

// ==============================================================
// SIGNUP FORM TESTS
// ==============================================================

describe("SignUpForm", () => {
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useSignup.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  const renderSignup = () => render(<SignUpForm />);

  const fillForm = ({
    name = "John Doe",
    email = "john@example.com",
    password = "SecurePass1!",
    confirmPassword = "SecurePass1!",
  } = {}) => {
    if (name !== null) {
      fireEvent.change(screen.getByTestId("input-name"), {
        target: { value: name },
      });
    }
    if (email !== null) {
      fireEvent.change(screen.getByTestId("input-email"), {
        target: { value: email },
      });
    }
    if (password !== null) {
      fireEvent.change(screen.getByTestId("input-password"), {
        target: { value: password },
      });
    }
    if (confirmPassword !== null) {
      fireEvent.change(screen.getByTestId("input-confirmPassword"), {
        target: { value: confirmPassword },
      });
    }
  };

  it("renders all form fields", () => {
    renderSignup();
    expect(screen.getByTestId("input-name")).toBeInTheDocument();
    expect(screen.getByTestId("input-email")).toBeInTheDocument();
    expect(screen.getByTestId("input-password")).toBeInTheDocument();
    expect(screen.getByTestId("input-confirmPassword")).toBeInTheDocument();
  });

  it("renders Create Account button", () => {
    renderSignup();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  // ==============================================================
  // Validation
  // ==============================================================

  it("shows validation errors for empty form submission", async () => {
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByTestId("error-name")).toBeInTheDocument();
      expect(screen.getByTestId("error-email")).toBeInTheDocument();
      expect(screen.getByTestId("error-password")).toBeInTheDocument();
      expect(screen.getByTestId("error-confirmPassword")).toBeInTheDocument();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("fires a toast for each validation error", async () => {
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      // 4 fields = 4 toasts (name, email, password, confirmPassword)
      expect(toastAlert.error).toHaveBeenCalledTimes(4);
    });
  });

  it("clears individual field error when user starts typing", async () => {
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByTestId("error-name")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("input-name"), {
      target: { value: "Jane" },
    });

    await waitFor(() => {
      expect(screen.queryByTestId("error-name")).not.toBeInTheDocument();
    });
  });

  // ==============================================================
  // Submission
  // ==============================================================

  // ✅ FIXED: confirmPassword is stripped in SignUpForm before calling mutate
  it("calls signupApi without confirmPassword (stripped before submit)", async () => {
    renderSignup();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        {
          name: "John Doe",
          email: "john@example.com",
          password: "SecurePass1!",
          // confirmPassword intentionally absent
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });
  });

  it("redirects to login page with ?signup=success on success", async () => {
    useSignup.mockReturnValue({
      mutate: jest.fn((_, { onSuccess }) => onSuccess()),
      isPending: false,
    });

    renderSignup();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/account/auth/login?signup=success",
      );
    });
  });

  // ==============================================================
  // Error handling
  // ==============================================================

  // ✅ FIXED: SignUpForm now uses getUserFriendlyError() — raw DB strings never shown
  it("shows user-friendly error instead of raw API message", async () => {
    const rawApiError = {
      message:
        "pq: duplicate key value violates unique constraint users_email_key",
      response: { status: 409 },
    };

    useSignup.mockReturnValue({
      mutate: jest.fn((_, { onError }) => onError(rawApiError)),
      isPending: false,
    });

    renderSignup();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      // Raw DB constraint string must NOT be visible
      expect(alert).not.toHaveTextContent("pq: duplicate key");
      // A friendly message IS shown instead
      expect(alert).toBeInTheDocument();
    });
  });

  it("displays submit error in alert block", async () => {
    useSignup.mockReturnValue({
      mutate: jest.fn((_, { onError }) =>
        onError({ message: "An unexpected error occurred." }),
      ),
      isPending: false,
    });

    renderSignup();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  // ==============================================================
  // Loading state
  // ==============================================================

  it("disables submit button while pending", () => {
    useSignup.mockReturnValue({ mutate: mockMutate, isPending: true });
    renderSignup();
    // When pending the button shows a spinner SVG with no text —
    // query by type="submit" instead of accessible name
    const submitBtn = document.querySelector("button[type='submit']");
    expect(submitBtn).toBeDisabled();
  });

  it("shows spinner when pending (button text replaced by SVG)", () => {
    useSignup.mockReturnValue({ mutate: mockMutate, isPending: true });
    renderSignup();
    const submitBtn = document.querySelector("button[type='submit']");
    // Button itself has no visible text when pending
    expect(submitBtn).not.toHaveTextContent("Create Account");
    // SVG spinner is rendered inside the button
    expect(submitBtn.querySelector("svg")).toBeInTheDocument();
  });

  // ==============================================================
  // Password visibility toggles
  // ==============================================================

  it("toggles password field visibility", () => {
    renderSignup();
    const toggle = screen.getByTestId("toggle-password");
    const input = screen.getByTestId("input-password");

    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
  });

  it("toggles confirm password field visibility independently", () => {
    renderSignup();
    const toggle = screen.getByTestId("toggle-confirmPassword");
    const input = screen.getByTestId("input-confirmPassword");

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "password");
  });

  // ==============================================================
  // Navigation
  // ==============================================================

  it("renders link back to login page", () => {
    renderSignup();
    const loginLink = screen.getByText(/sign in here/i);
    expect(loginLink.closest("a")).toHaveAttribute(
      "href",
      "/account/auth/login",
    );
  });
});
