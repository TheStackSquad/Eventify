// frontend/src/app/vendors/hooks/useVendorSubmission.js

import { useState, useCallback } from "react";
import {
  useRegisterVendor,
  useUpdateVendor,
} from "@/utils/hooks/useVendorData";
import { prepareVendorPayload } from "../utils/vendorTransformers";
import {
  handleVendorImageUpload,
  deleteVendorImage,
} from "@/services/vendorServices";
import toastAlert from "@/components/common/toast/toastAlert";

export default function useVendorSubmission(vendorId, userId, onSuccess) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitError, setSubmitError] = useState(null);

  const registerMutation = useRegisterVendor();
  const updateMutation = useUpdateVendor();

  const handleSubmit = useCallback(
    async (formData, imageFile) => {
      const isUpdate = !!vendorId;
      setSubmitError(null);
      setIsSubmitting(true);
      setUploadProgress(0);

      let newImageUrl = null;
      let oldImageUrl = null;
      let shouldRollbackImage = false;

      try {
        // STEP 1: Handle image upload
        const hasNewImage = imageFile instanceof File;
        const hasExistingImage =
          typeof formData.imageURL === "string" && formData.imageURL;

        if (hasNewImage) {
          // Store old image for cleanup
          if (vendorId && hasExistingImage) {
            oldImageUrl = formData.imageURL;
          }

          // Upload new image
          newImageUrl = await handleVendorImageUpload(
            imageFile,
            vendorId,
            (progress) => setUploadProgress(progress),
          );
          shouldRollbackImage = true;
        } else if (hasExistingImage) {
          newImageUrl = formData.imageURL;
        }

        // STEP 2: Prepare payload
        const payload = prepareVendorPayload(
          formData,
          newImageUrl,
          userId,
          isUpdate,
        );

        // STEP 3: Execute mutation
        if (isUpdate) {
          await updateMutation.mutateAsync({ vendorId, vendorData: payload });

          // STEP 4: Cleanup old image after successful update
          if (oldImageUrl && newImageUrl && oldImageUrl !== newImageUrl) {
            try {
              await deleteVendorImage(oldImageUrl);
            } catch (cleanupError) {
              console.warn(
                "Failed to cleanup old image (non-critical):",
                cleanupError,
              );
            }
          }
        } else {
          await registerMutation.mutateAsync(payload);
        }

        // Call success callback
        if (onSuccess) onSuccess();
      } catch (error) {
        // Rollback uploaded image on mutation failure
        if (shouldRollbackImage && newImageUrl) {
          try {
            await deleteVendorImage(newImageUrl);
          } catch (rollbackError) {
            console.error("Rollback failed - orphaned image:", rollbackError);
          }
        }

        let errorMessage = error.message || "Failed to save vendor profile";
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.request) {
          errorMessage = "No response from server. Check your connection.";
        }

        toastAlert.error(errorMessage);
        setSubmitError(error);
      } finally {
        setIsSubmitting(false);
        setUploadProgress(0);
      }
    },
    [vendorId, userId, registerMutation, updateMutation, onSuccess],
  );

  return {
    handleSubmit,
    isSubmitting,
    uploadProgress,
    submitError,
    isLoading: registerMutation.isPending || updateMutation.isPending,
  };
}
