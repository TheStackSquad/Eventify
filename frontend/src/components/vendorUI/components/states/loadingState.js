// frontend/src/components/vendorUI/loadingState.jsx
"use client";

import React from "react";

const LoadingState = () => {
  return (
    <div className="flex justify-center items-center py-20 bg-white shadow-lg rounded-xl">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      <p className="ml-3 text-lg text-gray-700">Loading vendors...</p>
    </div>
  );
};

export default LoadingState;
