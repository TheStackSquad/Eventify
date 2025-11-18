// src/utils/loginUtils.js


export async function loginUser(axiosInstance, credentials) {
  const { email, password } = credentials;

  // Optional: Pre-API validation (for final security check, not just UX)
  if (
    typeof email !== "string" ||
    !email.includes("@") ||
    password.length < 6
  ) {
    return {
      success: false,
      message: "Validation error: Email or password format is incorrect.",
    };
  }

  // API endpoint for your Next.js server route
  const LOGIN_API_URL = "/api/auth/login";

  try {
    const response = await axiosInstance.post(LOGIN_API_URL, {
      email,
      password,
    });

    if (response.status === 200 && response.data.token) {
      // Success: Token is typically set as an HttpOnly cookie by the server,
      // but we might store minimal user info if needed for client state.
      // Note: The server is responsible for setting secure session cookies.

      return {
        success: true,
        user: { email: response.data.userEmail, name: response.data.userName },
      };
    } else {
      // Should not happen if the server correctly returns 4xx status for errors
      return {
        success: false,
        message:
          "An unexpected successful response received. Try clearing cookies.",
      };
    }
  } catch (error) {
    // --- Client-side Error Message Rendering Logic ---

    // Check if the error is an Axios response error (4xx, 5xx)
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        return {
          success: false,
          message: data.message || "Invalid email or password.",
        };
      }
      if (status === 429) {
        return {
          success: false,
          message: "Too many login attempts. Please try again later.",
        };
      }
      if (status >= 500) {
        // Do not expose internal server details
        return {
          success: false,
          message: "Server error. We are working on it.",
        };
      }
      return {
        success: false,
        message: data.message || `Login failed with status ${status}.`,
      };
    } else if (error.request) {
      // Request was made but no response received (e.g., server offline)
      return {
        success: false,
        message: "No response from server. Check your connection.",
      };
    } else {
      // Unexpected error (e.g., coding error in try block)
      return {
        success: false,
        message: "An application error occurred. See console for details.",
      };
    }
  }
}
