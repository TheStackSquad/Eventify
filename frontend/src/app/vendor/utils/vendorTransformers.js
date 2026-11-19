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
    // The full vNIN never reaches the browser (NIMC: not to be stored). Only its last 4 do.
    vnin: "",
    vninLast4: nullToEmpty(data.vninLast4),
    vninProof: "",
    cacProof: "",

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
    verifiedVnin: "",
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
  payload.vninProof = formData.vninProof || "";
  payload.cacProof = formData.cacProof || "";

  // Verification travels only as signed proofs. The server derives flags, names and the CAC
  // number from them; the raw vNIN and client-declared flags are never sent.
  payload.firstName = formData.firstName || "";
  payload.middleName = formData.middleName || "";
  payload.lastName = formData.lastName || "";
  payload.vninProof = formData.vninProof || "";
  payload.cacProof = formData.cacProof || "";
  payload.isIdentityVerified = !!formData.isIdentityVerified; // UI hint, ignored server-side
  payload.isBusinessVerified = !!formData.isBusinessVerified;
  const cac = isEditMode
    ? formData.verifiedCacNumber || formData.cacNumber
    : formData.cacNumber;
  payload.cacNumber = formData.isBusinessVerified ? cac || "" : ""; // unverified CAC is dropped

  return payload;
};

// Redact sensitive fields for display
// Only used for frontend display, never sent to backend

export const redactSensitiveField = (value, type = "vnin") => {
  if (!value) return "";
  const str = String(value);

  if (type === "vnin") {
    const clean = str.replace(/[^A-Z0-9]/gi, "");
    if (clean.length < 4) return "••••";
    return `${"•".repeat(12)}${clean.slice(-4)}`; // ONLY the last 4 characters
  }

  if (str.length >= 6) return `${str.slice(0, 3)}***${str.slice(-4)}`; // CAC: public register data
  return "***";
};
