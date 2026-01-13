// frontend/src/components/vendorUI/handlers/useVendorFormHandler.js

"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useVendorProfile } from "@/utils/hooks/useVendorData";
import { transformBackendToFrontend } from "@/app/vendor/utils/vendorTransformers";
import useVendorSubmission from "@/app/vendors/hooks/useVendorSubmission";
import {
  vendorRegistrationValidate,
  validateVendorField,
  hasValidationErrors,
} from "@/utils/validate/vendorValidate";
import toastAlert from "@/components/common/toast/toastAlert";

export const useVendorFormHandler = ({ vendorId, userId, onSuccess }) => {
  const isEditMode = !!vendorId;
  const [imageFile, setImageFile] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    state: "",
    city: "",
    minPrice: "",
    phoneNumber: "",
    imageURL: "",
  });

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      category: "",
      state: "",
      city: "",
      minPrice: "",
      phoneNumber: "",
      imageURL: "",
    });
    setImageFile(null);
    setFormErrors({});
  }, []);

  // Intercept success to clear form
  const handleSuccess = useCallback(() => {
    if (!isEditMode) resetForm();
    if (onSuccess) onSuccess();
  }, [isEditMode, onSuccess, resetForm]);

  const {
    data: rawVendorData,
    isLoading: isLoadingVendor,
    isSuccess: isFetchSuccess,
  } = useVendorProfile(vendorId, { enabled: isEditMode });

  const {
    handleSubmit: submitToBackend,
    isSubmitting,
    uploadProgress,
  } = useVendorSubmission(vendorId, userId, handleSuccess);

  useEffect(() => {
    if (isEditMode && isFetchSuccess && rawVendorData) {
      setFormData(transformBackendToFrontend(rawVendorData));
    }
  }, [isEditMode, isFetchSuccess, rawVendorData]);

  // BUTTON VALIDATION: Check if required fields are filled and errors are empty
  const isFormValid = useMemo(() => {
    const required = ["name", "category", "state", "minPrice", "phoneNumber"];
    const hasValues = required.every((f) => !!formData[f]?.toString().trim());
    const hasImage = !!imageFile || !!formData.imageURL;
    const noErrors = !Object.values(formErrors).some((err) => !!err);
    return hasValues && hasImage && noErrors;
  }, [formData, imageFile, formErrors]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({
      ...prev,
      [name]: validateVendorField(name, value),
    }));
  }, []);

  const handleImageChange = useCallback((e) => {
    const file = e.target.files[0];
    setImageFile(file || null);
    if (file) setFormData((prev) => ({ ...prev, imageURL: "" }));
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!userId) {
      toastAlert.warning("Session loading. Please wait.");
      return;
    }
    const errors = vendorRegistrationValidate(
      { ...formData, imageURL: imageFile || formData.imageURL },
      isEditMode
    );
    setFormErrors(errors);
    if (!hasValidationErrors(errors)) {
      try {
        await submitToBackend(formData, imageFile);
      } catch (err) {
        console.error("Submission error:", err);
      }
    } else {
      toastAlert.error("Please correct the errors before submitting.");
    }
  };

  return {
    formData,
    formErrors,
    isSubmitting,
    isLoadingVendor,
    imageFile,
    isEditMode,
    uploadProgress,
    isFormValid, // Exported to gray out the button
    handleChange,
    handleImageChange,
    handleSubmit,
  };
};
