// src/utils/validate/loginValidation.js

export function validateLogin({ email, password }) {
  if (!email || !password) {
    return "Please enter both your email address and password.";
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address.";
  }

  // Ensure password meets minimum length (assuming 8 chars from the UserModel)
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  return null; // Validation passed
}
