// frontend/src/app/events/create-events/hooks/useEventSubmission.js
import { useState, useCallback } from "react";
import { useCreateEvent, useUpdateEvent } from "@/utils/hooks/useEvents";
import { prepareEventPayload } from "../utils/eventTransformers";
import {
  handleImageUpload,
  deleteImage,
  validateEventForm,
} from "../services/eventServices";
import toastAlert from "@/components/common/toast/toastAlert";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  ROUTES,
} from "@/utils/constants/globalConstants";
import { INITIAL_FORM_DATA } from "@/components/create-events/constants/formConfig";

export default function useEventSubmission(
  eventId,
  userId,
  setFormData,
  setErrors,
  router,
  initialData = null,
) {
  // State Management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

  // Hooks
  const createEventMutation = useCreateEvent(userId);
  const updateEventMutation = useUpdateEvent(userId);

  // Main Submission Handler
  const handleSubmit = useCallback(
    async (finalFormData) => {
      // Reset state
      setSubmitError(null);
      if (setErrors) setErrors({});

      // Authentication check
      if (!userId) {
        toastAlert.error(ERROR_MESSAGES.AUTH_REQUIRED);
        return;
      }

      // 1. Form Validation
      const {
        isValid,
        errors: validationErrors,
        errorMap,
      } = validateEventForm(finalFormData, initialData);

      if (!isValid) {
        if (setErrors && errorMap) {
          setErrors(errorMap);
        }
        validationErrors.forEach((err) => toastAlert.error(err));
        return;
      }

      // Start submission flow
      setIsSubmitting(true);
      let newImageUrl = null;
      let shouldRollbackImage = false;

      try {
        const imageValue =
          finalFormData.eventImageFile || finalFormData.eventImage;
        const isNewFile =
          imageValue instanceof File ||
          (imageValue && typeof imageValue !== "string");

        // 2. Image Upload (if needed)
        if (isNewFile) {
          setCurrentStep("Uploading image...");
          setUploadProgress(30);
          newImageUrl = await handleImageUpload(imageValue, eventId || "new");
          shouldRollbackImage = true;
          setUploadProgress(60);
        } else {
          newImageUrl = imageValue;
        }

        // 3. Prepare API payload
        const finalPayload = prepareEventPayload(finalFormData, newImageUrl);
        setCurrentStep(eventId ? "Updating event..." : "Creating event...");

        // 4. Database Operation
        if (eventId) {
          const oldImageUrl = initialData?.eventImage;

          await updateEventMutation.mutateAsync({
            eventId,
            updates: finalPayload,
          });

          setUploadProgress(100);
          setCurrentStep("Success!");

          // 5. Clean up old image
          if (
            isNewFile &&
            oldImageUrl &&
            oldImageUrl !== newImageUrl &&
            oldImageUrl.includes("blob.vercel-storage.com")
          ) {
            deleteImage(oldImageUrl).catch((err) =>
              console.warn("Old image cleanup failed:", err),
            );
          }

          toastAlert.success(SUCCESS_MESSAGES.EVENT_UPDATED);
        } else {
          await createEventMutation.mutateAsync(finalPayload);
          toastAlert.success(SUCCESS_MESSAGES.EVENT_CREATED);
          setFormData(INITIAL_FORM_DATA);
        }

        // 6. Navigation
        router.push(ROUTES.BASE);
      } catch (error) {
        // 7. Transaction Rollback
        if (shouldRollbackImage && newImageUrl) {
          console.log("Rolling back image upload due to DB failure...");
          await deleteImage(newImageUrl).catch(console.error);
        }

        const msg =
          error.response?.data?.message || error.message || "Submission failed";
        toastAlert.error(msg);
        setSubmitError(error);
      } finally {
        // Cleanup
        setIsSubmitting(false);
        setUploadProgress(0);
        setCurrentStep("");
      }
    },
    [
      userId,
      eventId,
      initialData,
      createEventMutation,
      updateEventMutation,
      router,
      setFormData,
      setErrors,
    ],
  );

  // Return hook interface
  return {
    handleSubmit,
    isSubmitting,
    submitError,
    uploadProgress,
    currentStep,
  };
}
