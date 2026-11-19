// frontend/src/components/vendorUI/vendorProfileWrapper/utils/vendorUtils.js
export const getVendorData = (vendor) => {
  const startingPrice = vendor.minPrice?.Valid
    ? vendor.minPrice.Int32
    : typeof vendor.minPrice === "number"
      ? vendor.minPrice
      : 0;
  const avg = Number(vendor.avgRating) || 0;
  const reviewCount = Number(vendor.reviewCount) || 0;
  const hasReviews = reviewCount > 0 && avg > 0;
  const ratingOutOf5 = hasReviews ? avg.toFixed(1) : "0.0";
  const isPremium = (Number(vendor.pvsScore) || 0) >= 80;
  const isNewVendor = vendor.bookingsCompleted === 0;

  return {
    startingPrice,
    ratingOutOf5,
    hasReviews,
    isPremium,
    isNewVendor,
  };
};

export const isMobileDevice = () => {
  if (typeof window !== "undefined") {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }
  return false;
};

export const formatMemberSince = (dateString) => {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};
