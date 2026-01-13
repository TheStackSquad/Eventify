// frontend/src/components/onboarding/feedback/utils/validation.js
export const validateFeedback = (formData) => {
  const errors = {};

  // Name validation
  if (!formData.name?.trim()) {
    errors.name = "Name is required";
  } else if (formData.name.length < 2) {
    errors.name = "Name must be at least 2 characters";
  } else if (formData.name.length > 50) {
    errors.name = "Name must be less than 50 characters";
  }

  // Email validation
  if (!formData.email?.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    errors.email = "Please enter a valid email address";
  } else if (formData.email.length > 100) {
    errors.email = "Email is too long";
  }

  // Type validation
  const validTypes = ["suggestion", "complaint", "feedback"];
  if (!formData.type || !validTypes.includes(formData.type)) {
    errors.type = "Please select a valid feedback type";
  }

  // Message validation
  if (!formData.message?.trim()) {
    errors.message = "Message is required";
  } else if (formData.message.length < 10) {
    errors.message = "Please provide more details (minimum 10 characters)";
  } else if (formData.message.length > 1000) {
    errors.message = "Message must be less than 1000 characters";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateImageFile = (file) => {
  const errors = {};

  if (!file) return { isValid: true, errors }; // Image is optional

  // File type validation
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    errors.fileType = "Only JPG, PNG, WebP, and GIF images are allowed";
  }

  // File size validation (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    errors.fileSize = "Image size must be less than 5MB";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
