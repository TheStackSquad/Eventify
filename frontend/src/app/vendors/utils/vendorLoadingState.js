// frontend/src/app/vendors/utils/vendorLoadingState.js

import React from "react";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";

const VendorLoadingState = ({ isFirstPage = true }) => {
  if (isFirstPage) {
    return (
      <LoadingSpinner
        fullScreen={true}
        message="Discovering amazing vendors..."
        subMessage="Finding the best matches for you."
      />
    );
  }

  // For subsequent page loads (pagination)
  return (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <span className="ml-3 text-gray-600">Loading more vendors...</span>
    </div>
  );
};

export default VendorLoadingState;
