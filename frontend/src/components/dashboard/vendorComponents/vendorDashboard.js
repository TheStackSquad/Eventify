// frontend/src/components/dashboard/vendorsDashboard.js
"use client";

import React from "react";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import VendorRegistrationView from "@/components/vendorUI/components/form/vendorRegistrationView";
import VendorAnalyticsDashboard from "./vendorAnalytics/vendorAnalyticsDashboard";

// Accept 'user' and 'sessionChecked' as props from DashboardContent
export default function VendorManagementView({
  activeView,
  user,
  sessionChecked,
}) {
  // Debug to ensure the data is "pouring" down correctly
  console.log("🚀 VendorDashboard received user:", user?.id);

  // 1. Logic Guard: If the parent hasn't finished checking the session
  if (!sessionChecked) {
    return (
      <LoadingSpinner
        message="Checking your session..."
        subMessage="Verifying your access to vendor dashboard"
        size="md"
        color="indigo"
        fullScreen={false}
        className="bg-white rounded-xl shadow-sm border border-gray-100"
      />
    );
  }

  // 2. View Switching: Pass the userId down to the specific features
  switch (activeView) {
    case "vendor":
      return (
        <VendorAnalyticsDashboard userId={user?.id} userEmail={user?.email} />
      );

    case "vendor-register":
      return (
        <VendorRegistrationView
          userId={user?.id}
          initialData={{
            email: user?.email,
            fullName: user?.name,
          }}
        />
      );

    default:
      return <VendorAnalyticsDashboard userId={user?.id} />;
  }
}