// frontend/src/app/events/create-events/page.js
"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/utils/hooks/useAuth";
import useEventForm from "@/app/events/create-events/hooks/useEventForm";
import useEventSubmission from "@/app/events/create-events/hooks/useEventSubmission";
import CreateEventForm from "@/components/create-events/create";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import AuthGuard from "@/components/auth/authGuard";
import { ERROR_MESSAGES } from "@/utils/constants/errorMessages";
import { ROUTES } from "@/utils/constants/globalConstants";
import CheckoutSectionBoundary from "@/components/errorBoundary/checkoutSectionBoundary";
import { Upload, Save, CheckCircle, AlertCircle } from "lucide-react";

// Progress overlay component with creative animations
function SubmissionProgressOverlay({
  isSubmitting,
  uploadProgress,
  currentStep,
}) {
  const steps = {
    "Uploading image...": { icon: Upload, color: "text-blue-500" },
    "Creating event...": { icon: Save, color: "text-green-500" },
    "Updating event...": { icon: Save, color: "text-yellow-500" },
    "Success!": { icon: CheckCircle, color: "text-emerald-500" },
  };

  const stepConfig = steps[currentStep] || {
    icon: AlertCircle,
    color: "text-gray-500",
  };
  const StepIcon = stepConfig.icon;

  return (
    <AnimatePresence>
      {isSubmitting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
          >
            <div className="text-center">
              {/* Animated icon container */}
              <motion.div
                animate={{
                  rotate: currentStep === "Uploading image..." ? 360 : 0,
                }}
                transition={{
                  duration: 2,
                  repeat: currentStep === "Uploading image..." ? Infinity : 0,
                  ease: "linear",
                }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center mx-auto mb-6"
              >
                <StepIcon className={`w-10 h-10 ${stepConfig.color}`} />
              </motion.div>

              {/* Progress text */}
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <h3 className="text-xl font-semibold text-white mb-2">
                  {currentStep}
                </h3>
                <p className="text-gray-400 text-sm">
                  {uploadProgress < 100
                    ? "Please wait while we process your event..."
                    : "Almost done!"}
                </p>
              </motion.div>

              {/* Progress bar with glow effect */}
              <div className="relative mb-2">
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    className={`h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 ${
                      uploadProgress === 100 ? "animate-pulse" : ""
                    }`}
                  />
                </div>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <motion.div
                    animate={{ x: ["0%", "100%"] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="absolute top-0 h-3 w-4 bg-white/30 blur-sm"
                  />
                )}
              </div>

              {/* Percentage and status */}
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-gray-400">
                  {uploadProgress}% complete
                </span>
                <motion.span
                  animate={uploadProgress === 100 ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className={`text-sm font-medium ${
                    uploadProgress === 100
                      ? "text-emerald-400"
                      : "text-blue-400"
                  }`}
                >
                  {uploadProgress === 100 ? "Ready!" : "Processing..."}
                </motion.span>
              </div>

              {/* Loading dots animation */}
              {uploadProgress < 100 && (
                <div className="flex justify-center mt-6 space-x-2">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ y: [0, -8, 0] }}
                      transition={{
                        duration: 0.6,
                        delay: i * 0.1,
                        repeat: Infinity,
                      }}
                      className="w-2 h-2 bg-blue-400 rounded-full"
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Main content component
function CreateEventContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams ? searchParams.get("id") : null;

  // Authentication hook
  const { user, authLoading } = useAuth();

  // Event form hook
  const {
    formData,
    setFormData,
    stableInitialData,
    isLoading: isFormLoading,
    error: formError,
    isError: isFormError,
    errors,
    setErrors,
    handleFormChange,
  } = useEventForm(eventId, user?.id);

  // Event submission hook
  const {
    isSubmitting,
    handleSubmit: handleFormSubmit,
    uploadProgress,
    currentStep,
  } = useEventSubmission(
    eventId,
    user?.id,
    setFormData,
    setErrors,
    router,
    stableInitialData,
  );

  // Development logging
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && formData && user) {
      console.group("Form State Sync");
      console.log("Current User:", { id: user.id, name: user.name });
      console.log("Current Step Data:", formData);
      console.log("Validation Errors:", errors);
      console.log("Edit Mode:", !!eventId);
      if (formData.tickets) {
        console.log("Tickets Array Length:", formData.tickets.length);
      }
      console.groupEnd();
    }
  }, [formData, errors, eventId, user]);

  // Loading/Auth state
  if (authLoading || !user) {
    return <LoadingSpinner message="Authenticating..." color="white" />;
  }

  // Form loading state
  if (isFormLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <LoadingSpinner
          message={eventId ? "Loading event data..." : "Preparing form..."}
          size="lg"
          color="white"
        />
      </div>
    );
  }

  // Error state
  if (isFormError && formError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-900/10 border border-red-500 rounded-2xl p-8">
          <div className="text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-red-300 mb-3">
              Failed to Load Event
            </h2>
            <p className="text-red-200 mb-8">
              {formError.message || ERROR_MESSAGES.FETCH_EVENT_FAILED}
            </p>
            <button
              onClick={() => router.push(ROUTES.MY_EVENTS)}
              className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-300 font-semibold shadow-lg hover:shadow-red-500/20"
            >
              Back to My Events
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Event handlers
  const handleImageUpload = (file, previewUrl) => {
    console.log("Image uploaded:", {
      fileName: file.name,
      fileSize: `${(file.size / 1024).toFixed(2)} KB`,
      previewUrl,
      userId: user.id,
    });

    handleFormChange({
      ...formData,
      eventImageFile: file,
      eventImagePreview: previewUrl,
    });
  };

  const handleFormSubmitClick = () => {
    console.log("Submit triggered by:", user.name);
    handleFormSubmit(formData);
  };

  const handleBack = () => router.back();
  const handleCancel = () => router.push(ROUTES.MY_EVENTS);
  const isEditMode = !!eventId;

  // Main render with creative integration
  return (
    <>
      {/* Progress Overlay */}
      <SubmissionProgressOverlay
        isSubmitting={isSubmitting}
        uploadProgress={uploadProgress}
        currentStep={currentStep}
      />

      {/* Main Content */}
      <CheckoutSectionBoundary section="Event Creation Form" minHeight="600px">
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black py-8 px-4 sm:px-6 lg:px-8">
          {/* Header with mode indicator */}
          <div className="max-w-6xl mx-auto mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {isEditMode ? "Edit Event" : "Create New Event"}
                </h1>
                <p className="text-gray-400 mt-2">
                  {isEditMode
                    ? "Update your event details below"
                    : "Fill in the details to create your event"}
                </p>
              </div>
              <div className="px-4 py-2 bg-gray-800 rounded-full">
                <span className="text-sm font-medium text-gray-300">
                  {isEditMode ? "Edit Mode" : "Create Mode"}
                </span>
              </div>
            </div>
          </div>

          {/* Main Form */}
          <CreateEventForm
            formData={formData}
            errors={errors}
            onFormChange={handleFormChange}
            onImageUpload={handleImageUpload}
            onSubmit={handleFormSubmitClick}
            onBack={handleBack}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            mode={isEditMode ? "edit" : "create"}
            isEditMode={isEditMode}
          />

          {/* Status indicator at bottom */}
          {isSubmitting && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed bottom-6 right-6 bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-xl"
            >
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm text-gray-300">Processing...</span>
              </div>
            </motion.div>
          )}
        </div>
      </CheckoutSectionBoundary>
    </>
  );
}

// Auth wrapper component
function CreateEventPageWrapper() {
  return (
    <AuthGuard>
      <CreateEventContent />
    </AuthGuard>
  );
}

// Main page component with suspense
export default function CreateEventsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
          <LoadingSpinner
            message="Preparing form layout..."
            color="white"
            className="!bg-transparent"
            fullScreen={false}
          />
        </div>
      }
    >
      <CreateEventPageWrapper />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
