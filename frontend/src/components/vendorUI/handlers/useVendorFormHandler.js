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
  // DEBUG: Log when hook is called and what props are received
  console.log("🔧 [useVendorFormHandler] Hook initialized with:", {
    vendorId,
    userId,
    hasUserId: !!userId,
    userIdType: typeof userId,
    userIdValue: userId,
  });

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

  // DEBUG: Log when userId changes
  useEffect(() => {
    console.log("📊 [useVendorFormHandler] userId updated:", {
      userId,
      hasUserId: !!userId,
      timestamp: new Date().toISOString(),
    });
  }, [userId]);

  const resetForm = useCallback(() => {
    console.log("🔄 [useVendorFormHandler] Resetting form");
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
    console.log("✅ [useVendorFormHandler] Success callback triggered");
    if (!isEditMode) resetForm();
    if (onSuccess) onSuccess();
  }, [isEditMode, onSuccess, resetForm]);

  // --- Identity Verification Handler ---
  const handleVninVerified = useCallback((data) => {
    console.log("🆔 [useVendorFormHandler] Identity verified:", data);
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
  const handleCacVerified = useCallback(
    (officialName, cacNum) => {
      console.log("🏢 [useVendorFormHandler] Business verified:", {
        officialName,
        cacNum,
        currentUserId: userId,
      });
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
    },
    [userId],
  );

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
      console.log("📥 [useVendorFormHandler] Vendor data loaded:", {
        rawVendorData,
        currentUserId: userId,
      });
      setFormData(transformBackendToFrontend(rawVendorData));
    }
  }, [isEditMode, isFetchSuccess, rawVendorData, userId]);

  // Validation logic
  const isFormValid = useMemo(() => {
    const isValid = (() => {
      const required = ["category", "state", "minPrice", "phoneNumber"];
      const hasValues = required.every((f) => !!formData[f]?.toString().trim());
      const hasImage = !!imageFile || !!formData.imageURL;
      const noErrors = !Object.values(formErrors).some((err) => !!err);
      const hasNames =
        !!formData.name && !!formData.firstName && !!formData.lastName;

      return hasValues && hasImage && noErrors && hasNames;
    })();

    console.log("📋 [useVendorFormHandler] Form validation check:", {
      isFormValid: isValid,
      userId,
      formData: {
        name: formData.name,
        firstName: formData.firstName,
        lastName: formData.lastName,
      },
    });

    return isValid;
  }, [formData, imageFile, formErrors, userId]);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      console.log("✏️ [useVendorFormHandler] Field changed:", {
        name,
        value,
        isBusinessVerified: formData.isBusinessVerified,
        isIdentityVerified: formData.isIdentityVerified,
      });

      // GUARD: Lock Business Name if CAC is verified
      if (name === "name" && formData.isBusinessVerified) {
        console.log(
          "🔒 [useVendorFormHandler] Business name locked - already verified",
        );
        return;
      }

      // GUARD: Lock Personal Names if vNIN is verified
      const identityFields = ["firstName", "middleName", "lastName"];
      if (identityFields.includes(name) && formData.isIdentityVerified) {
        console.log(
          "🔒 [useVendorFormHandler] Identity field locked - already verified",
        );
        return;
      }

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

  const handleImageChange = useCallback(
    (e) => {
      const file = e.target.files[0];
      console.log("🖼️ [useVendorFormHandler] Image selected:", {
        fileName: file?.name,
        fileSize: file?.size,
        currentUserId: userId,
      });
      setImageFile(file || null);
      if (file) setFormData((prev) => ({ ...prev, imageURL: "" }));
    },
    [userId],
  );

  const handleSubmit = async (e) => {
    console.log(
      "🚀 [useVendorFormHandler] Submit triggered at:",
      new Date().toISOString(),
    );
    console.log("📊 [useVendorFormHandler] Submit data snapshot:", {
      userId,
      hasUserId: !!userId,
      formData: {
        name: formData.name,
        category: formData.category,
        phoneNumber: formData.phoneNumber,
      },
      imageFile: !!imageFile,
      isEditMode,
    });

    if (e) e.preventDefault();

    if (!userId) {
      console.error(
        "❌ [useVendorFormHandler] NO USER ID AVAILABLE for submission!",
      );
      console.warn("User should be logged in but userId is:", userId);
      toastAlert.warn("Session loading. Please wait.");
      return;
    }

    console.log("✅ [useVendorFormHandler] User ID validated:", userId);

    // 1. Run standard validation
    const errors = vendorRegistrationValidate(
      { ...formData, imageURL: imageFile || formData.imageURL },
      isEditMode,
    );

    console.log("🔍 [useVendorFormHandler] Validation errors:", errors);

    // 2. INDUSTRY STANDARD TAMPER CHECK
    // Ensure the current input matches the verified snapshot
    if (formData.isIdentityVerified) {
      const currentVnin = formData.vnin.replace(/[^A-Z0-9]/gi, "");
      if (currentVnin !== formData.verifiedVnin) {
        errors.vnin = "vNIN mismatch. Please re-verify your identity.";
        console.warn("⚠️ [useVendorFormHandler] vNIN mismatch detected");
      }
    } else {
      // Force identity verification if your business rule requires it
      errors.vnin = "Identity verification is mandatory.";
    }

    if (formData.isBusinessVerified) {
      const currentCac = formData.cacNumber.replace(/[^A-Z0-9]/gi, "");
      if (currentCac !== formData.verifiedCacNumber) {
        errors.cacNumber = "CAC mismatch. Please re-verify business.";
        console.warn("⚠️ [useVendorFormHandler] CAC mismatch detected");
      }
    }

    setFormErrors(errors);

    if (!hasValidationErrors(errors)) {
      console.log(
        "✅ [useVendorFormHandler] No validation errors, proceeding to submit",
      );
      try {
        // Success: Proceed with the payload
        await submitToBackend(formData, imageFile);
        console.log("🎉 [useVendorFormHandler] Submission successful");
      } catch (err) {
        console.error("❌ [useVendorFormHandler] Submission error:", err);
        toastAlert.error(err.message || "Submission failed");
      }
    } else {
      console.log(
        "❌ [useVendorFormHandler] Validation errors found, blocking submission",
      );
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
