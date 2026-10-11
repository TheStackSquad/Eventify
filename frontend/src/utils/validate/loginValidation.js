// src/utils/validate/loginValidation.js

export function validateLogin({ email, password }) {
  // Both fields required
  if (!email || !email.trim()) {
    return "Please enter your email address.";
  }

  if (!password) {
    return "Please enter your password.";
  }

  // Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return "Please enter a valid email address.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (password.length > 128) {
    return "Password is too long.";
  }

  if (email.trim().length > 254) {
    return "Email address is too long.";
  }

  return null;
}
