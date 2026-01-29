// frontend/src/app/events/create-events/components/eventFormContainer.js
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/utils/hooks/useAuth";
import useEventForm from "@/app/events/create-events/hooks/useEventForm";
import useEventSubmission from "@/app/events/create-events/hooks/useEventSubmission";
import CreateEventForm from "@/components/create-events/create";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import { ERROR_MESSAGES } from "@/utils/constants/errorMessages";
import { ROUTES } from "@/utils/constants/globalConstants";
import CheckoutSectionBoundary from "@/components/errorBoundary/checkoutSectionBoundary";
import SubmissionProgressOverlay from "./submissionProgressOverlay";

export default function EventFormContainer({ eventId = null }) {
  const router = useRouter();
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

  // 💰 Price Conversion Debug Logging
  useEffect(() => {
    if (
      process.env.NODE_ENV === "development" &&
      eventId &&
      formData?.tickets?.length > 0
    ) {
      console.group("💰 Price Conversion Check - Edit Mode");

      // Compare stable initial data (from DB) with current form data
      const dbTicket = stableInitialData?.tickets?.[0];
      const formTicket = formData?.tickets?.[0];

      if (dbTicket && formTicket) {
        console.log("📊 Data Comparison:");
        console.table({
          "Raw DB (should be kobo)": {
            price: dbTicket.price,
            source: "stableInitialData",
          },
          "Transformed Form (should be naira)": {
            price: formTicket.price,
            source: "formData",
          },
          "Conversion Check": {
            price: `${dbTicket.price} ÷ 100 = ${dbTicket.price / 100}`,
            source: "calculation",
          },
        });

        console.log(
          "💵 Expected Display Format:",
          new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
          }).format(formTicket.price || 0),
        );

        // Validation check
        const expectedNaira = dbTicket.price / 100;
        const isCorrect = formTicket.price === expectedNaira;

        if (isCorrect) {
          console.log("✅ Conversion is CORRECT");
        } else {
          console.error("❌ Conversion MISMATCH:", {
            expected: expectedNaira,
            actual: formTicket.price,
            difference: formTicket.price - expectedNaira,
          });
        }
      }

      console.groupEnd();
    }
  }, [eventId, formData?.tickets, stableInitialData?.tickets]);

  // 📊 General Form State Logging
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && formData && user) {
      console.group("📊 Form State Sync");
      console.log("👤 Current User:", { id: user.id, name: user.name });
      console.log("📝 Mode:", eventId ? "EDIT MODE" : "CREATE MODE");

      if (eventId) {
        console.log("🔄 Editing Event ID:", eventId);
        console.log("💾 Data from DB (stableInitialData):", stableInitialData);
        console.log("📋 Current Form Data:", formData);

        // Compare DB data vs form data
        if (stableInitialData && formData) {
          console.log("🔍 Data Comparison:", {
            dbTitle: stableInitialData.eventTitle,
            formTitle: formData.eventTitle,
            dbTickets: stableInitialData.tickets?.length || 0,
            formTickets: formData.tickets?.length || 0,
            hasChanges:
              JSON.stringify(stableInitialData) !== JSON.stringify(formData),
          });
        }

        // Ticket details
        if (formData?.tickets?.length > 0) {
          console.log("🎫 Tickets Configuration:");
          console.table(
            formData.tickets.map((t, i) => ({
              Index: i + 1,
              "Tier Name": t.tierName,
              "Price (₦)": t.price,
              Quantity: t.quantity,
              "Sold Count": t.soldCount || 0,
              Locked: (t.soldCount || 0) > 0 ? "🔒 Yes" : "🔓 No",
            })),
          );
        }
      } else {
        console.log("✨ Creating New Event");
        console.log("📋 Current Form Data:", formData);
      }

      console.log("❌ Validation Errors:", errors);
      console.groupEnd();
    }
  }, [formData, errors, eventId, user, stableInitialData]);

  // Loading/Auth state
  if (authLoading || !user) {
    return <LoadingSpinner message="Authenticating..." color="white" />;
  }

  // Form loading state
  if (isFormLoading) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md">
        <div className="p-8 rounded-2xl bg-gray-900/10 border border-white/5 flex flex-col items-center">
          <LoadingSpinner
            message={
              eventId
                ? "Loading event data from database..."
                : "Preparing form..."
            }
            size="lg"
            color="white"
          />
        </div>
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
    if (process.env.NODE_ENV === "development") {
      console.log("📸 Image uploaded:", {
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(2)} KB`,
        previewUrl: previewUrl.substring(0, 50) + "...",
        userId: user.id,
      });
    }

    handleFormChange({
      ...formData,
      eventImageFile: file,
      eventImagePreview: previewUrl,
    });
  };

  const handleFormSubmitClick = () => {
    if (process.env.NODE_ENV === "development") {
      console.group("🚀 Form Submission");
      console.log("👤 Submitted by:", user.name);
      console.log("📝 Mode:", eventId ? "UPDATE" : "CREATE");
      console.log("📤 Form Data:", formData);

      // Log ticket data for submission
      if (formData?.tickets?.length > 0) {
        console.log("🎫 Tickets being submitted:");
        console.table(
          formData.tickets.map((t) => ({
            Tier: t.tierName,
            "Price (Naira)": t.price,
            "Will Convert to (Kobo)": t.price * 100,
            Quantity: t.quantity,
          })),
        );
      }
      console.groupEnd();
    }
    handleFormSubmit(formData);
  };

  const handleBack = () => router.back();
  const handleCancel = () => router.push(ROUTES.MY_EVENTS);
  const isEditMode = !!eventId;

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
