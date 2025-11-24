// frontend/src/components/modal/analytics.js

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

// Components
import AnalyticsHeader from "./analytics/analyticsHeader";
import AnalyticsKeyMetrics from "./analytics/analyticsKeyMetrics";
import AnalyticsSkeleton from "./analytics/analyticsSkeleton";
import ExportButton from "./analytics/shared/exportButton";

// Sections (lazy loaded)
import RevenueSection from "./analytics/sections/revenueSection";
import TicketTiersSection from "./analytics/sections/ticketTiersSection";
import OrdersSection from "./analytics/sections/ordersSection";
import CustomersSection from "./analytics/sections/customersSection";
import PaymentsSection from "./analytics/sections/paymentsSection";
import TimelineSection from "./analytics/sections/timelineSection";

// Utils
import {
  getSectionStates,
  saveSectionState,
} from "./analytics/utils/analyticsStorage";

// Redux
import { fetchEventAnalytics } from "@/redux/action/eventAction";
import { STATUS } from "@/utils/constants/globalConstants";

export default function AnalyticsModal({
  isOpen,
  onClose,
  eventId,
  eventTitle,
}) {
  const dispatch = useDispatch();

  // Get analytics from Redux
   const analyticsState = useSelector(
     (state) => state.events?.eventAnalytics?.[eventId] || {}
   );

  const {
    data: analytics = {},
    status = STATUS.IDLE,
    error = null,
  } = analyticsState;
  const isLoading = status === STATUS.LOADING;
  const isError = status === STATUS.FAILED;

  // Section collapse states (persisted in localStorage)
  const [expandedSections, setExpandedSections] = useState(() =>
    getSectionStates(eventId)
  );

  // Toggle section expansion
  const toggleSection = useCallback(
    (sectionKey) => {
      setExpandedSections((prev) => {
        const newState = {
          ...prev,
          [sectionKey]: !prev[sectionKey],
        };
        saveSectionState(eventId, newState);
        return newState;
      });
    },
    [eventId]
  );

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden"; // Prevent background scroll
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Fetch analytics if not available
  useEffect(() => {
    if (isOpen && eventId && (!analytics || status === STATUS.FAILED)) {
      dispatch(fetchEventAnalytics({ eventId }));
    }
  }, [isOpen, eventId, analytics, status, dispatch]);

  if (!isOpen) return null;

  // Animation variants
  const backdropVariants = {
    visible: { opacity: 1 },
    hidden: { opacity: 0 },
  };

  const modalVariants = {
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { type: "spring", damping: 25, stiffness: 300 },
    },
    hidden: {
      y: 50,
      opacity: 0,
      scale: 0.96,
    },
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={backdropVariants}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
          variants={modalVariants}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky Header */}
          <AnalyticsHeader
            eventTitle={eventTitle}
            status={analytics?.overview?.status}
            onClose={onClose}
          />

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 space-y-6">
              {/* Loading State */}
              {isLoading && <AnalyticsSkeleton />}

              {/* Error State */}
              {isError && !isLoading && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">⚠️</span>
                  </div>
                  <h3 className="text-xl font-bold text-red-900 mb-2">
                    Failed to Load Analytics
                  </h3>
                  <p className="text-red-700 mb-4">{error}</p>
                  <button
                    onClick={() => dispatch(fetchEventAnalytics({ eventId }))}
                    className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Success State - Show Analytics */}
              {analytics && !isLoading && (
                <>
                  {/* Key Metrics - Always Visible */}
                  <AnalyticsKeyMetrics analytics={analytics} />

                  {/* Collapsible Sections */}
                  <div className="space-y-4">
                    <RevenueSection
                      revenue={analytics.revenue}
                      isExpanded={expandedSections.revenue}
                      onToggle={() => toggleSection("revenue")}
                    />

                    <TicketTiersSection
                      tiers={analytics.tiers}
                      tickets={analytics.tickets}
                      isExpanded={expandedSections.tiers}
                      onToggle={() => toggleSection("tiers")}
                    />

                    <OrdersSection
                      orders={analytics.orders}
                      isExpanded={expandedSections.orders}
                      onToggle={() => toggleSection("orders")}
                    />

                    <CustomersSection
                      customers={analytics.customers}
                      isExpanded={expandedSections.customers}
                      onToggle={() => toggleSection("customers")}
                    />

                    <PaymentsSection
                      payments={analytics.payments}
                      isExpanded={expandedSections.payments}
                      onToggle={() => toggleSection("payments")}
                    />

                    {analytics.timeline && analytics.timeline.length > 0 && (
                      <TimelineSection
                        timeline={analytics.timeline}
                        isExpanded={expandedSections.timeline}
                        onToggle={() => toggleSection("timeline")}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              {analytics?.overview && (
                <span>
                  Last updated:{" "}
                  {new Date(analyticsState.fetchedAt).toLocaleString()}
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <ExportButton analytics={analytics} eventTitle={eventTitle} />

              <button
                onClick={() => dispatch(fetchEventAnalytics({ eventId }))}
                className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                {isLoading ? "Refreshing..." : "Refresh"}
              </button>

              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
