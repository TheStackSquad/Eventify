/**
 * ERROR UTILITIES TESTS
 * Tests for: src/utils/errors/errorUtils.js
 *
 * Run: npx jest errorUtils.test.js
 */

import {
  getUserFriendlyError,
  isNetworkError,
  isAuthError,
  isRateLimitError,
  getRetryMessage,
} from "@/utils/errors/errorUtils";

// ==============================================================
// getUserFriendlyError()
// ==============================================================

describe("getUserFriendlyError()", () => {
  it("returns default message for null input", () => {
    expect(getUserFriendlyError(null)).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("returns custom default message when provided", () => {
    expect(getUserFriendlyError(null, "Custom fallback")).toBe(
      "Custom fallback",
    );
  });

  it("handles plain string errors", () => {
    expect(getUserFriendlyError("Network Error")).toBe(
      "Unable to connect. Please check your internet connection.",
    );
  });

  it("handles axios error with response.data.message", () => {
    const axiosError = {
      response: { data: { message: "Invalid credentials" }, status: 401 },
    };
    expect(getUserFriendlyError(axiosError)).toBe(
      "The email or password you entered is incorrect.",
    );
  });

  it("handles axios error with response.data.error", () => {
    const axiosError = {
      response: { data: { error: "User not found" }, status: 404 },
    };
    expect(getUserFriendlyError(axiosError)).toBe(
      "No account exists with this email address.",
    );
  });

  it("handles axios error with just error.message", () => {
    const error = { message: "Network Error" };
    expect(getUserFriendlyError(error)).toBe(
      "Unable to connect. Please check your internet connection.",
    );
  });

  it("falls back to status code mapping", () => {
    const error = {
      response: { status: 500, data: {} },
      message: "Request failed with status code 500",
    };
    // The message won't match "500" exactly — it will try partial match
    // This tests the partial match path
    const result = getUserFriendlyError(error);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns default when no mapping found", () => {
    const error = { message: "some completely unknown error xyz987" };
    expect(getUserFriendlyError(error)).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("handles case-insensitive partial match", () => {
    const error = { message: "INVALID CREDENTIALS for this user" };
    expect(getUserFriendlyError(error)).toBe(
      "The email or password you entered is incorrect.",
    );
  });

  it("handles 429 rate limit by status code string", () => {
    // Note: status code matching only works if errorMessage resolves to "429"
    // It gets there via: error.response.status.toString() when no message present
    const error = {
      response: { status: 429, data: {} },
      message: "",
    };
    const result = getUserFriendlyError(error);
    // message is "", so it falls to status code check
    expect(result).toContain("too many");
  });

  // ⚠️ EDGE CASE: 401 status with a message that doesn't match any key
  it("uses default message for unmapped 401 with generic message", () => {
    const error = {
      response: { status: 401, data: { message: "access_denied_xyz" } },
      message: "Request failed",
    };
    const result = getUserFriendlyError(
      error,
      "Unable to log you in. Please check your credentials and try again.",
    );
    expect(result).toBe(
      "Unable to log you in. Please check your credentials and try again.",
    );
  });
});

// ==============================================================
// isNetworkError()
// ==============================================================

describe("isNetworkError()", () => {
  it("returns false for null", () => {
    expect(isNetworkError(null)).toBe(false);
  });

  it("detects 'Network Error' in message", () => {
    expect(isNetworkError({ message: "Network Error" })).toBe(true);
  });

  it("detects ECONNABORTED (timeout)", () => {
    expect(isNetworkError({ code: "ECONNABORTED", message: "" })).toBe(true);
  });

  it("detects ENOTFOUND (DNS failure)", () => {
    expect(isNetworkError({ code: "ENOTFOUND", message: "" })).toBe(true);
  });

  it("detects ECONNREFUSED", () => {
    expect(isNetworkError({ code: "ECONNREFUSED", message: "" })).toBe(true);
  });

  it("returns false for a 401 auth error", () => {
    expect(
      isNetworkError({
        response: { status: 401 },
        message: "Request failed with status code 401",
      }),
    ).toBe(false);
  });

  it("returns false for a 500 server error", () => {
    expect(
      isNetworkError({
        response: { status: 500 },
        message: "Request failed with status code 500",
      }),
    ).toBe(false);
  });
});

// ==============================================================
// isAuthError()
// ==============================================================

describe("isAuthError()", () => {
  it("returns false for null", () => {
    expect(isAuthError(null)).toBe(false);
  });

  it("detects 401 status", () => {
    expect(isAuthError({ response: { status: 401 } })).toBe(true);
  });

  it("detects 403 status", () => {
    expect(isAuthError({ response: { status: 403 } })).toBe(true);
  });

  it("detects 'unauthorized' in message (case insensitive)", () => {
    expect(isAuthError({ message: "Unauthorized access" })).toBe(true);
  });

  it("detects 'invalid token' in message", () => {
    expect(isAuthError({ message: "invalid token provided" })).toBe(true);
  });

  it("returns false for network error", () => {
    expect(
      isAuthError({ message: "Network Error", code: "ECONNABORTED" }),
    ).toBe(false);
  });
});

// ==============================================================
// isRateLimitError()
// ==============================================================

describe("isRateLimitError()", () => {
  it("detects 429 status", () => {
    expect(isRateLimitError({ response: { status: 429 } })).toBe(true);
  });

  it("detects 'too many requests' in message", () => {
    expect(isRateLimitError({ message: "Too many requests" })).toBe(true);
  });

  it("returns false for auth error", () => {
    expect(isRateLimitError({ response: { status: 401 } })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isRateLimitError(null)).toBe(false);
  });
});

// ==============================================================
// getRetryMessage()
// ==============================================================

describe("getRetryMessage()", () => {
  it("gives network-specific retry message", () => {
    expect(getRetryMessage({ message: "Network Error" })).toContain("internet");
  });

  it("gives rate limit-specific retry message", () => {
    expect(getRetryMessage({ response: { status: 429 } })).toContain("wait");
  });

  it("gives auth-specific retry message", () => {
    expect(getRetryMessage({ response: { status: 401 } })).toContain(
      "credentials",
    );
  });

  it("gives generic message for unknown error", () => {
    expect(getRetryMessage({ response: { status: 500 }, message: "" })).toBe(
      "Please try again in a moment.",
    );
  });
});
