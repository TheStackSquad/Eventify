// frontend/src/utils/constants/errorMessages.js

export const ERROR_MESSAGES = {
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
  GENERAL: {
    UNEXPECTED: "Something went wrong. Please try again.",
    NETWORK: "Connection error. Please check your internet.",
  },
};

export const SUCCESS_MESSAGES = {
  REVIEW: {
    SUBMITTED:
      "Thank you! Your review has been submitted.",
    APPROVED: "Review approved successfully",
  },
  INQUIRY: {
    SUBMITTED:
      "Thank you! We've received your inquiry. The vendor will contact you soon.",
  },
};
