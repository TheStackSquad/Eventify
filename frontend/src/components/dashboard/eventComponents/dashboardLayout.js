// frontend/src/components/dashboard/DashboardLayout.js
"use client";

import Sidebar from "@/components/dashboard/eventComponents/sidebar";

export default function DashboardLayout({
  userName,
  activeView,
  onViewChange,
  onLogout,
  isVendor,
  hasEvents,
  children,
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        activeView={activeView}
        onViewChange={onViewChange}
        onLogout={onLogout}
        userName={userName}
        isVendor={isVendor}
        hasEvents={hasEvents}
      />
      <main className="flex-1 overflow-auto bg-white">{children}</main>
    </div>
  );
}
