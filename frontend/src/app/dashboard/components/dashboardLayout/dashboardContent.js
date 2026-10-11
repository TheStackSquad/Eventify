// frontend/src/app/dashboard/components/dashboardLayout/dashboardContent.js
"use client";

import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useLogout } from "@/utils/hooks/useAuth";
import { useUserEvents, eventKeys } from "@/utils/hooks/useEvents";

import DashboardLayout from "@/components/dashboard/eventComponents/dashboardLayout";
import DashboardSwitcher from "@/components/dashboard/dashboardSwitcher";
import DeleteModal from "@/components/modal/delete";
import AnalyticsModal from "@/components/modal/analytics";

export default function DashboardPageContainer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutate: logout } = useLogout();

  // ✅ Get full auth state including initialization
  const { user, isInitialized, isAuthenticated } = useAuth();

  // ✅ Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState({ id: null, title: "" });
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [analyticsTargetId, setAnalyticsTargetId] = useState(null);

  // ✅ DEFERRED View Initialization - waits for user data
  const [activeView, setActiveView] = useState(null);

  // ✅ Smart Initial View Selection - runs AFTER user loads
  useEffect(() => {
    if (!isInitialized || !isAuthenticated || !user || activeView !== null) {
      return; // Wait for auth OR already set
    }

    console.log("🎯 [Dashboard] Setting initial view", {
      hasEvents: user.hasEvents,
      isVendor: user.isVendor,
      role: user.role,
    });

    // Priority: Events > Vendor Analytics > Events (fallback)
    if (user.hasEvents) {
      setActiveView("events");
    } else if (user.isVendor) {
      setActiveView("vendor");
    } else {
      setActiveView("events"); // Default for new users
    }
  }, [isInitialized, isAuthenticated, user, activeView]);

  // ✅ Conditional Events Fetching - only if user can access events
  const shouldFetchEvents = user?.hasEvents || user?.role === "admin";

  const {
    data: events = [],
    isLoading: isEventsQueryLoading,
    error: eventsError,
  } = useUserEvents(user?.id, shouldFetchEvents);

  // ✅ Memoized Current Event
  const currentEvent = useMemo(
    () => events.find((e) => e.id === analyticsTargetId),
    [events, analyticsTargetId],
  );

  // ✅ Smart View Guard with Logging
  const handleViewChange = useCallback(
    (nextView) => {
      console.log("🔄 [Dashboard] View change requested", {
        from: activeView,
        to: nextView,
        isVendor: user?.isVendor,
      });

      // Redirect non-vendors trying to access analytics
      if (nextView === "vendor" && !user?.isVendor) {
        console.log(
          "⚠️ [Dashboard] Non-vendor accessing analytics → Redirect to registration",
        );
        setActiveView("vendor-register");
        return;
      }

      setActiveView(nextView);
    },
    [activeView, user?.isVendor],
  );

  // ✅ Modal Handlers
  const openDeleteModal = useCallback((id, title) => {
    setDeleteTarget({ id, title });
    setIsDeleteModalOpen(true);
  }, []);

  const openAnalyticsModal = useCallback((eventId) => {
    setAnalyticsTargetId(eventId);
    setIsAnalyticsModalOpen(true);
  }, []);

  // ================================================================
  // RENDER GUARDS
  // ================================================================

  // 1. Loading State - Before initialization
    if (!isInitialized) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Loading Dashboard
            </h3>
            <p className="text-sm text-gray-500">Verifying session...</p>
          </div>
        </div>
      );
    }

  // 2. Unauthenticated State - Redirect to login
  if (!isAuthenticated || !user) {
    console.warn(
      "❌ [Dashboard] User not authenticated → Redirecting to login",
    );
    router.push("/auth/login");
    return null;
  }

    if (activeView === null) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Loading Dashboard
            </h3>
            <p className="text-sm text-gray-500">Preparing your workspace...</p>
          </div>
        </div>
      );
    }
  // ================================================================
  // MAIN RENDER
  // ================================================================

  console.log("✅ [Dashboard] Rendering", {
    activeView,
    hasEvents: user.hasEvents,
    isVendor: user.isVendor,
    eventsCount: events.length,
  });

  return (
    <>
      <DashboardLayout
        userName={user.name}
        activeView={activeView}
        onViewChange={handleViewChange}
        isVendor={user.isVendor}
        hasEvents={user.hasEvents}
        onLogout={() => logout()}
      >
        <DashboardSwitcher
          activeView={activeView}
          user={user}
          events={events}
          isLoading={isEventsQueryLoading}
          eventsError={eventsError}
          openDeleteModal={openDeleteModal}
          openAnalyticsModal={openAnalyticsModal}
          onCreateEvent={() => router.push("/events/create-events")}
          refetchUserEvents={() =>
            queryClient.invalidateQueries({ queryKey: eventKeys.user(user.id) })
          }
        />
      </DashboardLayout>

      {/* Modals - Persistent across view changes */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        eventId={deleteTarget.id}
        eventTitle={deleteTarget.title}
      />

      <AnalyticsModal
        isOpen={isAnalyticsModalOpen}
        onClose={() => setIsAnalyticsModalOpen(false)}
        eventId={analyticsTargetId}
        eventTitle={currentEvent?.eventTitle}
      />
    </>
  );
}
