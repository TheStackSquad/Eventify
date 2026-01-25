// frontend/src/components/create-events/create.js

"use client";
import { useState } from "react";
import { Loader2, Upload, CheckCircle } from "lucide-react";
import StepIndicator from "./components/stepIndicator";
import BasicInfoStep from "./formSteps/basicFormStep";
import DateTimeLocationStep from "./formSteps/dateTimeLocationStep";
import TicketingStep from "./formSteps/ticketingStep";
import PaymentStep from "./formSteps/paymentStep";
import NavigationButtons from "./components/navigationButtons";
import toastAlert from "@/components/common/toast/toastAlert";

export default function CreateEventForm({
  formData,
  errors = {},
  onFormChange,
  onImageUpload,
  onSubmit,
  isSubmitting,
  isEditMode,
  uploadProgress = 0,
  currentStep: submissionStep = "",
}) {
  const [currentFormStep, setCurrentFormStep] = useState(1);

  if (!formData) {
    return <div className="p-10 text-white text-center">Loading Form...</div>;
  }

  const handleInputChange = (field, value) => {
    onFormChange({ ...formData, [field]: value });
  };

  const handleImageUpload = (file, previewUrl) => {
    if (typeof onImageUpload === "function") {
      onImageUpload(file, previewUrl);
    } else {
      console.warn(
        "CreateEventForm: onImageUpload not provided, using fallback",
      );
      handleInputChange("eventImageFile", file);
      handleInputChange("eventImagePreview", previewUrl);
    }
  };

  const handleTicketChange = (index, field, value) => {
    const updatedTickets = [...(formData.tickets || [])];
    updatedTickets[index] = { ...updatedTickets[index], [field]: value };
    onFormChange({ ...formData, tickets: updatedTickets });
  };

  // Step validation before progression
  const validateStep = (step) => {
    const validationErrors = [];

    switch (step) {
      case 1:
        if (!formData.eventTitle?.trim())
          validationErrors.push("Event title is required");
        if (!formData.eventDescription?.trim())
          validationErrors.push("Event description is required");
        if (!formData.category)
          validationErrors.push("Please select a category");
        if (!formData.eventType)
          validationErrors.push("Please select event type");
        if (
          !formData.eventImageFile &&
          !formData.eventImage &&
          !formData.eventImagePreview
        ) {
          validationErrors.push("Please upload an event image");
        }
        break;

      case 2:
        if (!formData.startDate)
          validationErrors.push("Start date is required");
        if (!formData.startTime)
          validationErrors.push("Start time is required");
        if (formData.eventType === "physical") {
          if (!formData.venueName?.trim())
            validationErrors.push("Venue name is required");
          if (!formData.city?.trim()) validationErrors.push("City is required");
        }
        if (formData.eventType === "virtual") {
          if (!formData.meetingLink?.trim())
            validationErrors.push("Meeting link is required");
        }
        break;

      case 3:
        if (!formData.tickets || formData.tickets.length === 0) {
          validationErrors.push("At least one ticket tier is required");
        } else {
          formData.tickets.forEach((ticket, i) => {
            if (!ticket.tierName?.trim())
              validationErrors.push(`Ticket ${i + 1}: Name required`);
            if (ticket.quantity <= 0)
              validationErrors.push(`Ticket ${i + 1}: Quantity required`);
          });
        }
        break;
    }

    return validationErrors;
  };

  const handleNext = () => {
    const validationErrors = validateStep(currentFormStep);

    if (validationErrors.length > 0) {
      // 🎯 FIXED: Use toast instead of alert
      toastAlert.error(validationErrors[0]);
      return;
    }

    setCurrentFormStep((s) => Math.min(4, s + 1));
  };

  const renderStep = () => {
    const commonProps = {
      formData,
      errors,
      handleInputChange,
      isEditMode,
    };

    switch (currentFormStep) {
      case 1:
        return (
          <BasicInfoStep
            {...commonProps}
            handleImageUpload={handleImageUpload}
          />
        );
      case 2:
        return <DateTimeLocationStep {...commonProps} />;
      case 3:
        return (
          <TicketingStep
            formData={formData}
            errors={errors}
            handleTicketChange={handleTicketChange}
            addTicketTier={() =>
              onFormChange({
                ...formData,
                tickets: [
                  ...(formData.tickets || []),
                  {
                    id: `temp-${Date.now()}`,
                    tierName: "",
                    price: 0,
                    quantity: 0,
                    soldCount: 0,
                  },
                ],
              })
            }
            removeTicketTier={(i) =>
              onFormChange({
                ...formData,
                tickets: formData.tickets.filter((_, idx) => idx !== i),
              })
            }
          />
        );
      case 4:
        return <PaymentStep {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
      {/* 🎯 NEW: Upload Progress Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            {/* Progress Header */}
            <div className="text-center mb-6">
              {uploadProgress === 100 ? (
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              ) : uploadProgress > 0 && uploadProgress < 60 ? (
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <Upload className="w-8 h-8 text-blue-600 animate-pulse" />
                </div>
              ) : (
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                  <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                </div>
              )}

              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {submissionStep || "Processing..."}
              </h3>

              <p className="text-sm text-gray-600">
                {uploadProgress === 100
                  ? "Almost there! Finalizing your event..."
                  : uploadProgress > 0
                    ? "Uploading your event image..."
                    : isEditMode
                      ? "Updating your event..."
                      : "Creating your event..."}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
                style={{ width: `${uploadProgress}%` }}
              >
                {/* Animated shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>

            {/* Progress Percentage */}
            <div className="text-center">
              <span className="text-2xl font-bold text-gray-900">
                {uploadProgress}%
              </span>
            </div>

            {/* Warning Message */}
            <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800 text-center">
                Please don&apos;t close this window. This may take up to 30
                seconds.
              </p>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (currentFormStep === 4) onSubmit();
        }}
        className="p-8"
      >
        <StepIndicator currentStep={currentFormStep} />

        <div className="mt-8 transition-opacity duration-300">
          {renderStep()}
        </div>

        <NavigationButtons
          currentStep={currentFormStep}
          onPrevious={() => setCurrentFormStep((s) => Math.max(1, s - 1))}
          onNext={handleNext}
          isSubmitting={isSubmitting}
        />
      </form>

      {/* 🎯 NEW: Shimmer animation styles */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
