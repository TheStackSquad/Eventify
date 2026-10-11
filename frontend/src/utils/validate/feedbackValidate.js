//frontend/src/utils/validate/feedbackValidate.js
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the feedback form data.
 * @param {object} data - The form data ({ name, email, type, message })
 * @returns {{isValid: boolean, errors: object}}
 */
export const feedbackValidate = (data) => {
  const errors = {};

  // Ensure data.name is a string before trimming
  if (!(data.name || "").trim()) {
    errors.name = "Name is required.";
  }

  // Ensure data.email is a string before trimming and checking format
  const emailValue = (data.email || "").trim();
  if (!emailValue) {
    errors.email = "Email is required.";
  } else if (!emailRegex.test(emailValue)) {
    errors.email = "Invalid email format.";
  }

  // Ensure data.message is a string before trimming and checking length
  const messageValue = (data.message || "").trim();
  if (!messageValue) {
    errors.message = "Message is required.";
  } else if (messageValue.length < 10) {
    errors.message = "Message must be at least 10 characters long.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export default feedbackValidate;