// frontend/src/components/vendorUI/errorState.jsx
"use client";

import React from "react";

const ErrorState = ({ onRetry }) => {
  return (
    <div className="text-center px-12 mx-5 mt-12 h-[400px] lg:h-[300px] py-7 bg-red-50 border-2 border-red-300 rounded-xl shadow-lg">
      <p className="text-2xl font-bold text-red-700 mb-4">Connection Failed</p>
      <p className="text-gray-600 mb-6">
        We couldn&apos;t retrieve the list of vendors. Please check your network
        or try again later.
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition duration-150"
      >
        Reload Page
      </button>
    </div>
  );
};

export default ErrorState;
