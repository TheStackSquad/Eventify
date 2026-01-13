// frontend/src/components/vendorUI/emptyState.jsx
"use client";

import React from "react";
import { BarChart4 } from "lucide-react";

const EmptyState = ({ onRegisterClick }) => {
  return (
    <div className="text-center p-16 bg-white rounded-xl shadow-lg">
      <BarChart4 className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
      <p className="text-2xl font-semibold text-gray-800 mb-3">
        No Vendors Found
      </p>
      <p className="text-gray-600 mb-6">
        Your search criteria returned no results. Try adjusting your filters or
        be the first to
        <button
          onClick={onRegisterClick}
          className="text-indigo-600 hover:text-indigo-800 font-medium ml-1 underline"
        >
          register your business!
        </button>
      </p>
    </div>
  );
};

export default EmptyState;
