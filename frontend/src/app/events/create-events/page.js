// frontend/src/app/events/create-events/page.js

"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/utils/hooks/useAuth";
import useEventForm from "@/app/events/create-events/hooks/useEventForm";
import useEventSubmission from "@/app/events/create-events/hooks/useEventSubmission";
import CreateEventForm from "@/components/create-events/create";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import { ERROR_MESSAGES, ROUTES } from "@/utils/constants/globalConstants";

function CreateEventContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("id");

  const { user, sessionChecked, isAuthenticated } = useAuth();

  // 1. Manage Form State & Load Existing Data
  const {
    formData,
    setFormData,
    stableInitialData, // 🛡️ Captured the "Baseline" here
    isLoading: isFormLoading,
    error: formError,
    isError: isFormError,
    handleFormChange,
  } = useEventForm(eventId, user?.id);

  // 2. Manage Submission & Validation Logic
  const { isSubmitting, handleSubmit: handleFormSubmit } = useEventSubmission(
    eventId,
    user?.id,
    setFormData,
    router,
    stableInitialData, // 🔗 Linked the snapshot to the submission logic
  );

  // 3. Auth Redirect Guard
  useEffect(() => {
    if (sessionChecked && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
  }, [sessionChecked, isAuthenticated, router]);

  if (!sessionChecked || (eventId && isFormLoading)) {
    return (
      <LoadingSpinner
        message={
          !sessionChecked
            ? "Checking authentication..."
            : "Loading event data..."
        }
        size="lg"
        color="indigo"
      />
    );
  }

  if (!isAuthenticated || !user) return null;

  const isEditMode = !!eventId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black py-8 px-4 sm:px-6 lg:px-8">
      {isFormError && formError && (
        <div className="max-w-4xl mx-auto mb-4">
          <div className="bg-red-900/10 border border-red-500 text-red-300 p-3 rounded-lg">
            <p className="font-medium">Error:</p>
            <p>{formError.message || ERROR_MESSAGES.FETCH_EVENT_FAILED}</p>
          </div>
        </div>
      )}

      <CreateEventForm
        formData={formData}
        onFormChange={handleFormChange}
        onSubmit={handleFormSubmit}
        onBack={() => router.back()}
        onCancel={() => router.push(ROUTES.MY_EVENTS)}
        isSubmitting={isSubmitting}
        mode={isEditMode ? "edit" : "create"}
        isEditMode={isEditMode}
      />
    </div>
  );
}

export default function CreateEventsPage() {
  return (
    <Suspense
      fallback={<LoadingSpinner message="Preparing form..." color="indigo" />}
    >
      <CreateEventContent />
    </Suspense>
  );
}