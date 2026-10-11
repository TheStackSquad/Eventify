// frontend/src/components/onboarding/feedback/hooks/useFeedbackForm.js
import { useState, useCallback, useMemo } from "react";
import useFeedbackSubmission from "@/app/feedback/hooks/useFeedbackSubmission";
import { validateFeedback } from "../utils/validation";

export default function useFeedbackForm(onClose) {
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    type: "suggestion",
    message: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [errors, setErrors] = useState({});

  // Submission hook
  const submission = useFeedbackSubmission(() => {
    // Reset on success
    setFormData({ name: "", email: "", type: "suggestion", message: "" });
    setImageFile(null);
    setErrors({});
    onClose();
  });

  // Derived state
  const previewUrl = useMemo(() => {
    return imageFile ? URL.createObjectURL(imageFile) : null;
  }, [imageFile]);

  // Form actions
  const handleInputChange = useCallback(
    (field, value) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: "" }));
      }
    },
    [errors]
  );

  const handleImageChange = useCallback((file) => {
    if (file) {
      setImageFile(file);
    }
  }, []);

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setErrors({});

      // Client-side validation
      const validation = validateFeedback(formData);
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      try {
        await submission.submitFeedback({ formData, imageFile });
      } catch (err) {
        // Update local error state for UI display
        setErrors((prev) => ({
          ...prev,
          submit: err.message.includes("Image") ? err.message : undefined,
        }));
      }
    },
    [formData, imageFile, submission]
  );

  return {
    formState: {
      data: formData,
      imageFile,
      previewUrl,
      errors,
    },
    actions: {
      handleInputChange,
      handleImageChange,
      handleRemoveImage,
      handleSubmit,
    },
    submission: {
      submitFeedback: submission.submitFeedback,
      isSubmitting: submission.isSubmitting,
      uploadProgress: submission.uploadProgress,
      error: submission.error,
    },
  };
}
