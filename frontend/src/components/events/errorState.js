// frontend/src/components/events/errorState.js
"use client";

import React from "react";

const ErrorState = ({ onRetry, message }) => {
  return (
    <div className="min-h-[400px] flex items-center justify-center bg-gradient-to-b from-orange-50/50 to-white px-4 rounded-3xl">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-orange-100">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl" role="img" aria-label="Warning">
            ⚠️
          </span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Connection Issue
        </h2>
        <p className="text-gray-600 mb-8 leading-relaxed">
          {message ||
            "We encountered a problem loading the latest events. Please check your connection and try again."}
        </p>
        <button
          onClick={onRetry}
          className="w-full px-6 py-4 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all font-bold shadow-lg shadow-orange-100 active:scale-[0.98] min-h-[56px]"
        >
          Refresh Events
        </button>
      </div>
    </div>
  );
};

export default ErrorState;
