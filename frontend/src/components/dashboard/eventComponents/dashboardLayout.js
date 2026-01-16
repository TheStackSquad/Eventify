// frontend/src/components/dashboard/DashboardLayout.js
"use client";

import Sidebar from "@/components/dashboard/eventComponents/sidebar";

// We will assume the Sidebar component is where the logout button will be visually prominent.
export default function DashboardLayout({
  userName,
  activeView,
  onViewChange,
  onLogout,
  children,
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {" "}
      {/* Sidebar (Logout button animation to be implemented inside here) */}{" "}
      <Sidebar
        activeView={activeView}
        onViewChange={onViewChange}
        onLogout={onLogout} // This is where the handler is passed
        userName={userName}
      />
      {/* Main Content Area */}{" "}
      <main className="flex-1 overflow-auto">{children}</main>{" "}
    </div>
  );
}