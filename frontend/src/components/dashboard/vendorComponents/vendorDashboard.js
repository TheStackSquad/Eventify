// frontend/src/components/dashboard/vendorsDashboard.js
"use client";

import React from "react";
import { useAuth } from "@/utils/hooks/useAuth";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import VendorRegistrationView from "@/components/vendorUI/vendorRegistrationView";
import VendorAnalyticsDashboard from "./vendorAnalytics/vendorAnalyticsDashboard";

export default function VendorManagementView({ activeView }) {
  const { user, sessionChecked } = useAuth();

  console.log("VendorDashboard user:", user);

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

  switch (activeView) {
    case "vendor":
      return <VendorAnalyticsDashboard userId={user?.id} />;

    case "vendor-register":
      return <VendorRegistrationView userId={user?.id} />;

    default:
      return <VendorAnalyticsDashboard userId={user?.id} />;
  }
}
