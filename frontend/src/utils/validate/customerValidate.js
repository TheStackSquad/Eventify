// frontend/src/utils/validate/customerValidate.js

export function validateCustomerInfo(data) {
  const errors = {};
  let isValid = true;

  // 1. Helper function for trimming and checking required fields
  const getFieldValue = (field) => String(data[field] || "").trim();

  // --- Required Fields Check ---
  const requiredFields = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email Address" },
    { key: "phone", label: "Phone Number" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
  ];

  requiredFields.forEach(({ key, label }) => {
    if (!getFieldValue(key)) {
      errors[key] = `${label} is required.`;
      isValid = false;
    }
  });

  // --- Specific Format and Length Checks ---

  // 2. Email Format Check (using a simple regex)
  const email = getFieldValue("email");
  // Simple regex for basic email structure
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !errors.email && !emailRegex.test(email)) {
    errors.email = "Please enter a valid email address.";
    isValid = false;
  }

  // 3. Phone Number Length Check (adjust min length as needed for Nigerian numbers)
  const phone = getFieldValue("phone").replace(/[^0-9+]/g, ""); // Remove non-numeric except '+'
  if (phone && !errors.phone && phone.length < 11) {
    // Basic check for minimum length
    errors.phone = "Phone number must be at least 11 digits long.";
    isValid = false;
  }

  // 4. Name Length Check (optional, but good for data quality)
  const firstName = getFieldValue("firstName");
  if (firstName && !errors.firstName && firstName.length < 2) {
    errors.firstName = "First Name must be at least 2 characters.";
    isValid = false;
  }

  const lastName = getFieldValue("lastName");
  if (lastName && !errors.lastName && lastName.length < 2) {
    errors.lastName = "Last Name must be at least 2 characters.";
    isValid = false;
  }

  return { isValid, errors };
}
