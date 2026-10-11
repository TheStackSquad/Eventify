// frontend/src/utils/constants/errorMessages.js

export const ERROR_MESSAGES = {
  AUTH: {
    REQUIRED: "Authentication required. Please log in to continue.",
    LOGIN_FAILED: "Invalid email or password. Please try again.",
    SESSION_EXPIRED: "Your session has expired. Please log in again.",
  },
  EVENTS: {
    CREATE_FAILED: "Failed to create event",
    UPDATE_FAILED: "Failed to update event",
    DELETE_FAILED: "Failed to delete event",
    FETCH_LIST_FAILED: "Failed to fetch events",
    FETCH_SINGLE_FAILED: "Failed to fetch event",
    ANALYTICS_FAILED: "Analytics failed",
  },
  VENDORS: {
    FETCH_LIST_FAILED: "Failed to fetch vendors list",
    FETCH_PROFILE_FAILED: "Failed to load vendor profile.",
    REGISTER_FAILED: "Failed to complete vendor registration.",
    UPDATE_FAILED: "Failed to update vendor profile.",
  },
  REVIEW: {
    DUPLICATE: "You've already reviewed this vendor",
    INVALID_RATING: "Please select a rating between 1 and 5 stars",
    MISSING_FIELDS: "Please fill in all required fields",
    INVALID_EMAIL: "Please enter a valid email address",
    COMMENT_TOO_SHORT: "Please write a few words about your experience",
    COMMENT_TOO_LONG:
      "Your review is too long. Please keep it under 500 characters",
    SUBMISSION_FAILED:
      "We couldn't submit your review right now. Please try again.",
    NETWORK_ERROR: "Network error. Please check your connection and try again.",
  },
  INQUIRY: {
    DUPLICATE: "You've already contacted this vendor",
    SUBMISSION_FAILED: "Failed to send inquiry. Please try again.",
  },
  FEEDBACK: {
    SUBMIT_FAILED: "Failed to submit feedback. Please try again.",
    DELETE_FAILED: "Failed to delete feedback. Please try again.",
    FETCH_FAILED: "Failed to fetch feedback. Please try again.",
  },
  GENERAL: {
    UNEXPECTED: "Something went wrong. Please try again.",
    NETWORK_ERROR: "Network error. Please check your connection.",
    SERVER_ERROR: "Server error. Please try again later.",
    UNKNOWN_ERROR: "An unexpected error occurred.",
  },
};

export const SUCCESS_MESSAGES = {
  EVENTS: {
    CREATED: "🎉 Event created successfully!",
    UPDATED: "🎉 Event updated successfully!",
    DELETED: "Event deleted successfully!",
    PUBLISHED: "Event published successfully!",
  },
  VENDORS: {
    REGISTERED: "Vendor registration submitted successfully!",
  },
  REVIEW: {
    SUBMITTED: "Thank you! Your review has been submitted.",
    APPROVED: "Review approved successfully",
  },
  INQUIRY: {
    SUBMITTED:
      "Thank you! We've received your inquiry. The vendor will contact you soon.",
  },
  FEEDBACK: {
    SUBMITTED: "Thank you for your feedback! We'll review it shortly.",
    DELETED: "Feedback deleted successfully.",
  },
  ADMIN: {
    IDENTITY_VERIFIED: "Vendor identity verification status updated.",
    BUSINESS_VERIFIED: "Vendor business verification status updated.",
    VENDOR_DELETED: "Vendor permanently removed from the platform.",
  },
};

const ERROR_PATTERNS = {
  // Database constraint errors
  DUPLICATE_KEY: /duplicate key value violates unique constraint/i,
  FOREIGN_KEY: /violates foreign key constraint/i,
  NULL_CONSTRAINT: /violates not-null constraint/i,
  CHECK_CONSTRAINT: /violates check constraint/i,
  
  // SQL State codes
  SQLSTATE_UNIQUE: /SQLSTATE 23505/i,
  SQLSTATE_FOREIGN_KEY: /SQLSTATE 23503/i,
  SQLSTATE_NULL: /SQLSTATE 23502/i,
  
  // Specific constraint names (from your schema)
  REVIEW_DUPLICATE: /idx_reviews_one_per_user_vendor/i,
  INQUIRY_DUPLICATE: /idx_unique_vendor_user_inquiry/i,
  EMAIL_DUPLICATE: /idx_users_email|users_email_key/i,
  
  // Validation errors
  INVALID_EMAIL: /invalid email|email.*invalid/i,
  INVALID_PHONE: /invalid phone|phone.*invalid/i,
  INVALID_FORMAT: /invalid format|malformed/i,
  
  // Network errors
  NETWORK_TIMEOUT: /timeout|ECONNABORTED/i,
  NETWORK_ERROR: /Network Error|ERR_NETWORK/i,
  CONNECTION_REFUSED: /ECONNREFUSED/i,
  
  // Auth errors
  TOKEN_EXPIRED: /token.*expired|jwt.*expired/i,
  INVALID_TOKEN: /invalid.*token|token.*invalid/i,
  UNAUTHORIZED: /unauthorized|not authorized/i,
  
  // Rate limiting
  RATE_LIMITED: /rate limit|too many requests/i,
  
  // Server errors
  INTERNAL_SERVER: /internal server error/i,
  SERVICE_UNAVAILABLE: /service unavailable/i,
};

