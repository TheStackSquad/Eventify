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
    name: "", // Business Name
    category: "",
    state: "",
    city: "",
    minPrice: "",
    phoneNumber: "",
    imageURL: "",
    cacNumber: "",
    isBusinessVerified: false,
    verifiedCacNumber: "", // Tamper-proof snapshot
    firstName: "",
    middleName: "",
    lastName: "",
    vnin: "",
    isIdentityVerified: false,
    verifiedVnin: "", // Tamper-proof snapshot
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

  // --- Identity Verification Handler ---
  const handleVninVerified = useCallback((data) => {
    setFormData((prev) => ({
      ...prev,
      firstName: data.firstName,
      middleName: data.middleName || "",
      lastName: data.lastName,
      isIdentityVerified: true,
      // We lock the vNIN to its current cleaned value in the snapshot
      verifiedVnin: prev.vnin.replace(/[^A-Z0-9]/gi, ""),
    }));

    setFormErrors((prev) => {
      const newErrors = { ...prev };
      ["vnin", "firstName", "lastName"].forEach((key) => delete newErrors[key]);
      return newErrors;
    });

    toastAlert.success("Identity Linked via NIMC");
  }, []);

  // --- Business Verification Handler ---
  const handleCacVerified = useCallback((officialName, cacNum) => {
    setFormData((prev) => ({
      ...prev,
      name: officialName,
      isBusinessVerified: true,
      // Snapshot the exact CAC number verified
      verifiedCacNumber: cacNum.replace(/[^A-Z0-9]/gi, ""),
    }));

    setFormErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.cacNumber;
      delete newErrors.name;
      return newErrors;
    });

    toastAlert.success(`Business Verified: ${officialName}`);
  }, []);

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

  // Validation logic
  const isFormValid = useMemo(() => {
    const required = ["category", "state", "minPrice", "phoneNumber"];
    const hasValues = required.every((f) => !!formData[f]?.toString().trim());
    const hasImage = !!imageFile || !!formData.imageURL;
    const noErrors = !Object.values(formErrors).some((err) => !!err);
    // Business name and identity must be filled (verified or manual)
    const hasNames =
      !!formData.name && !!formData.firstName && !!formData.lastName;

    return hasValues && hasImage && noErrors && hasNames;
  }, [formData, imageFile, formErrors]);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;

      // GUARD: Lock Business Name if CAC is verified
      if (name === "name" && formData.isBusinessVerified) return;

      // GUARD: Lock Personal Names if vNIN is verified
      const identityFields = ["firstName", "middleName", "lastName"];
      if (identityFields.includes(name) && formData.isIdentityVerified) return;

      // NOTE: Phone number is intentionally NOT guarded here
      // Users can use any contact number they prefer

      setFormData((prev) => ({ ...prev, [name]: value }));
      setFormErrors((prev) => ({
        ...prev,
        [name]: validateVendorField(name, value),
      }));
    },
    [formData.isBusinessVerified, formData.isIdentityVerified],
  );

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

    // 1. Run standard validation
    const errors = vendorRegistrationValidate(
      { ...formData, imageURL: imageFile || formData.imageURL },
      isEditMode,
    );

    // 2. INDUSTRY STANDARD TAMPER CHECK
    // Ensure the current input matches the verified snapshot
    if (formData.isIdentityVerified) {
      const currentVnin = formData.vnin.replace(/[^A-Z0-9]/gi, "");
      if (currentVnin !== formData.verifiedVnin) {
        errors.vnin = "vNIN mismatch. Please re-verify your identity.";
      }
    } else {
      // Force identity verification if your business rule requires it
      errors.vnin = "Identity verification is mandatory.";
    }

    if (formData.isBusinessVerified) {
      const currentCac = formData.cacNumber.replace(/[^A-Z0-9]/gi, "");
      if (currentCac !== formData.verifiedCacNumber) {
        errors.cacNumber = "CAC mismatch. Please re-verify business.";
      }
    }

    setFormErrors(errors);

    if (!hasValidationErrors(errors)) {
      try {
        // Success: Proceed with the payload
        await submitToBackend(formData, imageFile);
      } catch (err) {
        console.error("Submission error:", err);
      }
    } else {
      toastAlert.error(
        "Please correct the validation errors before submitting.",
      );
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
