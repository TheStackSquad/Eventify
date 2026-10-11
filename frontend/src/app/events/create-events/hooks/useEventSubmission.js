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
import { ROUTES } from "@/utils/constants/globalConstants";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "@/utils/constants/errorMessages";
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
    console.group("🚀 [useEventSubmission] START Submission Flow");

    // 1. Initial Validation & ID Checks
    if (eventId && (eventId === "undefined" || eventId === undefined)) {
      console.error("❌ Invalid eventId detected!");
      toastAlert.error("Invalid event ID. Please refresh and try again.");
      console.groupEnd();
      return;
    }

    if (!userId) {
      console.error("❌ No user ID provided");
      toastAlert.error(ERROR_MESSAGES.AUTH_REQUIRED);
      console.groupEnd();
      return;
    }

    // Form Validation
    const {
      isValid,
      errors: validationErrors,
      errorMap,
    } = validateEventForm(finalFormData, initialData);
    if (!isValid) {
      if (setErrors && errorMap) setErrors(errorMap);
      validationErrors.forEach((err) => toastAlert.error(err));
      console.groupEnd();
      return;
    }

    // 2. State Initialization
    setIsSubmitting(true);
    setSubmitError(null);
    if (setErrors) setErrors({});

    let newImageUrl = null;
    let shouldRollbackImage = false;

    try {
      // 3. Image Upload Logic
      const imageValue =
        finalFormData.eventImageFile || finalFormData.eventImage;
      const isNewFile =
        imageValue instanceof File ||
        (imageValue && typeof imageValue !== "string");

      if (isNewFile) {
        setCurrentStep("Uploading image...");
        setUploadProgress(30);
        // handleImageUpload is used here
        newImageUrl = await handleImageUpload(imageValue, eventId || "new");
        shouldRollbackImage = true;
        setUploadProgress(60);
      } else {
        newImageUrl = imageValue;
      }

      // 4. Prepare API payload
      const finalPayload = prepareEventPayload(
        finalFormData,
        newImageUrl,
        !!eventId,
      );

      // 5. Database Operation (Update vs Create)
      if (eventId) {
        setCurrentStep("Updating event...");
        const oldImageUrl = initialData?.eventImage;

        const result = await updateEventMutation.mutateAsync({
          eventId: eventId,
          updates: finalPayload,
        });

        console.log("✅ Update mutation result:", result);

        // Success Sequence for Update
        setUploadProgress(100);
        setCurrentStep("Update Successful!");
        toastAlert.success(
          SUCCESS_MESSAGES.EVENT_UPDATED || "Changes saved successfully!",
        );

        // Cleanup old image if necessary
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
      } else {
        setCurrentStep("Creating event...");
        const result = await createEventMutation.mutateAsync(finalPayload);

        console.log("✅ Create mutation result:", result);

        // Success Sequence for Creation
        setUploadProgress(100);
        setCurrentStep("Event Created!");
        toastAlert.success(
          SUCCESS_MESSAGES.EVENT_CREATED || "Your event has been published!",
        );
        setFormData(INITIAL_FORM_DATA);
      }

      // 6. Navigation with UX Delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push(ROUTES.BASE);
    } catch (error) {
      console.group("❌ SUBMISSION ERROR");
      console.error("Error details:", error);

      if (shouldRollbackImage && newImageUrl) {
        await deleteImage(newImageUrl).catch(console.error);
      }

      const msg =
        error.response?.data?.message || error.message || "Submission failed";
      toastAlert.error(msg);
      setSubmitError(error);
      console.groupEnd();
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
      setCurrentStep("");
      console.groupEnd();
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
    // handleImageUpload removed to satisfy linter
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
