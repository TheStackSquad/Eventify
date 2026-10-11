// frontend/src/utils/validate/vendorValidate.js

export const vendorRegistrationValidate = (formData, isEditMode = false) => {
  const errors = {};

  // ========== BUSINESS NAME ==========
  if (!formData.name?.trim()) {
    errors.name = "Business name is required";
  } else if (formData.name.trim().length < 3) {
    errors.name = "Business name must be at least 3 characters";
  }

  // ========== IDENTITY NAMES ==========
  // Skip if already verified in edit mode
  if (!(isEditMode && formData.isIdentityVerified)) {
    if (!formData.firstName?.trim()) {
      errors.firstName = "First name is required";
    }
    if (!formData.lastName?.trim()) {
      errors.lastName = "Last name is required";
    }
  }

  // ========== vNIN ==========
  // Skip entirely in edit mode (read-only)
  if (!isEditMode) {
    if (!formData.vnin?.trim()) {
      errors.vnin = "Identity verification (vNIN) is mandatory";
    } else {
      const cleanedVnin = formData.vnin.replace(/[^A-Z0-9]/gi, "");
      const vninRegex = /^[A-Z]{2}\d{12}[A-Z]{2}$/i;
      if (cleanedVnin.length !== 16 || !vninRegex.test(cleanedVnin)) {
        errors.vnin = "Invalid vNIN format (expected 16 characters)";
      }
    }
  }

  // ========== CAC NUMBER ==========
  // Skip if already verified in edit mode
  if (!(isEditMode && formData.isBusinessVerified)) {
    if (formData.cacNumber?.trim()) {
      const cleanedCac = formData.cacNumber.replace(/[^A-Z0-9]/gi, "");
      const cacRegex = /^(RC|BN|IT)\d{5,8}$/i;
      if (!cacRegex.test(cleanedCac)) {
        errors.cacNumber = "Invalid CAC. Format: RC123456 or BN123456";
      }
    }
  }

  // ========== CATEGORY & STATE ==========
  if (!formData.category) {
    errors.category = "Please select a service category";
  }
  if (!formData.state) {
    errors.state = "Please select your primary state";
  }

  // ========== PHONE NUMBER ==========
  if (!formData.phoneNumber?.trim()) {
    errors.phoneNumber = "Phone number is required";
  } else {
    const cleanedPhone = formData.phoneNumber.replace(/\D/g, "");
    const isValid =
      (cleanedPhone.length === 11 && cleanedPhone.startsWith("0")) ||
      (cleanedPhone.length === 10 && /^[789]/.test(cleanedPhone)) ||
      (cleanedPhone.length === 13 && cleanedPhone.startsWith("234"));

    if (!isValid) {
      errors.phoneNumber = "Invalid Nigerian phone number format";
    }
  }

  // ========== MINIMUM PRICE ==========
  const price = parseInt(formData.minPrice, 10);
  if (!formData.minPrice || isNaN(price)) {
    errors.minPrice = "Starting price must be a valid number";
  } else if (price < 1000) {
    errors.minPrice = "Minimum price is ₦1,000";
  }

  // ========== IMAGE ==========
  if (!isEditMode && !formData.imageURL) {
    errors.imageURL = "Business image is required";
  }

  // ========== DESCRIPTION ==========
  if (formData.description && formData.description.length > 500) {
    errors.description = "Description must not exceed 500 characters";
  }

  return errors;
};

// Validate individual field

export const validateVendorField = (fieldName, value, isEditMode = false) => {
  const cleaned = value?.toString().trim() || "";

  switch (fieldName) {
    case "vnin":
      // Skip in edit mode
      if (isEditMode) return null;
      if (!cleaned) return "vNIN is mandatory";
      const vninClean = cleaned.replace(/[^A-Z0-9]/gi, "");
      if (vninClean.length !== 16) return "vNIN must be 16 characters";
      return null;

    case "cacNumber":
      // Skip if verified in edit mode
      if (isEditMode) return null;
      if (!cleaned) return null; // CAC is optional
      const cacClean = cleaned.replace(/[^A-Z0-9]/gi, "");
      if (!/^(RC|BN|IT)\d{5,8}$/i.test(cacClean)) return "Invalid CAC format";
      return null;

    case "phoneNumber":
      if (!cleaned) return "Required";
      const phoneClean = cleaned.replace(/\D/g, "");
      if (phoneClean.length < 10 || phoneClean.length > 13) {
        return "Invalid number";
      }
      return null;

    case "firstName":
    case "lastName":
    case "name":
      if (!cleaned) return "This field is required";
      if (cleaned.length < 2) return "Too short";
      return null;

    case "minPrice":
      const price = parseInt(cleaned, 10);
      if (isNaN(price)) return "Must be a number";
      if (price < 1000) return "Minimum is ₦1,000";
      return null;

    case "description":
      if (cleaned.length > 500) return "Max 500 characters";
      return null;

    default:
      return null;
  }
};

export const hasValidationErrors = (errors) => Object.keys(errors).length > 0;
