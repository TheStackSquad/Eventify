// frontend/src/components/create-events/create.js

"use client";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
}) {
  const [currentFormStep, setCurrentFormStep] = useState(1);

  // 1. LOADING STATE
  // Since useEventForm now sets formData immediately upon data arrival,
  // this check ensures we show a spinner until the hook is ready.
  if (!formData || (isEditMode && !formData.id)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Syncing event data...</p>
        </div>
      </div>
    );
  }

  // 2. HELPERS
  const handleInputChange = (field, value) => {
    onFormChange({ ...formData, [field]: value });
  };

  const handleTicketChange = (index, field, value) => {
    const updatedTickets = [...(formData.tickets || [])];
    // Ensure numeric fields are cast correctly if they come from input strings
    const finalValue =
      field === "price" || field === "quantity" ? Number(value) : value;

    updatedTickets[index] = { ...updatedTickets[index], [field]: finalValue };
    onFormChange({ ...formData, tickets: updatedTickets });
  };

  // 3. STEP VALIDATION
  const validateStep = (step) => {
    const validationErrors = [];

    switch (step) {
      case 1:
        if (!formData.eventTitle?.trim())
          validationErrors.push("Event title is required");
        if (!formData.category)
          validationErrors.push("Please select a category");
        if (
          !formData.eventImage &&
          !formData.eventImagePreview &&
          !formData.eventImageFile
        ) {
          validationErrors.push("Please upload an event image");
        }
        break;

      case 2:
        if (!formData.startDate)
          validationErrors.push("Start date is required");
        if (formData.eventType === "physical" && !formData.venueName?.trim()) {
          validationErrors.push("Venue name is required");
        }
        if (formData.eventType === "virtual" && !formData.meetingLink?.trim()) {
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
            if (Number(ticket.quantity) <= 0)
              validationErrors.push(
                `Ticket ${i + 1}: Quantity must be greater than 0`,
              );
          });
        }
        break;
      default:
        break;
    }

    return validationErrors;
  };

  const handleNext = () => {
    const validationErrors = validateStep(currentFormStep);
    if (validationErrors.length > 0) {
      toastAlert.error(validationErrors[0]);
      return;
    }
    setCurrentFormStep((s) => Math.min(4, s + 1));
  };

  // 4. STEP RENDERER
  const renderStep = () => {
    const commonProps = {
      formData,
      errors,
      handleInputChange,
      isEditMode,
      isSubmitting,
    };

    switch (currentFormStep) {
      case 1:
        return (
          <BasicInfoStep {...commonProps} handleImageUpload={onImageUpload} />
        );
      case 2:
        return <DateTimeLocationStep {...commonProps} />;
      case 3:
        return (
          <TicketingStep
            {...commonProps}
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
    <div className="max-w-4xl mx-auto bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden shadow-2xl transition-all duration-300">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (currentFormStep === 4 && !isSubmitting) {
            onSubmit();
          }
        }}
        className={`p-8 ${isSubmitting ? "opacity-70 pointer-events-none" : ""}`}
        noValidate
      >
        <StepIndicator currentStep={currentFormStep} />

        <div className="mt-8 min-h-[400px]">{renderStep()}</div>

        <NavigationButtons
          currentStep={currentFormStep}
          onPrevious={() => setCurrentFormStep((s) => Math.max(1, s - 1))}
          onNext={handleNext}
          isSubmitting={isSubmitting}
        />
      </form>
    </div>
  );
}
