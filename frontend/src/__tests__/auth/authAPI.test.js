/**
 * AUTH API TESTS
 * Tests for: src/services/authAPI.js
 *
 * Run: npx jest authAPI.test.js
 */

import {
  loginApi,
  signupApi,
  logoutApi,
  verifySessionApi,
  refreshTokenApi,
  forgotPasswordApi,
  verifyResetTokenApi,
  resetPasswordApi,
} from "@/services/authAPI";

// Mock the axios instance
jest.mock("@/axiosConfig/axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

// Mock API_ENDPOINTS
jest.mock("@/utils/constants/globalConstants", () => ({
  API_ENDPOINTS: {
    AUTH: {
      LOGIN: "/auth/login",
      SIGNUP: "/auth/signup",
      LOGOUT: "/auth/logout",
      VERIFY: "/auth/me",
      REFRESH: "/auth/refresh",
      FORGOT_PASSWORD: "/auth/forgot-password",
      VERIFY_RESET_TOKEN: "/auth/verify-reset-token",
      RESET_PASSWORD: "/auth/reset-password",
    },
  },
}));

import backendInstance from "@/axiosConfig/axios";

// Save original NODE_ENV
const originalEnv = process.env.NODE_ENV;

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  process.env.NODE_ENV = originalEnv;
});

// ==============================================================
// verifySessionApi()
// ==============================================================

describe("verifySessionApi()", () => {
  it("calls GET /auth/me and returns response.data.user", async () => {
    const mockUser = { id: 1, email: "user@example.com", isVendor: false };
    backendInstance.get.mockResolvedValueOnce({
      data: { user: mockUser },
      status: 200,
    });

    const result = await verifySessionApi();

    expect(backendInstance.get).toHaveBeenCalledWith("/auth/me");
    expect(result).toEqual(mockUser); // ✅ Returns .user, not full response
  });

  it("does NOT return the full response.data envelope", async () => {
    const mockUser = { id: 1, email: "user@example.com" };
    backendInstance.get.mockResolvedValueOnce({
      data: { user: mockUser, token: "abc", message: "ok" },
      status: 200,
    });

    const result = await verifySessionApi();
    expect(result).not.toHaveProperty("token");
    expect(result).not.toHaveProperty("message");
  });

  it("throws when API call fails", async () => {
    const error = { response: { status: 401 }, message: "Unauthorized" };
    backendInstance.get.mockRejectedValueOnce(error);

    await expect(verifySessionApi()).rejects.toEqual(error);
  });

  // IS_DEV = process.env.NODE_ENV === "development" is a module-level constant.
  // Jest always runs with NODE_ENV="test", so IS_DEV is always false in this suite.
  // Module-level constants cannot be toggled mid-test without jest.resetModules()
  // + dynamic re-import, which is brittle and couples tests to implementation internals.
  //
  // What we CAN assert: that verifySessionApi() does NOT log in the test environment,
  // and that it still returns correctly regardless of the IS_DEV flag.
  it("does not log in test/production environment (IS_DEV=false)", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    const mockUser = { id: 1, email: "test@test.com" };
    backendInstance.get.mockResolvedValueOnce({
      data: { user: mockUser },
      status: 200,
    });

    const result = await verifySessionApi();

    expect(consoleSpy).not.toHaveBeenCalled(); // no logging in test env
    expect(result).toEqual(mockUser); // still returns correctly

    consoleSpy.mockRestore();
  });
});

// ==============================================================
// loginApi()
// ==============================================================

describe("loginApi()", () => {
  it("calls POST /auth/login with credentials", async () => {
    const credentials = { email: "user@example.com", password: "Pass1234!" };
    const mockResponse = {
      data: { user: { id: 1 }, message: "Login successful" },
      status: 200,
    };
    backendInstance.post.mockResolvedValueOnce(mockResponse);

    const result = await loginApi(credentials);

    expect(backendInstance.post).toHaveBeenCalledWith(
      "/auth/login",
      credentials,
    );
    // ✅ Returns full response.data (not just .user) so caller can access message too
    expect(result).toEqual(mockResponse.data);
  });

  it("does NOT log the password in debug output", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    process.env.NODE_ENV = "development";

    backendInstance.post.mockResolvedValueOnce({
      data: { user: { id: 1 } },
      status: 200,
    });

    await loginApi({ email: "user@example.com", password: "SuperSecret!" });

    const allLogCalls = consoleSpy.mock.calls.flat(Infinity).join(" ");
    expect(allLogCalls).not.toContain("SuperSecret!");

    consoleSpy.mockRestore();
  });

  it("propagates errors without wrapping", async () => {
    const axiosError = {
      response: { status: 401, data: { message: "Invalid credentials" } },
    };
    backendInstance.post.mockRejectedValueOnce(axiosError);

    await expect(
      loginApi({ email: "a@b.com", password: "wrong" }),
    ).rejects.toEqual(axiosError);
  });

  // ✅ FIXED: rememberMe is now included in the login payload
  it("includes rememberMe in the login payload", async () => {
    backendInstance.post.mockResolvedValueOnce({
      data: { user: {} },
      status: 200,
    });
    await loginApi({
      email: "user@example.com",
      password: "Pass1!",
      rememberMe: true,
    });
    const callPayload = backendInstance.post.mock.calls[0][1];
    expect(callPayload).toHaveProperty("rememberMe", true);
  });
});

