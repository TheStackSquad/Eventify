export const prepareVendorPayload = (formData, imageUrl, userId) => {
  // Production Safety: Prevents uploading images if the session is dead
  if (!userId) throw new Error("Owner ID is required for registration");

  const toNullableInt = (val) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  return {
    // Note: ownerId is sent, but backend will prioritize the cookie
    owner_id: userId,
    name: formData.name?.trim(),
    category: formData.category,
    imageURL: imageUrl || formData.imageURL || "",
    state: formData.state,
    city: formData.city || "",
    phoneNumber: formData.phoneNumber || "",
    minPrice: toNullableInt(formData.minPrice),
  };
};

export const transformBackendToFrontend = (data) => {
  if (!data) return null;

  return {
    name: data.name || "",
    category: data.category || "",
    state: data.state || "",
    city: data.city || "",
    phoneNumber: data.phoneNumber || "",
    minPrice:
      data.minPrice && typeof data.minPrice === "object"
        ? String(data.minPrice.Int32)
        : String(data.minPrice || ""),
    imageURL: data.imageURL || "",
  };
};
