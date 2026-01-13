// frontend/src/app/feedback/hooks/useFeedbackSubmission.js
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  uploadToFeedbackBlob,
  deleteFromBlob,
  validateImageFile,
} from "@/services/mediaServices";
import { createFeedbackAPI } from "@/services/feedbackAPI";
import toastAlert from "@/components/common/toast/toastAlert";

export default function useFeedbackSubmission(onSuccess) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ formData, imageFile }) => {
      let uploadedImageUrl = "";
      let blobPathname = "";
      let cleanupRequired = false;

      // 1. Validate and upload image if provided
      if (imageFile && imageFile.size > 0) {
        // Validate image first
        const validation = validateImageFile(imageFile);
        if (!validation.isValid) {
          throw new Error(`Image validation failed: ${validation.error}`);
        }

        try {
          setUploadProgress(20);

          // Use the existing uploadToBlob function
          const uploadResult = await uploadToFeedbackBlob(
            imageFile,
            "feedback-image"
          );

          uploadedImageUrl = uploadResult.url;
          blobPathname = uploadResult.filename || uploadResult.pathname;
          cleanupRequired = true; // Mark that cleanup is needed if backend fails

          setUploadProgress(60);
          console.log("[useFeedbackSubmission] Image uploaded:", {
            url: uploadedImageUrl,
            pathname: blobPathname,
          });
        } catch (uploadError) {
          console.error(
            "[useFeedbackSubmission] Image upload error:",
            uploadError
          );
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }
      }

      // 2. Prepare payload for backend API
      const payload = {
        name: formData.name,
        email: formData.email,
        type: formData.type,
        message: formData.message,
        imageUrl: uploadedImageUrl, // Could be empty string
      };

      console.log("[useFeedbackSubmission] Submitting to backend:", payload);

      try {
        // 3. Submit feedback to backend
        const response = await createFeedbackAPI(payload);
        setUploadProgress(100);

        // Success - no cleanup needed
        cleanupRequired = false;

        return response;
      } catch (apiError) {
        console.error("[useFeedbackSubmission] Backend API error:", apiError);

        // 4. ATOMIC CLEANUP: Rollback image if backend fails
        if (cleanupRequired && blobPathname) {
          console.log(
            "[useFeedbackSubmission] Starting cleanup of orphaned image:",
            blobPathname
          );

          try {
            // Use the deleteFromBlob function for cleanup
            await deleteFromBlob(blobPathname);
            console.log(
              "[useFeedbackSubmission] Orphaned image cleaned up successfully"
            );
          } catch (cleanupError) {
            console.error(
              "[useFeedbackSubmission] Cleanup failed, adding to orphaned list:",
              cleanupError
            );

            // Store in localStorage for later cleanup (handled by mediaServices.cleanupOrphanedImages)
            const orphaned = JSON.parse(
              localStorage.getItem("orphanedImages") || "[]"
            );
            orphaned.push({
              url: uploadedImageUrl,
              pathname: blobPathname,
              endpoint: "feedback-image",
              timestamp: Date.now(),
              type: "feedback",
            });
            localStorage.setItem("orphanedImages", JSON.stringify(orphaned));
          }
        }

        // Extract user-friendly error message
        const errorMessage =
          apiError.response?.data?.message ||
          apiError.response?.data?.error ||
          apiError.message ||
          "Failed to submit feedback. Please try again.";

        throw new Error(errorMessage);
      }
    },
    onSuccess: (data) => {
      console.log("[useFeedbackSubmission] Success response:", data);

      // Refresh admin lists if they are open
      queryClient.invalidateQueries({ queryKey: ["feedbackList"] });

      // Show success message
      toastAlert.success("Thank you! Your feedback has been received.");

      // Call success callback
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      console.error("[useFeedbackSubmission] Mutation error:", error);

      // Show error message (avoid duplicates if already shown in try-catch)
      if (!error.message.includes("Image upload failed")) {
        toastAlert.error(error.message);
      }
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
    error: mutation.error,
  };
}
