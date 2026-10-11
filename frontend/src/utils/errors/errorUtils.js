// src/utils/errors/errorUtils.js

const ERROR_MESSAGES = {

  // Network & Connection Errors
  "Network Error": "Unable to connect. Please check your internet connection.",
  ERR_NETWORK: "Connection lost. Please check your internet and try again.",
  ERR_CONNECTION_REFUSED: "Cannot reach the server. Please try again later.",
  timeout: "The request took too long. Please try again.",
  ERR_TIMED_OUT: "Request timed out. Please check your connection.",

  // Authentication Errors
  "Invalid credentials": "The email or password you entered is incorrect.",
  "User not found": "No account exists with this email address.",
  "Email already exists":
    "This email is already registered. Try logging in instead.",
  "Email already in use":
    "This email is already registered. Try logging in instead.",
  "Invalid token": "Your session has expired. Please log in again.",
  "Token expired": "Your session has expired. Please log in again.",
  Unauthorized: "Please log in to continue.",
  "Invalid email or password":
    "The email or password you entered is incorrect.",
  "Account locked": "Your account has been locked. Please contact support.",
  "Account not verified": "Please verify your email address before logging in.",

  // Validation Errors

  "Email is required": "Please enter your email address.",
  "Password is required": "Please enter your password.",
  "Name is required": "Please enter your name.",
  "Invalid email format": "Please enter a valid email address.",
  "Password too short": "Your password must be at least 8 characters long.",
  "Passwords do not match": "The passwords you entered don't match.",
  "Weak password":
    "Please choose a stronger password with uppercase, lowercase, and numbers.",

  // Server Errors

  "Internal server error": "Something went wrong on our end. Please try again.",
  "Service unavailable":
    "Our service is temporarily unavailable. Please try again soon.",
  "Bad gateway": "We're experiencing technical difficulties. Please try again.",
  500: "Something went wrong on our end. Please try again.",
  502: "We're experiencing technical difficulties. Please try again.",
  503: "Our service is temporarily unavailable. Please try again soon.",
  504: "The request took too long. Please try again.",

  // Rate Limiting

  "Too many requests":
    "You've made too many attempts. Please wait a moment and try again.",
  "Rate limit exceeded":
    "You've made too many attempts. Please wait a moment and try again.",
  429: "You've made too many attempts. Please wait a moment and try again.",

  // Generic Fallbacks
  "Login failed":
    "Unable to log you in. Please check your credentials and try again.",
  "Signup failed": "Unable to create your account. Please try again.",
  "An unexpected error occurred":
    "Something unexpected happened. Please try again.",
  "Something went wrong": "Something unexpected happened. Please try again.",
};

export function getUserFriendlyError(
  error,
  defaultMessage = "Something went wrong. Please try again.",
) {
  if (!error) return defaultMessage;

  // Extract error message from various error formats
  let errorMessage = "";

  if (typeof error === "string") {
    errorMessage = error;
  } else if (error.response?.data?.message) {
    errorMessage = error.response.data.message;
  } else if (error.response?.data?.error) {
    errorMessage = error.response.data.error;
  } else if (error.message) {
    errorMessage = error.message;
  } else if (error.response?.status) {
    errorMessage = error.response.status.toString();
  }

  // Check for exact match first
  if (ERROR_MESSAGES[errorMessage]) {
    return ERROR_MESSAGES[errorMessage];
  }

  // Check for partial match (case-insensitive)
  const lowerErrorMsg = errorMessage.toLowerCase();
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (lowerErrorMsg.includes(key.toLowerCase())) {
      return value;
    }
  }

  // Return default message if no match found
  return defaultMessage;
}

export function isNetworkError(error) {
  if (!error) return false;

  const errorMessage = error.message || "";
  const errorCode = error.code || "";

  return (
    errorMessage.includes("Network Error") ||
    errorMessage.includes("ERR_NETWORK") ||
    errorMessage.includes("ERR_CONNECTION_REFUSED") ||
    errorCode === "ECONNABORTED" ||
    errorCode === "ENOTFOUND" ||
    errorCode === "ECONNREFUSED"
  );
}

export function isAuthError(error) {
  if (!error) return false;

  const statusCode = error.response?.status;
  const errorMessage = (error.message || "").toLowerCase();

  return (
    statusCode === 401 ||
    statusCode === 403 ||
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("invalid credentials") ||
    errorMessage.includes("invalid token")
  );
}

export function isRateLimitError(error) {
  if (!error) return false;

  const statusCode = error.response?.status;
  const errorMessage = (error.message || "").toLowerCase();

  return (
    statusCode === 429 ||
    errorMessage.includes("too many requests") ||
    errorMessage.includes("rate limit")
  );
}

export function getRetryMessage(error) {
  if (isNetworkError(error)) {
    return "Check your internet connection and try again.";
  }

  if (isRateLimitError(error)) {
    return "Please wait a moment before trying again.";
  }

  if (isAuthError(error)) {
    return "Please check your credentials and try again.";
  }

  return "Please try again in a moment.";
}
