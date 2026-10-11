// src/utils/validate/signupValidation.js

// ================================================================
// PASSWORD STRENGTH CHECKER
// ================================================================
function validatePasswordStrength(password) {
  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>\-_+=[\]\\/'`~]/.test(password);

  const characterTypes = [
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSpecial,
  ].filter(Boolean).length;

  if (characterTypes < 3) {
    return {
      isValid: false,
      message:
        "Password must contain at least 3 of: uppercase, lowercase, numbers, or special characters",
    };
  }

  const weakPatterns = [
    /^(.)\1+$/,
    /^(012|123|234|345|456|567|678|789|890)+/,
    /^(abc|bcd|cde|def|efg|fgh|ghi|hij)+/i,
    /password/i,
    /qwerty/i,
    /admin/i,
    /letmein/i,
  ];

  for (const pattern of weakPatterns) {
    if (pattern.test(password)) {
      return {
        isValid: false,
        message:
          "This password is too common. Please choose a stronger password",
      };
    }
  }

  return { isValid: true };
}

// ================================================================
// MAIN VALIDATION
// ================================================================
export const validateSignup = (formData) => {
  const errors = {};

  if (!formData.name || !formData.name.trim()) {
    errors.name = "Name is required";
  } else if (formData.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters";
  } else if (formData.name.trim().length > 100) {
    errors.name = "Name is too long (max 100 characters)";
  } else if (!/^[\p{L}\p{M}\s'\-]+$/u.test(formData.name.trim())) {
    errors.name =
      "Name can only contain letters, spaces, hyphens, and apostrophes";
  }

  if (!formData.email || !formData.email.trim()) {
    errors.email = "Email is required";
  } else {
    const email = formData.email.trim();
    const emailRegex = /^[^\s@]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(email)) {
      errors.email = "Please enter a valid email address";
    } else if (email.length > 254) {
      errors.email = "Email address is too long";
    }
  }

  // ============================================================
  // Password Validation
  // ============================================================
  if (!formData.password) {
    errors.password = "Password is required";
  } else {
    const passwordCheck = validatePasswordStrength(formData.password);
    if (!passwordCheck.isValid) {
      errors.password = passwordCheck.message;
    }
  }

  // ============================================================
  // Confirm Password Validation
  // ============================================================
  if (!formData.confirmPassword) {
    errors.confirmPassword = "Please confirm your password";
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return errors;
};

// ================================================================
// FIELD-LEVEL VALIDATION (used for real-time feedback)
// ================================================================
export const validateField = (fieldName, value, allFormData = {}) => {
  const tempData = { ...allFormData, [fieldName]: value };
  const errors = validateSignup(tempData);
  return errors[fieldName] || null;
};

// ================================================================
// PASSWORD STRENGTH METER
// ================================================================
export const getPasswordStrength = (password) => {
  if (!password) return { level: 0, label: "None", color: "gray" };
  if (password.length < 8)
    return { level: 1, label: "Too short", color: "red" };

  const checks = {
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>\-_+=[\]\\/'`~]/.test(password),
  };

  const typesCount = Object.values(checks).filter(Boolean).length;
  const length = password.length;

  if (typesCount === 4 && length >= 12)
    return { level: 5, label: "Very Strong", color: "green" };
  if (typesCount >= 3 && length >= 10)
    return { level: 4, label: "Strong", color: "green" };
  if (typesCount >= 3) return { level: 3, label: "Good", color: "yellow" };
  if (typesCount >= 2) return { level: 2, label: "Weak", color: "orange" };
  return { level: 1, label: "Very Weak", color: "red" };
};
