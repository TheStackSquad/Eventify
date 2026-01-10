// frontend/src/app/events/create-events/page.js

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/utils/hooks/useAuth";
import useEventForm from "@/app/events/create-events/hooks/useEventForm";
import useEventSubmission from "@/app/events/create-events/hooks/useEventSubmission";
import CreateEventForm from "@/components/create-events/create";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import toastAlert from "@/components/common/toast/toastAlert";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  ROUTES,
} from "@/utils/constants/globalConstants";

export default function CreateEventsPage() {
  // ========== HOOKS ==========
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("id");

  // ========== AUTHENTICATION ==========
  const { user, sessionChecked, isAuthenticated } = useAuth();

  // ========== CUSTOM HOOKS ==========
  const {
    formData,
    setFormData,
    isLoading: isFormLoading,
    error: formError,
    isError: isFormError,
    handleFormChange,
  } = useEventForm(eventId, user?.id);

  const {
    isSubmitting,
    handleSubmit: handleFormSubmit,
    handleImageUpload,
  } = useEventSubmission(eventId, user?.id, setFormData, router);

  // ========== RENDER LOGIC ==========

  // Show loading while checking authentication or loading form data
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

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    toastAlert.error(ERROR_MESSAGES.AUTH_REQUIRED);
    router.push(ROUTES.LOGIN);
    return null;
  }

  // Navigation handlers
  const handleBack = () => router.back();
  const handleCancel = () => router.push(ROUTES.MY_EVENTS);

  // Determine mode
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
        onBack={handleBack}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
        mode={isEditMode ? "edit" : "create"}
        isEditMode={isEditMode}
      />
    </div>
  );
}
