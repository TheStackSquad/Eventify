// frontend/src/utils/validate/contactValidate.js


const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Base review validation that can be used by multiple components
export const validateReview = (data, options = {}) => {
  const { requireUserInfo = true } = options;
  const errors = {};

  // User info validation (for non-authenticated users)
  if (requireUserInfo) {
    if (!(data.user_name || "").trim()) {
      errors.user_name = "Name is required";
    }

    const emailValue = (data.email || "").trim();
    if (!emailValue) {
      errors.email = "Email is required";
    } else if (!emailRegex.test(emailValue)) {
      errors.email = "Invalid email format";
    }
  }

  // Rating validation
  if (!data.rating || Number(data.rating) === 0) {
    errors.rating = "Please select a star rating";
  }

  // Review text validation
  const reviewValue = (data.comment || "").trim();
  if (!reviewValue) {
    errors.comment = "Please share your experience";
  } else if (reviewValue.length < 10) {
    errors.comment = "Review must be at least 10 characters";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Specific validation for contact form (kept separate but can be exported together)
const contactValidate = (data) => {
  const errors = {};

  if (!(data.name || "").trim()) {
    errors.name = "Please provide your name.";
  }

  const emailValue = (data.email || "").trim();
  if (!emailValue) {
    errors.email = "Email is required.";
  } else if (!emailRegex.test(emailValue)) {
    errors.email = "Please enter a valid email address.";
  }

  const messageValue = (data.message || "").trim();
  if (!messageValue) {
    errors.message = "Please include a message for the vendor.";
  } else if (messageValue.length < 10) {
    errors.message = "Message is too short (min 10 characters).";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Export everything from this validation module
export { contactValidate };
export default validateReview;
