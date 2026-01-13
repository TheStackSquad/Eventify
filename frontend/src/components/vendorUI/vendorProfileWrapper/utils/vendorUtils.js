// frontend/src/components/vendorUI/vendorProfileWrapper/utils/vendorUtils.js
export const getVendorData = (vendor) => {
  const startingPrice = vendor.minPrice?.Valid ? vendor.minPrice.Int32 : 0;
  const ratingOutOf5 = vendor.pvsScore
    ? (vendor.pvsScore / 20).toFixed(1)
    : "0.0";
  const isPremium = vendor.pvsScore >= 80;
  const isNewVendor = vendor.bookingsCompleted === 0;

  return {
    startingPrice,
    ratingOutOf5,
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
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};
