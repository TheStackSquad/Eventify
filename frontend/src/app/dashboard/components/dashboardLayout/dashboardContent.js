// frontend/src/app/dashboard/components/dashboardLayout/dashboardContent.js
"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useLogout } from "@/utils/hooks/useAuth";
import { useUserEvents, eventKeys } from "@/utils/hooks/useEvents";

import DashboardLayout from "@/components/dashboard/eventComponents/dashboardLayout";
import MyEventsDashboard from "@/components/dashboard/eventComponents/myEventsDashboard";
import VendorsDashboard from "@/components/dashboard/vendorComponents/vendorDashboard";
import DeleteModal from "@/components/modal/delete";
import AnalyticsModal from "@/components/modal/analytics";

export default function DashboardContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutate: logout } = useLogout();
  const { user } = useAuth();

  // ================================================================
  // DATA FETCHING
  // ================================================================
  // AuthGuard ensures user exists, so user.id is always defined here
  const {
    data: events = [],
    isLoading: isEventsQueryLoading,
    error: eventsError,
  } = useUserEvents(user.id, true); // No need for user?.id

  // ================================================================
  // LOCAL STATE
  // ================================================================
  const [activeView, setActiveView] = useState("events");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState({ id: null, title: "" });
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [analyticsTargetId, setAnalyticsTargetId] = useState(null);

  const currentEvent = useMemo(
    () => events.find((e) => e.id === analyticsTargetId),
    [events, analyticsTargetId],
  );

  // ================================================================
  // EVENT HANDLERS
  // ================================================================
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
    queryClient.invalidateQueries({ queryKey: eventKeys.user(user.id) });
  }, [queryClient, user.id]);

  // ================================================================
  // ERROR STATE
  // ================================================================
  if (eventsError && events.length === 0 && activeView === "events") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
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

  // ================================================================
  // MAIN RENDER
  // ================================================================
  return (
    <>
      <DashboardLayout
        userName={user.name}
        activeView={activeView}
        onViewChange={setActiveView}
        onLogout={handleLogout}
      >
        {activeView === "events" && (
          <MyEventsDashboard
            events={events}
            user={user}
            isLoading={isEventsQueryLoading}
            onCreateEvent={handleCreateEvent}
            openDeleteModal={openDeleteModal}
            openAnalyticsModal={openAnalyticsModal}
          />
        )}

        {(activeView === "vendor" || activeView === "vendor-register") && (
          <VendorsDashboard
            activeView={activeView}
            user={user}
            sessionChecked={true}
          />
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
