// frontend/src/components/dashboard/dashboardContent.js
"use client";

import { motion } from "framer-motion";
import MyEventsDashboard from "@/components/dashboard/eventComponents/myEventsDashboard"; // Assuming this is the core Events view
import VendorsDashboard from "@/components/dashboard/vendorComponents/vendorDashboard";
import { XCircle } from "lucide-react";

export default function DashboardContent({
  activeView,
  events,
  isEventsQueryLoading,
  eventsError,
  refetchUserEvents,
  onCreateEvent,
  openDeleteModal,
  openAnalyticsModal,
}) {
  // Error state rendering
  if (eventsError && activeView === "events") {
    return (
      <div className="p-8">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center mx-auto">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Failed to load your events
          </h2>
          <p className="text-gray-600 mb-6">
            {eventsError.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={refetchUserEvents}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      key={activeView} // Use key to trigger animation on view switch
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8 sm:p-10"
    >
      {activeView === "events" && (
        <MyEventsDashboard
          events={events}
          isLoading={isEventsQueryLoading}
          onCreateEvent={onCreateEvent}
          openDeleteModal={openDeleteModal}
          openAnalyticsModal={openAnalyticsModal}
        />
      )}

      {(activeView === "vendor" || activeView === "vendor-register") && (
        <VendorsDashboard activeView={activeView} />
      )}
    </motion.div>
  );
}
