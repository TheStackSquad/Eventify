// frontend/src/utils/helper/vendorSlugHelper.js

export const generateVendorSlug = (vendor) => {
  if (!vendor || !vendor.id || !vendor.name) {
    if (process.env.NODE_ENV === "development") {
      console.warn("❌ Invalid vendor data for slug generation:", vendor);
    }
    return "unknown-vendor";
  }

  // Clean the vendor name for URL
  const cleanName = vendor.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .substring(0, 50); // Limit length

  // Use the full ID for uniqueness
  const vendorId = vendor.id;

  const slug = `${cleanName}-${vendorId}`;

  if (process.env.NODE_ENV === "development") {
    console.log("🔗 Generated slug:", {
      vendorName: vendor.name,
      vendorId,
      slug,
    });
  }

  return slug;
};

export const parseSlugToId = (slug) => {
  if (!slug) return null;

  try {
    // 1. Define a UUID regex (Matches 8-4-4-4-12 hex format)
    const uuidRegex =
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

    // 2. Try to find the UUID inside the slug
    const match = slug.match(uuidRegex);

    if (match) {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Valid UUID found in slug:", match[0]);
      }
      return match[0];
    }

    // 3. Fallback for 24-char IDs (if you use them elsewhere)
    const mongoRegex = /[0-9a-fA-F]{24}/;
    const mongoMatch = slug.match(mongoRegex);

    return mongoMatch ? mongoMatch[0] : null;
  } catch (error) {
    console.error("❌ Error parsing vendor slug:", error);
    return null;
  }
};

export const isValidVendorSlug = (slug) => {
  const result = !!parseSlugToId(slug);

  if (process.env.NODE_ENV === "development") {
    console.log("🔍 Slug validation result:", { slug, isValid: result });
  }

  return result;
};
