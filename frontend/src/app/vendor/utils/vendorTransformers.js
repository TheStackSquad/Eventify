// frontend/src/app/vendors/utils/vendorTransformers.js

export const prepareVendorPayload = (formData, imageUrl, userId) => {
  if (!userId) throw new Error("Owner ID is required");

  const toNullableInt = (val) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  return {
    // Basic Info
    ownerId: userId,
    name: formData.name?.trim(),
    category: formData.category,
    description: formData.description || "",
    imageURL: imageUrl || formData.imageURL || "",

    // Identity
    vnin: formData.vnin || "",
    verifiedVnin: formData.verifiedVnin || formData.vnin || "",
    firstName: formData.firstName || "",
    middleName: formData.middleName || "",
    lastName: formData.lastName || "",
    dateOfBirth: formData.dateOfBirth || "", // Go helper handles "" as NULL
    gender: formData.gender || "",
    isIdentityVerified: !!formData.isIdentityVerified,

    // Location & Contact
    state: formData.state,
    city: formData.city || "",
    phoneNumber: formData.phoneNumber || "",
    email: formData.email || "",

    // Business
    cacNumber: formData.cacNumber || "",
    isBusinessVerified: !!formData.isBusinessVerified,
    minPrice: toNullableInt(formData.minPrice),
  };
};

export const transformBackendToFrontend = (data) => {
  if (!data) return null;

  return {
    id: data.id,
    name: data.name || "",
    category: data.category || "",
    description: data.description || "",
    imageURL: data.imageURL || "",

    // Flattened by Go MarshalJSON
    firstName: data.firstName || "",
    middleName: data.middleName || "",
    lastName: data.lastName || "",
    dateOfBirth: data.dateOfBirth || "",

    state: data.state || "",
    city: data.city || "",
    phoneNumber: data.phoneNumber || "",
    email: data.email || "",

    // Handle flattened nulls
    minPrice: data.minPrice !== null ? String(data.minPrice) : "",
    cacNumber: data.cacNumber || "",
    status: data.status,
  };
};