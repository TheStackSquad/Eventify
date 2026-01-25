// frontend/src/app/dashboard/components/dashboardLayout/loadingRedirect.js
"use client";

import React from "react";

export default function LoadingRedirect({ message = "Redirecting..." }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{message}</h2>
        <p className="text-gray-600">Please wait...</p>
      </div>
    </div>
  );
}
