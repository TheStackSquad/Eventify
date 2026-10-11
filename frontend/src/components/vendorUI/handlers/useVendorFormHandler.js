// frontend/src/components/vendorUI/handlers/useVendorFormHandler.js

"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useVendorProfile } from "@/utils/hooks/useVendorData";
import { transformBackendToFrontend } from "@/app/vendor/utils/vendorTransformers";
import useVendorSubmission from "@/app/vendor/hooks/useVendorSubmission";
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
    description: "",
    cacNumber: "",
    isBusinessVerified: false,
    verifiedCacNumber: "",
    firstName: "",
    middleName: "",
    lastName: "",
    vnin: "",
    isIdentityVerified: false,
    verifiedVnin: "",
  });

  // Fetch vendor data in edit mode
  const {
    data: rawVendorData,
    isLoading: isLoadingVendor,
    isSuccess: isFetchSuccess,
    error: fetchError,
  } = useVendorProfile(vendorId, { enabled: isEditMode });

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      category: "",
      state: "",
      city: "",
      minPrice: "",
      phoneNumber: "",
      imageURL: "",
      description: "",
      cacNumber: "",
      isBusinessVerified: false,
      verifiedCacNumber: "",
      firstName: "",
      middleName: "",
      lastName: "",
      vnin: "",
      isIdentityVerified: false,
      verifiedVnin: "",
    });
    setImageFile(null);
    setFormErrors({});
  }, []);

  const handleSuccess = useCallback(() => {
    if (!isEditMode) resetForm();
    if (onSuccess) onSuccess();
  }, [isEditMode, onSuccess, resetForm]);

  // Identity verification handler
  const handleVninVerified = useCallback((data) => {
    setFormData((prev) => ({
      ...prev,
      firstName: data.firstName,
      middleName: data.middleName || "",
      lastName: data.lastName,
      phoneNumber: data.phoneNumber || prev.phoneNumber,
      isIdentityVerified: true,
      verifiedVnin: prev.vnin.replace(/[^A-Z0-9]/gi, ""),
    }));
    setFormErrors((prev) => {
      const newErrors = { ...prev };
      ["vnin", "firstName", "lastName"].forEach((key) => delete newErrors[key]);
      return newErrors;
    });
  }, []);

  // Business verification handler
  const handleCacVerified = useCallback((officialName, cacNum) => {
    setFormData((prev) => ({
      ...prev,
      name: officialName,
      isBusinessVerified: true,
      verifiedCacNumber: cacNum.replace(/[^A-Z0-9]/gi, ""),
    }));
    setFormErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.cacNumber;
      delete newErrors.name;
      return newErrors;
    });
  }, []);

  const {
    handleSubmit: submitToBackend,
    isSubmitting,
    uploadProgress,
  } = useVendorSubmission(vendorId, userId, handleSuccess);

  // Prepopulate form in edit mode
  useEffect(() => {
    if (isEditMode && isFetchSuccess && rawVendorData) {
      try {
        const transformedData = transformBackendToFrontend(rawVendorData);
        setFormData(transformedData);
      } catch (error) {
        console.error("Error transforming vendor data:", error);
        toastAlert.error("Failed to load vendor data");
      }
    }
  }, [isEditMode, isFetchSuccess, rawVendorData]);

  // Form validation
  const isFormValid = useMemo(() => {
    const required = ["category", "state", "minPrice", "phoneNumber"];
    const hasValues = required.every((f) => !!formData[f]?.toString().trim());
    const hasImage = !!imageFile || !!formData.imageURL;
    const noErrors = !Object.values(formErrors).some((err) => !!err);

    // Edit mode: skip name validation if verified
    const hasNames =
      isEditMode && formData.isIdentityVerified
        ? true
        : !!formData.name && !!formData.firstName && !!formData.lastName;

    return hasValues && hasImage && noErrors && hasNames;
  }, [formData, imageFile, formErrors, isEditMode]);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;

      // Lock verified fields
      if (name === "name" && formData.isBusinessVerified) return;

      const identityFields = ["firstName", "middleName", "lastName"];
      if (identityFields.includes(name) && formData.isIdentityVerified) return;

      setFormData((prev) => ({ ...prev, [name]: value }));
      setFormErrors((prev) => ({
        ...prev,
        [name]: validateVendorField(name, value, isEditMode),
      }));
    },
    [formData.isBusinessVerified, formData.isIdentityVerified, isEditMode],
  );

  const handleImageChange = useCallback((e) => {
    const file = e.target.files[0];
    setImageFile(file || null);
    if (file) {
      setFormData((prev) => ({ ...prev, imageURL: "" }));
    }
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!userId) {
      toastAlert.warn("Session loading. Please wait.");
      return;
    }

    const errors = vendorRegistrationValidate(
      { ...formData, imageURL: imageFile || formData.imageURL },
      isEditMode,
    );

    // Verify vNIN hasn't been tampered with in create mode
    if (!isEditMode) {
      const currentCleanVnin = formData.vnin?.replace(/[^A-Z0-9]/gi, "") || "";
      const verifiedCleanVnin =
        formData.verifiedVnin?.replace(/[^A-Z0-9]/gi, "") || "";

      if (formData.isIdentityVerified) {
        if (currentCleanVnin !== verifiedCleanVnin) {
          errors.vnin = "vNIN mismatch. Please re-verify your identity.";
        }
      } else {
        errors.vnin = "Identity verification is mandatory.";
      }
    }

    setFormErrors(errors);

    if (!hasValidationErrors(errors)) {
      try {
        const sanitizedPayload = {
          ...formData,
          ownerId: userId,
          // Edit mode: use verified snapshots (unredacted values)
          vnin: isEditMode
            ? formData.verifiedVnin || formData.vnin
            : formData.vnin?.replace(/[^A-Z0-9]/gi, "") || "",
          verifiedVnin: isEditMode
            ? formData.verifiedVnin || formData.vnin
            : formData.verifiedVnin?.replace(/[^A-Z0-9]/gi, "") || "",
          cacNumber: isEditMode
            ? formData.verifiedCacNumber || formData.cacNumber
            : formData.cacNumber?.replace(/[^A-Z0-9]/gi, "") || "",
        };

        await submitToBackend(sanitizedPayload, imageFile);
      } catch (err) {
        toastAlert.error(err.message || "Submission failed");
      }
    } else {
      toastAlert.error("Please fix the errors on the form.");
    }
  };

  return {
    formData,
    handleCacVerified,
    handleVninVerified,
    formErrors,
    isSubmitting,
    isLoadingVendor,
    imageFile,
    isEditMode,
    uploadProgress,
    isFormValid,
    handleChange,
    handleImageChange,
    handleSubmit,
  };
};
