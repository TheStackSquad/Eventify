// frontend/src/utils/helpers/errorParser.js

import { ERROR_MESSAGES } from "@/utils/constants/errorMessages";

export const parseReviewError = (error) => {
  if (!error) return ERROR_MESSAGES.GENERAL.UNEXPECTED;

  // Use optional chaining for safe access
  const errorMessage = error?.response?.data?.message || error?.message || "";
  const statusCode = error?.response?.status;

  if (
    statusCode === 409 ||
    errorMessage.toLowerCase().includes("already reviewed")
  ) {
    return ERROR_MESSAGES.REVIEW.DUPLICATE;
  }

  if (statusCode === 400) {
    if (errorMessage.toLowerCase().includes("rating")) {
      return ERROR_MESSAGES.REVIEW.INVALID_RATING;
    }
    if (errorMessage.toLowerCase().includes("required")) {
      return ERROR_MESSAGES.REVIEW.MISSING_FIELDS;
    }
    return errorMessage || ERROR_MESSAGES.REVIEW.MISSING_FIELDS;
  }

  
  if (statusCode === 403) {
    // Server/DB error messages often come through here (e.g., "unauthorized access to order")
    return errorMessage || ERROR_MESSAGES.REVIEW.SUBMISSION_FAILED;
  }

  // FIX: If 5xx (Server Error), return the specific server message if available.
  if (statusCode >= 500) {
    // This will capture DB errors rendered by the server as a 500/503
    return errorMessage || ERROR_MESSAGES.REVIEW.SUBMISSION_FAILED;
  }

  // --- 3. Network Errors ---
  if (error.code === "ERR_NETWORK" || error.message?.includes("Network")) {
    return ERROR_MESSAGES.REVIEW.NETWORK_ERROR;
  }

  // --- 4. Fallback ---
  return errorMessage || ERROR_MESSAGES.GENERAL.UNEXPECTED;
};

export const parseInquiryError = (error) => {
  if (!error) return ERROR_MESSAGES.GENERAL.UNEXPECTED;

  const errorMessage = error?.response?.data?.message || error?.message || "";
  const statusCode = error?.response?.status;

  if (statusCode === 409) {
    return ERROR_MESSAGES.INQUIRY.DUPLICATE;
  }

  if (error.code === "ERR_NETWORK") {
    return ERROR_MESSAGES.GENERAL.NETWORK;
  }

  return errorMessage || ERROR_MESSAGES.INQUIRY.SUBMISSION_FAILED;
};
