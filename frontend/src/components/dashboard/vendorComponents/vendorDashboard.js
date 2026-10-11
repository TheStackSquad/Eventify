//frontend/src/components/dashboard/vendorComponents/vendorsDashboard.js
"use client";

import React from "react";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import VendorRegistrationView from "@/components/vendorUI/components/form/vendorRegistrationView";
import VendorAnalyticsDashboard from "./vendorAnalytics/vendorAnalyticsDashboard";

export default function VendorManagementView({
  activeView,
  user,
  onViewChange,
}) {
  // 🔑 Add onViewChange prop
  console.log("🏪 [VendorDashboard] Rendering", {
    activeView,
    userId: user?.id,
    vendorId: user?.vendorId,
    isVendor: user?.isVendor,
  });

  // ✅ Guard: Wait for user data
  if (!user?.id) {
    return (
      <LoadingSpinner
        message="Loading vendor dashboard..."
        subMessage="Fetching your business data"
        size="md"
        color="indigo"
        fullScreen={false}
        className="bg-white rounded-xl shadow-sm border border-gray-100"
      />
    );
  }

  // ✅ View Routing
  switch (activeView) {
    case "vendor":
      // No vendor profile yet - show registration
      if (!user.vendorId) {
        console.warn(
          "⚠️ [VendorDashboard] User is marked as vendor but has no vendorId",
        );
        return (
          <VendorRegistrationView
            userId={user.id}
            initialData={{
              email: user.email,
              fullName: user.name,
            }}
          />
        );
      }

      // Has vendor profile - show analytics
      return (
        <VendorAnalyticsDashboard
          vendorId={user.vendorId}
          userId={user.id}
          userEmail={user.email}
          onViewChange={onViewChange} // 🔑 Pass it down
        />
      );

    case "vendor-register":
      console.log("🔍 [VendorDashboard] vendor-register case:", {
        userId: user.id,
        vendorId: user.vendorId,
        willBeEditMode: !!user.vendorId,
      });

      return (
        <VendorRegistrationView
          userId={user.id}
          vendorId={user.vendorId} // ✅ This is the key line!
          initialData={{
            email: user.email,
            fullName: user.name,
          }}
        />
      );

    default:
      console.warn("⚠️ [VendorDashboard] Unknown view:", activeView);

      if (user.vendorId) {
        return (
          <VendorAnalyticsDashboard
            vendorId={user.vendorId}
            userId={user.id}
            userEmail={user.email}
            onViewChange={onViewChange}
          />
        );
      }

      return (
        <VendorRegistrationView
          userId={user.id}
          initialData={{
            email: user.email,
            fullName: user.name,
          }}
        />
      );
  }
}
