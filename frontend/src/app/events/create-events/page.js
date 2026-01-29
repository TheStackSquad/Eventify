// frontend/src/app/events/create-events/page.js
"use client";

import React, { Suspense } from "react";
import AuthGuard from "@/components/auth/authGuard";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import EventFormContainer from "./components/eventFormContainer";

// Auth wrapper component
function CreateEventPageWrapper() {
  return (
    <AuthGuard>
      <EventFormContainer />
    </AuthGuard>
  );
}

// Main page component with suspense
export default function CreateEventsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
          <LoadingSpinner
            message="Preparing form layout..."
            color="white"
            className="!bg-transparent"
            fullScreen={false}
          />
        </div>
      }
    >
      <CreateEventPageWrapper />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
