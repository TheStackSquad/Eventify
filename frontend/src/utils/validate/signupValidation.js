// src/utils/validate/signupValidation.js

function validatePasswordStrength(password) {
  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  // Check for different character types
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

  // Require at least 3 of 4 character types
  if (characterTypes < 3) {
    return {
      isValid: false,
      message:
        "Password must contain at least 3 of: uppercase, lowercase, numbers, or special characters",
    };
  }

  // Check for common weak patterns
  const weakPatterns = [
    /^(.)\1+$/, // All same character (e.g., "aaaaaaaa")
    /^(012|123|234|345|456|567|678|789|890)+/, // Sequential numbers
    /^(abc|bcd|cde|def|efg|fgh|ghi|hij)+/i, // Sequential letters
    /password/i, // Contains "password"
    /qwerty/i, // Contains "qwerty"
    /admin/i, // Contains "admin"
    /letmein/i, // Contains "letmein"
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

export const validateSignup = (formData) => {
  const errors = {};

  // ============================================
  // Name Validation
  // ============================================
  if (!formData.name || !formData.name.trim()) {
    errors.name = "Name is required";
  } else if (formData.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters";
  } else if (formData.name.trim().length > 100) {
    errors.name = "Name is too long (max 100 characters)";
  } else if (!/^[a-zA-Z\s'-]+$/.test(formData.name.trim())) {
    errors.name =
      "Name can only contain letters, spaces, hyphens, and apostrophes";
  }

  // ============================================
  // Email Validation
  // ============================================
  if (!formData.email || !formData.email.trim()) {
    errors.email = "Email is required";
  } else {
    // Remove leading/trailing whitespace
    const email = formData.email.trim();

    // More comprehensive email regex
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(email)) {
      errors.email = "Please enter a valid email address";
    } else if (email.length > 254) {
      // RFC 5321 max email length
      errors.email = "Email address is too long";
    }

    // Optional: Block disposable email domains (uncomment if needed)
    // const disposableDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
    // const domain = email.split('@')[1]?.toLowerCase();
    // if (disposableDomains.includes(domain)) {
    //   errors.email = "Please use a permanent email address";
    // }
  }

  // ============================================
  // Password Validation
  // ============================================
  if (!formData.password) {
    errors.password = "Password is required";
  } else {
    const passwordCheck = validatePasswordStrength(formData.password);
    if (!passwordCheck.isValid) {
      errors.password = passwordCheck.message;
    }
  }

  // ============================================
  // Confirm Password Validation
  // ============================================
  if (!formData.confirmPassword) {
    errors.confirmPassword = "Please confirm your password";
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return errors;
};

export const validateField = (fieldName, value, allFormData = {}) => {
  const tempData = { ...allFormData, [fieldName]: value };
  const errors = validateSignup(tempData);
  return errors[fieldName] || null;
};

export const getPasswordStrength = (password) => {
  if (!password) return { level: 0, label: "None", color: "gray" };

  if (password.length < 8) {
    return { level: 1, label: "Too short", color: "red" };
  }

  const checks = {
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>\-_+=[\]\\/'`~]/.test(password),
  };

  const typesCount = Object.values(checks).filter(Boolean).length;
  const length = password.length;

  if (typesCount === 4 && length >= 12) {
    return { level: 5, label: "Very Strong", color: "green" };
  } else if (typesCount >= 3 && length >= 10) {
    return { level: 4, label: "Strong", color: "green" };
  } else if (typesCount >= 3) {
    return { level: 3, label: "Good", color: "yellow" };
  } else if (typesCount >= 2) {
    return { level: 2, label: "Weak", color: "orange" };
  } else {
    return { level: 1, label: "Very Weak", color: "red" };
  }
};
