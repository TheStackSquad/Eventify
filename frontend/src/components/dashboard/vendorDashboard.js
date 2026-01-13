// frontend/src/components/dashboard/VendorsDashboard.js

"use client";

import React from "react";
import { useDispatch, useSelector } from "react-redux";

// REMOVED: VendorListingView import
import VendorRegistrationView from "@/components/vendorUI/components/form/vendorRegistrationView";

// NOTE: Renamed the export to better reflect its purpose as a hub/management view
export default function VendorManagementView({ activeView }) {
  // You can keep dispatch/selector if you plan to use Redux state for analytics data
  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.vendors);

  // --- Placeholder for Analytics Cards ---
  const AnalyticsCards = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800 border-b pb-2">
        Vendor Analytics
      </h2>

      {/* Placeholder card 1 */}
      <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-100">
        <h3 className="text-lg font-medium text-gray-700">Earnings Summary</h3>
        <p className="text-3xl font-bold text-indigo-600 mt-2">N112,500.00</p>
        <p className="text-sm text-gray-500 mt-1">
          Total revenue in the last 30 days.
        </p>
      </div>

      {/* Placeholder card 2 */}
      <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-100">
        <h3 className="text-lg font-medium text-gray-700">Event Bookings</h3>
        <p className="text-3xl font-bold text-teal-600 mt-2">15</p>
        <p className="text-sm text-gray-500 mt-1">Upcoming booked events.</p>
      </div>

      {/* Add more cards for ratings, profile completeness, etc. */}
    </div>
  );

  switch (activeView) {
    case "vendor":
      return <AnalyticsCards />;

    case "vendor-register":
      return <VendorRegistrationView />;

    default:
      return <AnalyticsCards />;
  }
}
