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
      console.group("🔄 Vendor Submission");
      console.log("📋 Form data:", formData);
      console.log("👤 User ID:", userId);
      console.log("🎯 Vendor ID:", vendorId || "New vendor");
      console.log("🖼️ Image file:", imageFile?.name || "No new image");

      setSubmitError(null);
      setIsSubmitting(true);
      setUploadProgress(0);

      // Track uploaded image for potential rollback
      let newImageUrl = null;
      let oldImageUrl = null;
      let shouldRollbackImage = false;

      try {
        // ✅ STEP 1: Handle image upload
        const hasNewImage = imageFile instanceof File;
        const hasExistingImage =
          typeof formData.imageURL === "string" && formData.imageURL;

        if (hasNewImage) {
          console.log("📤 Uploading new vendor image...");
          const uploadStartTime = Date.now();

          // Store old image URL for cleanup (update scenario)
          if (vendorId && hasExistingImage) {
            oldImageUrl = formData.imageURL;
            console.log("📌 Old image marked for replacement:", oldImageUrl);
          }

          // Upload new image
          newImageUrl = await handleVendorImageUpload(
            imageFile,
            vendorId,
            (progress) => {
              setUploadProgress(progress);
              console.log(`📊 Upload progress: ${progress}%`);
            },
          );
          shouldRollbackImage = true; // Mark for rollback if mutation fails

          console.log(`✅ Image uploaded in ${Date.now() - uploadStartTime}ms`);
          console.log("📸 New Image URL:", newImageUrl);
        } else if (hasExistingImage) {
          newImageUrl = formData.imageURL;
          console.log("📝 Using existing image URL");
        }

        // ✅ STEP 2: Prepare payload
        console.log("📦 Preparing vendor payload...");
        const payload = prepareVendorPayload(formData, newImageUrl, userId);
        console.log("📤 Payload:", JSON.stringify(payload, null, 2));

        // ✅ STEP 3: Execute mutation
        const isUpdate = !!vendorId;
        const mutationStartTime = Date.now();

        if (isUpdate) {
          console.log("🔄 Updating vendor...");
          await updateMutation.mutateAsync({
            vendorId,
            vendorData: payload,
          });
          console.log(`✅ Updated in ${Date.now() - mutationStartTime}ms`);

          // ✅ STEP 4: Cleanup old image AFTER successful update
          if (oldImageUrl && newImageUrl && oldImageUrl !== newImageUrl) {
            console.log(
              "🗑️ Deleting old vendor image after successful update...",
            );
            try {
              await deleteVendorImage(oldImageUrl);
              console.log("✅ Old vendor image cleaned up successfully");
            } catch (cleanupError) {
              // Log but don't fail the operation - vendor is already updated
              console.warn(
                "⚠️ Failed to cleanup old vendor image (non-critical):",
                cleanupError,
              );
            }
          }

          toastAlert.success("Vendor profile updated successfully");
        } else {
          console.log("🆕 Creating vendor...");
          await registerMutation.mutateAsync(payload);
          console.log(`✅ Created in ${Date.now() - mutationStartTime}ms`);
          toastAlert.success("Vendor registered successfully");
        }

        console.log("🏁 Vendor submission successful");
        console.groupEnd();

        // Call success callback
        if (onSuccess) onSuccess();
      } catch (error) {
        console.group("❌ Vendor Submission Error");
        console.error("Error:", error);

        // ✅ CRITICAL: Rollback newly uploaded image on mutation failure
        if (shouldRollbackImage && newImageUrl) {
          console.log(
            "🔄 Rolling back uploaded vendor image due to mutation failure...",
          );
          try {
            await deleteVendorImage(newImageUrl);
            console.log(
              "✅ Rollback successful - orphaned vendor image deleted",
            );
          } catch (rollbackError) {
            console.error(
              "❌ Rollback failed - orphaned vendor image may exist:",
              rollbackError,
            );
            // This is critical - consider alerting admin/monitoring system
          }
        }

        let errorMessage = error.message || "Failed to save vendor profile";
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
