// frontend/src/components/dashboard/VendorsDashboard.js

"use client";

import React from "react";
import { useCurrentUser } from "@/utils/hooks/useAuth";
import VendorRegistrationView from "@/components/vendorUI/components/form/vendorRegistrationView";

export default function VendorManagementView({ activeView }) {
  // Get current user using the new auth hook
  const user = useCurrentUser();

  console.log("🔍 [VendorManagementView] Current user:", user);

  // Loading state component
  const LoadingState = () => (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading your session...</p>
      </div>
    </div>
  );

  // --- Analytics Cards Component ---
  const AnalyticsCards = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800 border-b pb-2">
        Vendor Analytics
      </h2>

      {/* Earnings Card */}
      <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-100">
        <h3 className="text-lg font-medium text-gray-700">Earnings Summary</h3>
        <p className="text-3xl font-bold text-indigo-600 mt-2">N0.00</p>
        <p className="text-sm text-gray-500 mt-1">
          Register as a vendor to start earning
        </p>
      </div>

      {/* Event Bookings Card */}
      <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-100">
        <h3 className="text-lg font-medium text-gray-700">Event Bookings</h3>
        <p className="text-3xl font-bold text-teal-600 mt-2">0</p>
        <p className="text-sm text-gray-500 mt-1">
          No bookings yet. Complete your vendor profile
        </p>
      </div>

      {/* Quick Actions Card */}
      <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-100">
        <h3 className="text-lg font-medium text-gray-700">Quick Actions</h3>
        <div className="mt-4 space-y-3">
          <button
            onClick={() =>
              (window.location.href = "/dashboard?vendor-register")
            }
            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Complete Vendor Registration
          </button>
          <button
            className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            disabled
          >
            View Bookings (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  );

  // Show loading while user data is being fetched
  if (!user) {
    return <LoadingState />;
  }

  // User is loaded, render based on activeView
  switch (activeView) {
    case "vendor":
      return <AnalyticsCards />;

    case "vendor-register":
      // Pass userId to VendorRegistrationView - CRITICAL!
      return <VendorRegistrationView userId={user.id} />;

    default:
      return <AnalyticsCards />;
  }
}
