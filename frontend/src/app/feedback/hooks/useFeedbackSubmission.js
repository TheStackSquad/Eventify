// frontend/src/app/feedback/hooks/useFeedbackSubmission.js

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadToBlob, deleteFromBlob } from "@/services/mediaServices";
import { createFeedbackAPI } from "@/services/feedbackAPI";
import toastAlert from "@/components/common/toast/toastAlert";

export default function useFeedbackSubmission(onSuccess) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ formData, imageFile }) => {
      let uploadedImageUrl = "";
      let blobPathname = "";

      // 1. Optional Image Upload phase
      if (imageFile) {
        setUploadProgress(20);
        try {
          const uploadResult = await uploadToBlob(
            imageFile,
            "/api/feedback-image"
          );
          uploadedImageUrl = uploadResult.url;
          blobPathname = uploadResult.filename; // Captured for potential cleanup
          setUploadProgress(60);
        } catch (uploadError) {
          throw new Error("Image upload failed. Please try again.");
        }
      }

      // 2. Data Submission phase
      try {
        const payload = { ...formData, imageUrl: uploadedImageUrl };
        const response = await createFeedbackAPI(payload);
        setUploadProgress(100);
        return response;
      } catch (apiError) {
        // 3. ATOMIC CLEANUP: Rollback image if backend fails
        if (blobPathname) {
          // Fire and forget cleanup or await depending on preference
          // Awaiting ensures we don't finish the catch block until cleanup is attempted
          await deleteFromBlob(blobPathname).catch((err) =>
            console.error("Cleanup failed for:", blobPathname, err)
          );
        }

        // Extract meaningful error from backend or fallback
        const errorMessage =
          apiError.response?.data?.message || "Server rejected feedback.";
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      // Refresh admin lists if they are open in the background
      queryClient.invalidateQueries({ queryKey: ["feedbackList"] });

      // Single source of success toast
      toastAlert.success("Thank you! Your feedback has been received.");

      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      // Single source of error toast
      toastAlert.error(error.message);
    },
    onSettled: () => {
      setUploadProgress(0);
    },
  });

  return {
    submitFeedback: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    uploadProgress,
    status: mutation.status,
  };
}
