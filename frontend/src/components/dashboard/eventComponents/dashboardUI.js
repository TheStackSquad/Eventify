// src/components/dashboard/eventComponents/dashboardUI.js
"use client";

import { motion } from "framer-motion";
import { LogOut, Sparkles, Barcode, Eye, PlusCircle } from "lucide-react";
import { useAuth } from "@/utils/hooks/useAuth";

import MyEvents from "@/components/dashboard/eventComponents/myEvents";
import DashboardStats from "@/components/dashboard/eventComponents/dashboardStats";
import DashboardQuickActions from "@/components/dashboard/eventComponents/dashboardQuickActions";
import VendorsDashboard from "@/components/dashboard/vendorComponents/vendorDashboard";
import { currencyFormat } from "@/utils/currency";

export default function DashboardUI({
  isLoading,
  onLogout,
  onCreateEvent,
  openDeleteModal,
  openAnalyticsModal,
  stats,
  quickActions,
  filteredEvents,
  activeView = "events",
  onViewChange,
}) {
  // ✅ Get user data directly from useAuth hook
  const { user } = useAuth();

  // ✅ Use user data with proper fallbacks
  const displayName = user?.name || user?.email?.split("@")[0] || "User";

  console.log("🔍 [DashboardUI] User data:", {
    user,
    displayName,
    userName: user?.name,
    userEmail: user?.email,
  });

  const welcomeMessage = isLoading
    ? "Loading your dashboard..."
    : `Welcome, ${displayName}!`;

  // Calculate total events for display
  const totalEvents =
    (filteredEvents?.liveEvents?.length ?? 0) +
    (filteredEvents?.upcomingEvents?.length ?? 0) +
    (filteredEvents?.pastEvents?.length ?? 0);

  // ✅ REMOVED: formattedStats transformation - stats are already formatted at source

  // Loading state component
  const LoadingState = (
    <div className="text-center py-20">
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {welcomeMessage}
      </h2>
      <p className="text-gray-500">Setting up your dashboard...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="pb-6 mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 truncate">
                  {welcomeMessage}
                </h1>
                {!isLoading && (
                  <Sparkles className="w-7 h-7 text-yellow-500 animate-pulse flex-shrink-0" />
                )}
              </div>
              <p className="text-base sm:text-lg text-gray-600">
                {activeView === "events"
                  ? "Manage your events, track performance, and grow your audience."
                  : "Manage vendor verifications, contracts, and payments."}
              </p>
            </div>

            {/* View Toggle and Logout */}
            <div className="flex items-center gap-4">
              {onLogout && !isLoading && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              )}
            </div>
          </div>
        </motion.header>

        {/* Loading State */}
        {isLoading && LoadingState}

        {/* Dashboard Content */}
        {!isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="space-y-8"
          >
            {/* Stats Grid - Pass stats directly without transformation */}
            <DashboardStats stats={stats ?? []} />

            {/* Quick Actions */}
            <DashboardQuickActions quickActions={quickActions ?? []} />

            {/* Dynamic Content Based on Active View */}
            {activeView === "events" ? (
              <>
                {/* Events Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-1">
                        Your Events
                      </h2>
                      <p className="text-xs text-gray-600">
                        {currencyFormat(totalEvents)}{" "}
                        {totalEvents === 1 ? "event" : "events"} created
                      </p>
                    </div>
                    {totalEvents > 0 && (
                      <button
                        onClick={onCreateEvent}
                        className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold"
                      >
                        <PlusCircle className="h-4 w-4" />
                        New Event
                      </button>
                    )}
                  </div>
                  <MyEvents
                    liveEvents={filteredEvents?.liveEvents || []}
                    upcomingEvents={filteredEvents?.upcomingEvents || []}
                    pastEvents={filteredEvents?.pastEvents || []}
                    openDeleteModal={openDeleteModal}
                    openAnalyticsModal={openAnalyticsModal}
                  />
                </motion.div>

                {/* Purchased Tickets Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      Your Tickets
                    </h2>
                    <p className="text-sm text-gray-600">
                      Events you&apos;re attending
                    </p>
                  </div>

                  <div className="text-center py-16 bg-white rounded-2xl shadow-md border-2 border-dashed border-gray-200">
                    <div className="max-w-md mx-auto px-4">
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <Barcode className="w-10 h-10 text-gray-400" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        No Tickets Yet
                      </h3>
                      <p className="text-gray-600 mb-4">
                        You haven&apos;t purchased any tickets yet.
                      </p>
                      <button className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold">
                        <Eye className="h-5 w-5" />
                        Explore Events
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            ) : (
              /* Vendors Section */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                <VendorsDashboard />
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
