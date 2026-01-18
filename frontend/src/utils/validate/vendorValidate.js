// frontend/src/utils/validate/vendorValidate.js

export const vendorRegistrationValidate = (formData, isEditMode = false) => {
  const errors = {};

  // ========== BUSINESS NAME (CAC NAME) ==========
  if (!formData.name?.trim()) {
    errors.name = "Business name is required";
  } else if (formData.name.trim().length < 3) {
    errors.name = "Business name must be at least 3 characters";
  }

  // ========== IDENTITY NAMES (NIMC) ==========
  if (!formData.firstName?.trim()) errors.firstName = "First name is required";
  if (!formData.lastName?.trim()) errors.lastName = "Last name is required";

  // ========== vNIN (Virtual NIN) ==========
  if (!formData.vnin?.trim()) {
    errors.vnin = "Identity verification (vNIN) is mandatory";
  } else {
    // 16 chars: 2 letters, 12 digits, 2 letters (e.g., JZ-426633988976-CH)
    const cleanedVnin = formData.vnin.replace(/[^A-Z0-9]/gi, "");
    const vninRegex = /^[A-Z]{2}\d{12}[A-Z]{2}$/i;

    if (cleanedVnin.length !== 16 || !vninRegex.test(cleanedVnin)) {
      errors.vnin = "Invalid vNIN format (expected 16 characters)";
    }
  }

  // ========== CAC NUMBER (Optional but must be valid if provided) ==========
  if (formData.cacNumber?.trim()) {
    const cleanedCac = formData.cacNumber.replace(/[^A-Z0-9]/gi, "");
    // Nigerian RC/BN/IT numbers are usually 6-8 digits after the prefix
    const cacRegex = /^(RC|BN|IT)\d{5,8}$/i;
    if (!cacRegex.test(cleanedCac)) {
      errors.cacNumber = "Invalid CAC. Format: RC123456 or BN123456";
    }
  }

  // ========== CATEGORY & STATE ==========
  if (!formData.category) errors.category = "Please select a service category";
  if (!formData.state) errors.state = "Please select your primary state";

  // ========== PHONE NUMBER ==========
  if (!formData.phoneNumber?.trim()) {
    errors.phoneNumber = "Phone number is required";
  } else {
    const cleanedPhone = formData.phoneNumber.replace(/\D/g, "");
    const isValid =
      (cleanedPhone.length === 11 && cleanedPhone.startsWith("0")) ||
      (cleanedPhone.length === 10 && /^[789]/.test(cleanedPhone)) ||
      (cleanedPhone.length === 13 && cleanedPhone.startsWith("234"));

    if (!isValid) errors.phoneNumber = "Invalid Nigerian phone number format";
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

  return errors;
};

export const validateVendorField = (fieldName, value) => {
  const cleaned = value?.toString().trim() || "";

  switch (fieldName) {
    case "vnin":
      if (!cleaned) return "vNIN is mandatory";
      const vninClean = cleaned.replace(/[^A-Z0-9]/gi, "");
      if (vninClean.length !== 16) return "vNIN must be 16 characters";
      return null;

    case "cacNumber":
      if (!cleaned) return null; // CAC is optional
      const cacClean = cleaned.replace(/[^A-Z0-9]/gi, "");
      if (!/^(RC|BN|IT)\d{5,8}$/i.test(cacClean)) return "Invalid CAC format";
      return null;

    case "phoneNumber":
      if (!cleaned) return "Required";
      const phoneClean = cleaned.replace(/\D/g, "");
      if (phoneClean.length < 10 || phoneClean.length > 13)
        return "Invalid number";
      return null;

    case "firstName":
    case "lastName":
    case "name":
      if (!cleaned) return "This field is required";
      if (cleaned.length < 2) return "Too short";
      return null;

    default:
      return null;
  }
};

export const hasValidationErrors = (errors) => Object.keys(errors).length > 0;
