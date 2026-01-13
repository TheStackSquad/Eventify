// frontend/src/app/vendors/utils/vendorTransformers.js

export const prepareVendorPayload = (formData, imageUrl, userId) => {
  if (!userId) throw new Error("Owner ID is required");

  // Helper to handle Go pointer/sql.null types
  const toNullableInt = (val) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  return {
    ownerId: userId,
    name: formData.name?.trim(),
    category: formData.category,
    subCategories: Array.isArray(formData.subCategories)
      ? formData.subCategories
      : [],
    imageURL: imageUrl || formData.imageURL || "",
    state: formData.state,
    city: formData.city || "",
    area: formData.area || "",
    phoneNumber: formData.phoneNumber || "",
    minPrice: toNullableInt(formData.minPrice),
  };
};

export const transformBackendToFrontend = (data) => {
  if (!data) return null;

  return {
    name: data.name || "",
    category: data.category || "",
    subCategories: data.subCategories || [],
    state: data.state || "",
    city: data.city || "",
    area: data.area || "",
    phoneNumber: data.phoneNumber || "",
    // If Go returns an object for sql.NullInt32, we extract the value
    minPrice: data.minPrice?.Valid
      ? String(data.minPrice.Int32)
      : String(data.minPrice || ""),
    imageURL: data.imageURL || "",
  };
};
