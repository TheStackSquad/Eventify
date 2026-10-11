// frontend/src/app/vendors/utils/vendorTransformers.js


// Transform backend data to frontend format
 // ackend sends minPrice in kobo, convert to naira for display
 
export const transformBackendToFrontend = (data) => {
  if (!data) return null;

  const nullToEmpty = (value) => value ?? "";

  // Convert kobo to naira for display (75000000 → "750000")
  const koboToNaira = (kobo) => {
    if (kobo === null || kobo === undefined) return "";
    return String(Math.round(kobo / 100));
  };

  return {
    id: data.id,
    name: nullToEmpty(data.name),
    category: nullToEmpty(data.category),
    description: nullToEmpty(data.description),
    imageURL: nullToEmpty(data.imageURL),

    // Identity
    firstName: nullToEmpty(data.firstName),
    middleName: nullToEmpty(data.middleName),
    lastName: nullToEmpty(data.lastName),
    vnin: nullToEmpty(data.vnin),

    // Location
    state: nullToEmpty(data.state),
    city: nullToEmpty(data.city),
    phoneNumber: nullToEmpty(data.phoneNumber),
    email: nullToEmpty(data.email),

    // Price conversion: kobo to naira
    minPrice: koboToNaira(data.minPrice),
   // minPrice: (data.minPrice),

    cacNumber: nullToEmpty(data.cacNumber),

    // Verification
    isIdentityVerified: data.isIdentityVerified || false,
    isBusinessVerified: data.isBusinessVerified || false,

    // Tamper-proof snapshots
    verifiedVnin: data.isIdentityVerified ? String(data.vnin || "") : "",
    verifiedCacNumber: data.isBusinessVerified
      ? String(data.cacNumber || "")
      : "",

    status: data.status || "active",
  };
};


 // Prepare vendor payload for submission
 // Frontend sends minPrice in naira, backend converts to kobo
 
export const prepareVendorPayload = (
  formData,
  imageUrl,
  userId,
  isEditMode = false,
) => {
  if (!userId) throw new Error("Owner ID is required");

  // Convert naira string to integer (no decimal conversion here)
  // Backend will handle the kobo conversion
  const parseNaira = (val) => {
    if (!val) return 0;
    const parsed = parseFloat(String(val).replace(/[^0-9.]/g, ""));
    if (isNaN(parsed)) return 0;
    return Math.round(parsed); // Return as naira integer
  };

  const payload = {
    ownerId: userId,
    name: formData.name?.trim() || "",
    category: formData.category || "",
    description: formData.description || "",
    imageURL: imageUrl || formData.imageURL || "",
    state: formData.state || "",
    city: formData.city || "",
    phoneNumber: formData.phoneNumber || "",
    email: formData.email || "",
    minPrice: parseNaira(formData.minPrice), // Send as naira integer
    status: formData.status || "active",
  };

  // Identity & Business fields
  if (isEditMode) {
    // Edit: Use verified snapshots (full unredacted values)
    payload.vnin = formData.verifiedVnin || formData.vnin || "";
    payload.verifiedVnin = formData.verifiedVnin || formData.vnin || "";
    payload.firstName = formData.firstName || "";
    payload.middleName = formData.middleName || "";
    payload.lastName = formData.lastName || "";
    payload.isIdentityVerified = !!formData.isIdentityVerified;
    payload.cacNumber = formData.verifiedCacNumber || formData.cacNumber || "";
    payload.isBusinessVerified = !!formData.isBusinessVerified;
  } else {
    // Create: Use current values
    payload.vnin = formData.vnin || "";
    payload.verifiedVnin = formData.verifiedVnin || formData.vnin || "";
    payload.firstName = formData.firstName || "";
    payload.middleName = formData.middleName || "";
    payload.lastName = formData.lastName || "";
    payload.isIdentityVerified = !!formData.isIdentityVerified;
    payload.cacNumber = formData.cacNumber || "";
    payload.isBusinessVerified = !!formData.isBusinessVerified;
  }

  return payload;
};

// Redact sensitive fields for display
 // Only used for frontend display, never sent to backend
 
export const redactSensitiveField = (value, type = "vnin") => {
  if (!value) return "";

  const str = String(value);

  if (type === "vnin") {
    // vNIN format: V12345678901A → V12***8901A
    if (str.length >= 8) {
      return `${str.slice(0, 3)}***${str.slice(-4)}`;
    }
  } else if (type === "cac") {
    // CAC format: RC-12345678 → RC-***5678
    if (str.length >= 6) {
      return `${str.slice(0, 3)}***${str.slice(-4)}`;
    }
  }

  // Fallback: show first 3 and last 4 chars
  if (str.length >= 8) {
    return `${str.slice(0, 3)}***${str.slice(-4)}`;
  }

  return "***";
};
