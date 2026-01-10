// frontend/src/app/vendors/hooks/useVendorSubmission.js

import { useState, useCallback, useRef } from "react";
import {
  useRegisterVendor,
  useUpdateVendor,
} from "@/utils/hooks/useVendorData";
import { prepareVendorPayload } from "../utils/vendorTransformers";
import { handleImageUpload, deleteImage } from "@/services/mediaServices";
import toastAlert from "@/components/common/toast/toastAlert";

export default function useVendorSubmission(vendorId, userId, onSuccess) {
   console.log("user:", userId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadedImageRef = useRef(null);
  const registerMutation = useRegisterVendor();
  const updateMutation = useUpdateVendor();

  const handleSubmit = useCallback(
    async (formData, imageFile) => {
      setIsSubmitting(true);
      setUploadProgress(0);
      uploadedImageRef.current = null;

      try {
        // 1. ATOMIC IMAGE UPLOAD
        let finalImageUrl = formData.imageURL;

        console.log('final Image Url:', finalImageUrl);
        if (imageFile) {
          // We use the standardized media service we built earlier
          finalImageUrl = await handleImageUpload(
            imageFile,
            "/api/vendor-image", // Endpoint
            null, // No entityId needed yet for new vendors
            (progress) => setUploadProgress(progress)
          );
          uploadedImageRef.current = finalImageUrl;
        }

        // 2. DATA TRANSFORMATION
        const payload = prepareVendorPayload(formData, finalImageUrl, userId);
         console.log("payload mask off:", payload);

        // 3. BACKEND EXECUTION
        if (vendorId) {
          await updateMutation.mutateAsync({ vendorId, vendorData: payload });
        } else {
          await registerMutation.mutateAsync(payload);
        }

        // 4. SUCCESS
        if (onSuccess) onSuccess();
        uploadedImageRef.current = null;
      } catch (error) {
        if (uploadedImageRef.current) {
          await deleteImage(uploadedImageRef.current, "/api/vendor-image");
        }
        toastAlert.error(error.message || "Failed to save vendor profile");
      } finally {
        setIsSubmitting(false);
        setUploadProgress(0);
      }
    },
    [vendorId, userId, registerMutation, updateMutation, onSuccess]
  );

  return {
    handleSubmit,
    isSubmitting,
    uploadProgress,
    isLoading: registerMutation.isPending || updateMutation.isPending,
  };
}
