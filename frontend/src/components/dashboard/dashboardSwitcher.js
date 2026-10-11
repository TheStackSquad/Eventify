// frontend/src/components/dashboard/dashboardSwitcher.js

"use client";

import { motion, AnimatePresence } from "framer-motion";
import MyEventsDashboard from "@/components/dashboard/eventComponents/myEventsDashboard";
import VendorsDashboard from "@/components/dashboard/vendorComponents/vendorDashboard";
import { XCircle, AlertTriangle } from "lucide-react";

const ErrorDisplay = ({ message, onRetry }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="p-8 text-center"
  >
    <div className="max-w-md mx-auto">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <XCircle className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Connection Error</h3>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  </motion.div>
);

export default function DashboardSwitcher({
  activeView,
  user,
  events,
  isLoading,
  eventsError,
  openDeleteModal,
  openAnalyticsModal,
  onCreateEvent,
  refetchUserEvents,
  onViewChange,
}) {
  // Error state for events view
  if (eventsError && activeView === "events") {
    return (
      <ErrorDisplay
        message={eventsError.message || "Failed to load events"}
        onRetry={refetchUserEvents}
      />
    );
  }

  // View transition animations
  const pageTransition = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: "easeInOut" },
  };

  return (
    <div className="p-6 lg:p-10">
      <AnimatePresence mode="wait">
        {activeView === "events" && (
          <motion.div key="events" {...pageTransition}>
            <MyEventsDashboard
              events={events}
              isLoading={isLoading}
              onCreateEvent={onCreateEvent}
              openDeleteModal={openDeleteModal}
              openAnalyticsModal={openAnalyticsModal}
            />
          </motion.div>
        )}

        {(activeView === "vendor" || activeView === "vendor-register") && (
          <motion.div key="vendor" {...pageTransition}>
            <VendorsDashboard
              activeView={activeView}
              user={user}
              onViewChange={onViewChange}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
