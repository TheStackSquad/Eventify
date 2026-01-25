// src/app/events/create-events/components/eventFormContainer.js
"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/utils/hooks/useAuth";
import useEventForm from "@/app/events/create-events/hooks/useEventForm";
import useEventSubmission from "@/app/events/create-events/hooks/useEventSubmission";
import CreateEventForm from "@/components/create-events/create";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import { ERROR_MESSAGES, ROUTES } from "@/utils/constants/globalConstants";

export default function EventFormContainer({ eventId }) {
  const router = useRouter();
  const { user } = useAuth();

  const {
    formData,
    setFormData,
    stableInitialData,
    isLoading: isFormLoading,
    error: formError,
    isError: isFormError,
    errors,
    setErrors,
    handleFormChange,
  } = useEventForm(eventId, user.id);

  const { isSubmitting, handleSubmit: handleFormSubmit } = useEventSubmission(
    eventId,
    user.id,
    setFormData,
    setErrors,
    router,
    stableInitialData,
  );

  const handleImageUpload = (file, previewUrl) => {
    handleFormChange({
      ...formData,
      eventImageFile: file,
      eventImagePreview: previewUrl,
    });
  };

  if (isFormLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner message={eventId ? "Fetching event details..." : "Loading..."} color="white" />
      </div>
    );
  }

  if (isFormError) {
    return (
       <div className="text-center p-8 border border-red-500 rounded-xl bg-red-900/10">
         <h2 className="text-red-400 font-bold text-xl mb-2">Error Loading Event</h2>
         <p className="text-gray-400 mb-4">{formError?.message || "Could not retrieve data."}</p>
         <button onClick={() => router.push(ROUTES.MY_EVENTS)} className="text-white bg-red-600 px-4 py-2 rounded">
           Return to My Events
         </button>
       </div>
    );
  }

  return (
    <CreateEventForm
      formData={formData}
      errors={errors}
      onFormChange={handleFormChange}
      onImageUpload={handleImageUpload}
      onSubmit={() => handleFormSubmit(formData)}
      onBack={() => router.back()}
      isSubmitting={isSubmitting}
      isEditMode={!!eventId}
    />
  );
}