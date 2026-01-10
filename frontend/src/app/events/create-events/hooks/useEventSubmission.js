// frontend/src/app/events/create-events/hooks/useEventSubmission.js

import { useState, useCallback } from "react";
import { useCreateEvent, useUpdateEvent } from "@/utils/hooks/useEvents";
import { prepareEventPayload } from "../utils/eventTransformers";
import { handleImageUpload } from "../services/eventServices";
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
  router
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const createEventMutation = useCreateEvent(userId);
  const updateEventMutation = useUpdateEvent(userId);

  const handleSubmit = useCallback(
    async (finalFormData) => {
      console.group("🔄 Event Submission");
      console.log("📋 Form data:", finalFormData);
      console.log("👤 User ID:", userId);
      console.log("🎯 Event ID:", eventId || "New event");

      setSubmitError(null);

      // Authentication check
      if (!userId) {
        console.error("❌ No user ID - Authentication required");
        console.groupEnd();
        toastAlert.error(ERROR_MESSAGES.AUTH_REQUIRED);
        setSubmitError(new Error(ERROR_MESSAGES.AUTH_REQUIRED));
        return;
      }

      // Form data validation
      if (typeof finalFormData !== "object" || Array.isArray(finalFormData)) {
        console.error("❌ Invalid form data structure:", {
          type: typeof finalFormData,
          isArray: Array.isArray(finalFormData),
        });
        console.groupEnd();
        toastAlert.error("Invalid form data received");
        setSubmitError(new Error("Invalid form data structure"));
        return;
      }

      setIsSubmitting(true);

      try {
        // Handle image upload
        let imageUrl = null;

        if (
          finalFormData.eventImage &&
          typeof finalFormData.eventImage !== "string"
        ) {
          console.log("📤 Uploading new image...");
          const uploadStartTime = Date.now();

          imageUrl = await handleImageUpload(finalFormData.eventImage);

          console.log(`✅ Image uploaded in ${Date.now() - uploadStartTime}ms`);
          console.log("📸 Image URL:", imageUrl);
        } else if (finalFormData.eventImage) {
          imageUrl = finalFormData.eventImage;
          console.log("📝 Using existing image URL");
        }

        // Prepare payload (no userId sent to backend)
        console.log("📦 Preparing payload...");
        const finalPayload = prepareEventPayload(finalFormData, imageUrl);

        console.log("📤 Payload:", JSON.stringify(finalPayload, null, 2));

        // Execute mutation
        const isUpdate = !!eventId;
        const mutationStartTime = Date.now();

        if (isUpdate) {
          console.log("🔄 Updating event...");
          await updateEventMutation.mutateAsync({
            eventId,
            updates: finalPayload,
          });
          console.log(`✅ Updated in ${Date.now() - mutationStartTime}ms`);
          toastAlert.success(SUCCESS_MESSAGES.EVENT_UPDATED);
        } else {
          console.log("🆕 Creating event...");
          await createEventMutation.mutateAsync(finalPayload);
          console.log(`✅ Created in ${Date.now() - mutationStartTime}ms`);
          toastAlert.success(SUCCESS_MESSAGES.EVENT_CREATED);
          setFormData(INITIAL_FORM_DATA);
        }

        console.log("🏁 Submission successful");
        console.groupEnd();
        router.push(ROUTES.MY_EVENTS);
      } catch (error) {
        console.group("❌ Submission Error");
        console.error("Error:", error);

        let errorMessage = error.message || "Unknown error occurred";

        if (error.response) {
          console.error("Status:", error.response.status);
          console.error("Data:", error.response.data);
          errorMessage = error.response.data?.message || errorMessage;
        } else if (error.request) {
          console.error("No response received");
          errorMessage = "No response from server. Check your connection.";
        }

        console.groupEnd();
        toastAlert.error(errorMessage);
        setSubmitError(error);
      } finally {
        setIsSubmitting(false);
        console.groupEnd();
      }
    },
    [
      userId,
      eventId,
      createEventMutation,
      updateEventMutation,
      router,
      setFormData,
    ]
  );

  return {
    isSubmitting,
    submitError,
    handleSubmit,
    mutationStatus: {
      create: createEventMutation,
      update: updateEventMutation,
    },
  };
}