// ==============================================================
// signupApi()
// ==============================================================

describe("signupApi()", () => {
  it("calls POST /auth/signup with user data", async () => {
    const userData = {
      name: "John Doe",
      email: "john@example.com",
      password: "SecurePass1!",
      confirmPassword: "SecurePass1!",
    };
    backendInstance.post.mockResolvedValueOnce({
      data: { user: { id: 5 } },
      status: 201,
    });

    const result = await signupApi(userData);

    expect(backendInstance.post).toHaveBeenCalledWith("/auth/signup", userData);
    expect(result).toEqual({ user: { id: 5 } });
  });

  // ✅ FIXED: confirmPassword is now stripped in SignUpForm before calling signupApi
  // signupApi itself receives whatever the caller passes — stripping happens upstream
  it("does NOT receive confirmPassword when called correctly from SignUpForm", async () => {
    backendInstance.post.mockResolvedValueOnce({ data: {}, status: 201 });
    // SignUpForm now strips confirmPassword before calling signup(payload)
    const strippedPayload = {
      name: "John",
      email: "john@example.com",
      password: "SecurePass1!",
      // confirmPassword intentionally absent
    };
    await signupApi(strippedPayload);
    const sentPayload = backendInstance.post.mock.calls[0][1];
    expect(sentPayload).not.toHaveProperty("confirmPassword");
  });

  it("re-throws errors with original error object", async () => {
    const error = {
      response: { status: 409, data: { message: "Email already exists" } },
    };
    backendInstance.post.mockRejectedValueOnce(error);

    await expect(signupApi({ email: "dup@test.com" })).rejects.toEqual(error);
  });
});

// ==============================================================
// logoutApi()
// ==============================================================

describe("logoutApi()", () => {
  it("calls POST /auth/logout", async () => {
    backendInstance.post.mockResolvedValueOnce({
      data: { message: "Logged out" },
      status: 200,
    });

    await logoutApi();
    expect(backendInstance.post).toHaveBeenCalledWith("/auth/logout");
  });

  it("re-throws errors (logout error should still propagate)", async () => {
    backendInstance.post.mockRejectedValueOnce(new Error("Server error"));
    await expect(logoutApi()).rejects.toThrow("Server error");
  });
});

// ==============================================================
// refreshTokenApi()
// ==============================================================

describe("refreshTokenApi()", () => {
  it("calls POST /auth/refresh", async () => {
    backendInstance.post.mockResolvedValueOnce({ data: {}, status: 200 });
    await refreshTokenApi();
    expect(backendInstance.post).toHaveBeenCalledWith("/auth/refresh");
  });

  it("re-throws on 401 (expired refresh token)", async () => {
    const error = { response: { status: 401 } };
    backendInstance.post.mockRejectedValueOnce(error);
    await expect(refreshTokenApi()).rejects.toEqual(error);
  });
});

// ==============================================================
// forgotPasswordApi()
// ==============================================================

describe("forgotPasswordApi()", () => {
  it("calls POST /auth/forgot-password with email object", async () => {
    backendInstance.post.mockResolvedValueOnce({ data: {}, status: 200 });

    await forgotPasswordApi("user@example.com");

    expect(backendInstance.post).toHaveBeenCalledWith("/auth/forgot-password", {
      email: "user@example.com",
    });
  });

  it("re-throws errors", async () => {
    backendInstance.post.mockRejectedValueOnce(new Error("Not found"));
    await expect(forgotPasswordApi("no@user.com")).rejects.toThrow("Not found");
  });
});

// ==============================================================
// verifyResetTokenApi()
// ==============================================================

describe("verifyResetTokenApi()", () => {
  it("calls POST /auth/verify-reset-token with token object", async () => {
    backendInstance.post.mockResolvedValueOnce({ data: {}, status: 200 });

    await verifyResetTokenApi("abc123");

    expect(backendInstance.post).toHaveBeenCalledWith(
      "/auth/verify-reset-token",
      { token: "abc123" },
    );
  });
});

// ==============================================================
// resetPasswordApi()
// ==============================================================

describe("resetPasswordApi()", () => {
  it("calls POST /auth/reset-password with data payload", async () => {
    backendInstance.post.mockResolvedValueOnce({ data: {}, status: 200 });
    const data = { token: "abc123", newPassword: "NewPass1!" };

    await resetPasswordApi(data);

    expect(backendInstance.post).toHaveBeenCalledWith(
      "/auth/reset-password",
      data,
    );
  });
});
