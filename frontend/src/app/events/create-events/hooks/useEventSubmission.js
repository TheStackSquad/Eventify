// frontend/src/app/events/create-events/hooks/useEventSubmission.js
import { useState, useCallback } from "react";
import { useCreateEvent, useUpdateEvent } from "@/utils/hooks/useEvents";
import { prepareEventPayload } from "../utils/eventTransformers";
import {
  handleImageUpload,
  deleteImage,
  validateEventForm,
} from "../services/eventServices";
import  toastAlert from "@/components/common/toast/toastAlert";
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
  router,
  initialData = null, // This is our 'stableInitialData' from useEventForm
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const createEventMutation = useCreateEvent(userId);
  const updateEventMutation = useUpdateEvent(userId);

  const handleSubmit = useCallback(
    async (finalFormData) => {
      setSubmitError(null);

      if (!userId) {
        toastAlert.error(ERROR_MESSAGES.AUTH_REQUIRED);
        return;
      }

      // 1. Integrity Validation
      const { isValid, errors } = validateEventForm(finalFormData, initialData);

      if (!isValid) {
        errors.forEach((err) => toastAlert.error(err));
        return;
      }

      setIsSubmitting(true);
      let newImageUrl = null;
      let shouldRollbackImage = false;

      try {
        const imageValue = finalFormData.eventImage;
        const isNewFile = imageValue instanceof File || (imageValue && typeof imageValue !== "string");
        
        // 2. Image Asset Management
        if (isNewFile) {
          // Upload new image
          newImageUrl = await handleImageUpload(imageValue, eventId || "new");
          shouldRollbackImage = true;
        } else {
          newImageUrl = imageValue; // Use existing URL
        }

        // 3. Payload Preparation
        const finalPayload = prepareEventPayload(finalFormData, newImageUrl);

        // 4. Persistence
        if (eventId) {
          const oldImageUrl = initialData?.eventImage;

          await updateEventMutation.mutateAsync({
            eventId,
            updates: finalPayload,
          });

          // 5. Post-Update Cleanup
          // Only delete if we actually uploaded a new one and the old one was a blob
          if (isNewFile && oldImageUrl && oldImageUrl !== newImageUrl && oldImageUrl.includes("blob.vercel-storage.com")) {
            deleteImage(oldImageUrl).catch(err => console.warn("Old image cleanup failed:", err));
          }
          
          toastAlert.success(SUCCESS_MESSAGES.EVENT_UPDATED);
        } else {
          await createEventMutation.mutateAsync(finalPayload);
          toastAlert.success(SUCCESS_MESSAGES.EVENT_CREATED);
          setFormData(INITIAL_FORM_DATA);
        }

        router.push(ROUTES.MY_EVENTS);
      } catch (error) {
        // 6. Transactional Rollback
        if (shouldRollbackImage && newImageUrl) {
          console.log("🔄 Rolling back image upload due to DB failure...");
          await deleteImage(newImageUrl).catch(console.error);
        }

        const msg = error.response?.data?.message || error.message || "Submission failed";
        toastAlert.error(msg);
        setSubmitError(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, eventId, initialData, createEventMutation, updateEventMutation, router, setFormData]
  );

  return { isSubmitting, submitError, handleSubmit };
}