// frontend/src/app/dashboard/page.js
"use client";

import React, { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useLogout } from "@/utils/hooks/useAuth";
import { useUserEvents, eventKeys } from "@/utils/hooks/useEvents";

import DashboardLayout from "@/components/dashboard/eventComponents/dashboardLayout";
import MyEventsDashboard from "@/components/dashboard/eventComponents/myEventsDashboard";
import VendorsDashboard from "@/components/dashboard/vendorComponents/vendorDashboard";
import DeleteModal from "@/components/modal/delete";
import AnalyticsModal from "@/components/modal/analytics";

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutate: logout } = useLogout();

  // Auth state
  const { user, sessionChecked, isAuthenticated } = useAuth();

  // ✅ Events query - returns flat array directly
  const {
    data: events = [], // Always an array, never undefined
    isLoading: isEventsQueryLoading,
    error: eventsError,
  } = useUserEvents(user?.id, isAuthenticated);

  // Local UI state
  const [activeView, setActiveView] = React.useState("events");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState({
    id: null,
    title: "",
  });
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = React.useState(false);
  const [analyticsTargetId, setAnalyticsTargetId] = React.useState(null);

  // Computed values
  const isLoading =
    !sessionChecked || (isAuthenticated && isEventsQueryLoading);

  // ✅ Simple lookup - events is already a flat array
  const currentEvent = useMemo(
    () => events.find((e) => e.id === analyticsTargetId),
    [events, analyticsTargetId]
  );

  // Event handlers
  const openDeleteModal = useCallback((id, title) => {
    setDeleteTarget({ id, title });
    setIsDeleteModalOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    setDeleteTarget({ id: null, title: "" });
  }, []);

  const openAnalyticsModal = useCallback((eventId) => {
    setAnalyticsTargetId(eventId);
    setIsAnalyticsModalOpen(true);
  }, []);

  const closeAnalyticsModal = useCallback(() => {
    setIsAnalyticsModalOpen(false);
    setAnalyticsTargetId(null);
  }, []);

  const handleLogout = useCallback(() => {
    logout(undefined, {
      onSuccess: () => router.push("/account/auth/login"),
      onError: () => router.push("/account/auth/login"),
    });
  }, [logout, router]);

  const handleCreateEvent = useCallback(() => {
    router.push("/events/create-events");
  }, [router]);

  const refetchUserEvents = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: eventKeys.user(user?.id) });
  }, [queryClient, user?.id]);

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
  if (eventsError && events.length === 0 && activeView === "events") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
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

  // ✅ Simplified empty state check - events is always an array
  if (events.length === 0 && isAuthenticated && activeView === "events") {
    return (
      <DashboardLayout
        userName={user?.name}
        activeView={activeView}
        onViewChange={setActiveView}
        onLogout={handleLogout}
      >
        <MyEventsDashboard
          events={[]}
          isLoading={false}
          onCreateEvent={handleCreateEvent}
          openDeleteModal={openDeleteModal}
          openAnalyticsModal={openAnalyticsModal}
        />
      </DashboardLayout>
    );
  }

  // Main render
  return (
    <>
      <DashboardLayout
        userName={user?.name}
        activeView={activeView}
        onViewChange={setActiveView}
        onLogout={handleLogout}
      >
        {activeView === "events" && (
          <MyEventsDashboard
            events={events} // ✅ Always a flat array
            isLoading={isEventsQueryLoading}
            onCreateEvent={handleCreateEvent}
            openDeleteModal={openDeleteModal}
            openAnalyticsModal={openAnalyticsModal}
          />
        )}

        {(activeView === "vendor" || activeView === "vendor-register") && (
          <VendorsDashboard activeView={activeView} />
        )}
      </DashboardLayout>

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        eventId={deleteTarget.id}
        eventTitle={deleteTarget.title}
      />

      <AnalyticsModal
        isOpen={isAnalyticsModalOpen}
        onClose={closeAnalyticsModal}
        eventId={analyticsTargetId}
        eventTitle={currentEvent?.eventTitle}
      />
    </>
  );
}
