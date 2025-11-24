// frontend/src/app/dashboard/page.js
"use client";

import React from "react";
import { useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/navigation";

// Layout & Views
import DashboardLayout from "@/components/dashboard/dashboardLayout";
import MyEventsDashboard from "@/components/dashboard/myEventsDashboard";
import VendorsDashboard from "@/components/dashboard/vendorDashboard";

// Modals
import DeleteModal from "@/components/modal/delete";
import AnalyticsModal from "@/components/modal/analytics";

// Redux Actions
import { logoutUser } from "@/redux/action/actionAuth";
import {
  fetchUserEvents,
  fetchEventAnalytics,
} from "@/redux/action/eventAction";

// Constants
import {
  STATUS,
  ANALYTICS_CACHE_DURATION_MS,
} from "@/utils/constants/globalConstants";

export default function DashboardPage() {
  const dispatch = useDispatch();
  const router = useRouter();

  // ============================================================================
  // REDUX STATE
  // ============================================================================

  const { user, sessionChecked } = useSelector((state) => state.auth);

  // 🆕 Get events and analytics from Redux (no local state needed)
  const {
    userEvents,
    eventAnalytics,
    aggregatedAnalytics,
    status: eventsStatus,
    error,
  } = useSelector((state) => state.events);

  // ============================================================================
  // LOCAL STATE (UI ONLY)
  // ============================================================================

  const [activeView, setActiveView] = React.useState("events");

  // Modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState({
    id: null,
    title: "",
  });
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = React.useState(false);
  const [analyticsTargetId, setAnalyticsTargetId] = React.useState(null);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isLoading = !sessionChecked || eventsStatus === STATUS.LOADING;
  const isEventsLoading = eventsStatus === STATUS.LOADING;

  // Get current event for analytics modal
  const currentEvent = useMemo(
    () => userEvents.find((e) => e.id === analyticsTargetId),
    [userEvents, analyticsTargetId]
  );

  // ============================================================================
  // ANALYTICS HELPERS
  // ============================================================================

  /**
   * Check if analytics data is stale and needs refresh
   */
  const isAnalyticsStale = useCallback(
    (eventId) => {
      const analytics = eventAnalytics[eventId];
      if (!analytics?.fetchedAt) return true;

      const now = new Date();
      const fetched = new Date(analytics.fetchedAt);
      const ageMs = now - fetched;

      return ageMs > ANALYTICS_CACHE_DURATION_MS;
    },
    [eventAnalytics]
  );

  /**
   * Fetch analytics for a specific event with caching
   */
  const fetchAnalyticsForEvent = useCallback(
    (eventId) => {
      const analytics = eventAnalytics[eventId];

      // Don't fetch if already loading
      if (analytics?.status === STATUS.LOADING) {
        console.log(`⏳ Analytics already loading for event ${eventId}`);
        return;
      }

      // Don't fetch if fresh data exists
      if (
        analytics?.status === STATUS.SUCCEEDED &&
        !isAnalyticsStale(eventId)
      ) {
        console.log(`✅ Using cached analytics for event ${eventId}`);
        return;
      }

      console.log(`📊 Fetching analytics for event ${eventId}`);
      dispatch(fetchEventAnalytics({ eventId }));
    },
    [dispatch, eventAnalytics, isAnalyticsStale]
  );

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const openDeleteModal = useCallback((id, title) => {
    setDeleteTarget({ id, title });
    setIsDeleteModalOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    setDeleteTarget({ id: null, title: "" });
  }, []);

  const openAnalyticsModal = useCallback(
    (eventId) => {
      console.log(`📊 Opening analytics modal for event ${eventId}`);
      setAnalyticsTargetId(eventId);
      setIsAnalyticsModalOpen(true);

      // Fetch analytics when modal opens (with caching)
      fetchAnalyticsForEvent(eventId);
    },
    [fetchAnalyticsForEvent]
  );

  const closeAnalyticsModal = useCallback(() => {
    setIsAnalyticsModalOpen(false);
    setAnalyticsTargetId(null);
  }, []);

  const handleLogout = useCallback(async () => {
    console.log("👋 Logging out...");
    try {
      await dispatch(logoutUser());
      console.log("✅ Logout successful");
    } catch (error) {
      console.error("❌ Logout error:", error);
    } finally {
      router.push("/account/auth/login");
    }
  }, [dispatch, router]);

  const handleCreateEvent = useCallback(() => {
    console.log("➕ Navigating to event creation...");
    router.push("/events/create-events");
  }, [router]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load user events on mount
  useEffect(() => {
    if (sessionChecked && user && eventsStatus === STATUS.IDLE) {
      console.log("📊 Loading user events...");
      dispatch(fetchUserEvents());
    }
  }, [sessionChecked, user, eventsStatus, dispatch]);

  // ============================================================================
  // RENDER CONDITIONS
  // ============================================================================

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Loading Dashboard
          </h2>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && userEvents.length === 0 && activeView === "events") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Oops! Something went wrong
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => dispatch(fetchUserEvents())}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <>
      <DashboardLayout
        userName={user?.name}
        activeView={activeView}
        onViewChange={setActiveView}
        onLogout={handleLogout}
      >
        {/* Events View */}
        {activeView === "events" && (
          <MyEventsDashboard
            events={userEvents}
            isLoading={isEventsLoading}
            onCreateEvent={handleCreateEvent}
            openDeleteModal={openDeleteModal}
            openAnalyticsModal={openAnalyticsModal}
          />
        )}

        {/* Vendor Views */}
        {(activeView === "vendor" || activeView === "vendor-register") && (
          <VendorsDashboard activeView={activeView} />
        )}
      </DashboardLayout>

      {/* Modals */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        eventId={deleteTarget.id}
        eventTitle={deleteTarget.title}
      />

      <AnalyticsModal
        isOpen={isAnalyticsModalOpen}
        onClose={closeAnalyticsModal}
        eventId={analyticsTargetId} // 🆕 Pass eventId instead of data
        eventTitle={currentEvent?.eventTitle}
      />
    </>
  );
}
