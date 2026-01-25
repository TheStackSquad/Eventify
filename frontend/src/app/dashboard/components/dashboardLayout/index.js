// frontend/src/app/dashboard/components/dashboardLayout/index.js
"use client";

import React from "react";
import AuthGuard from "./authGuard";
import DashboardMain from "./dashboardContent";

export default function DashboardLayoutWrapper() {
  return (
    <AuthGuard>
      <DashboardMain />
    </AuthGuard>
  );
}