const USER_FRIENDLY_MESSAGES = {
  // Review-specific
  REVIEW_DUPLICATE: {
    title: "Already Reviewed",
    message: "You've already submitted a review for this vendor.",
    suggestion: "Each user can only review a vendor once. Thank you for your feedback!",
    icon: "✅",
    severity: "info",
  },
  
  // Inquiry-specific
  INQUIRY_DUPLICATE: {
    title: "Inquiry Already Sent",
    message: "You've already sent an inquiry to this vendor.",
    suggestion: "Please wait for the vendor to respond to your previous message.",
    icon: "📨",
    severity: "info",
  },
  
  // Email duplicate
  EMAIL_DUPLICATE: {
    title: "Email Already Registered",
    message: "An account with this email already exists.",
    suggestion: "Try logging in instead, or use a different email address.",
    icon: "📧",
    severity: "warning",
  },
  
  // Validation errors
  INVALID_EMAIL: {
    title: "Invalid Email",
    message: "The email address you entered is not valid.",
    suggestion: "Please check the format and try again (e.g., name@example.com).",
    icon: "✉️",
    severity: "warning",
  },
  
  INVALID_PHONE: {
    title: "Invalid Phone Number",
    message: "The phone number format is incorrect.",
    suggestion: "Please use the format: +234 800 000 0000",
    icon: "📱",
    severity: "warning",
  },
  
  // Network errors
  NETWORK_TIMEOUT: {
    title: "Connection Timeout",
    message: "The request took too long to complete.",
    suggestion: "Please check your internet connection and try again.",
    icon: "⏱️",
    severity: "error",
  },
  
  NETWORK_ERROR: {
    title: "Network Error",
    message: "Unable to connect to our servers.",
    suggestion: "Please check your internet connection and try again.",
    icon: "📡",
    severity: "error",
  },
  
  // Auth errors
  TOKEN_EXPIRED: {
    title: "Session Expired",
    message: "Your login session has expired.",
    suggestion: "Please log in again to continue.",
    icon: "🔐",
    severity: "warning",
  },
  
  UNAUTHORIZED: {
    title: "Authorization Required",
    message: "You need to be logged in to perform this action.",
    suggestion: "Please log in and try again.",
    icon: "🔒",
    severity: "warning",
  },
  
  // Rate limiting
  RATE_LIMITED: {
    title: "Too Many Requests",
    message: "You're performing actions too quickly.",
    suggestion: "Please wait a moment before trying again.",
    icon: "⏳",
    severity: "warning",
  },
  
  // Server errors
  INTERNAL_SERVER: {
    title: "Server Error",
    message: "Our servers encountered an issue.",
    suggestion: "We're working on it. Please try again in a moment.",
    icon: "⚙️",
    severity: "error",
  },
  
  // Default fallback
  UNKNOWN: {
    title: "Something Went Wrong",
    message: "We encountered an unexpected error.",
    suggestion: "Please try again or contact support if the problem persists.",
    icon: "⚠️",
    severity: "error",
  },
};

export function parseError(error) {
  // Extract error message from various possible locations
  const errorMessage = 
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    String(error);

  // Check each pattern
  for (const [key, pattern] of Object.entries(ERROR_PATTERNS)) {
    if (pattern.test(errorMessage)) {
      const friendlyError = USER_FRIENDLY_MESSAGES[key];
      if (friendlyError) {
        return {
          ...friendlyError,
          originalError: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          errorCode: key,
        };
      }
    }
  }

  // HTTP status code fallbacks
  const status = error?.response?.status;
  if (status === 409) {
    return USER_FRIENDLY_MESSAGES.REVIEW_DUPLICATE;
  }
  if (status === 401) {
    return USER_FRIENDLY_MESSAGES.UNAUTHORIZED;
  }
  if (status === 429) {
    return USER_FRIENDLY_MESSAGES.RATE_LIMITED;
  }
  if (status >= 500) {
    return USER_FRIENDLY_MESSAGES.INTERNAL_SERVER;
  }

  // Default fallback
  return {
    ...USER_FRIENDLY_MESSAGES.UNKNOWN,
    originalError: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    errorCode: 'UNKNOWN',
  };
}

export function getErrorMessage(error) {
  const parsed = parseError(error);
  return parsed.message;
}

export function getErrorDetails(error) {
  return parseError(error);
}