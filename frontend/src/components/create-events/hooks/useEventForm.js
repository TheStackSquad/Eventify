// frontend/src/components/create-events/hooks/useEventForm.js
import { useState } from "react";
import { validateStep } from "../utils/validation";

export const useEventForm = (formData, onFormChange, onSubmit) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    const updatedFormData = {
      ...formData,
      [field]: value,
    };
    onFormChange(updatedFormData);

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleTicketChange = (index, field, value) => {
    const updatedTickets = [...formData.tickets];
    updatedTickets[index] = {
      ...updatedTickets[index],
      [field]: value,
    };
    onFormChange({
      ...formData,
      tickets: updatedTickets,
    });
  };

const addTicketTier = () => {
  onFormChange({
    ...formData,
    tickets: [
      ...formData.tickets,
      {
        // Temporary ID prefixed to distinguish from DB UUIDs
        id: `temp-${Date.now()}`,
        tierName: "",
        price: 0,
        quantity: 1,
        soldCount: 0, // New tickets always have 0 sold
        description: "",
      },
    ],
  });
};

const removeTicketTier = (index) => {
  const ticket = formData.tickets[index];
  // HARDENING: Prevent UI from removing a tier that has already sold tickets
  if (ticket.soldCount > 0) {
    alert("Cannot remove a ticket tier that has already sold tickets.");
    return;
  }
  onFormChange({
    ...formData,
    tickets: formData.tickets.filter((_, i) => i !== index),
  });
};

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFormChange({
        ...formData,
        eventImage: file,
        eventImagePreview: URL.createObjectURL(file),
      });
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep, formData, setErrors)) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("🎯 useEventForm handleSubmit called with formData:", formData);
    if (validateStep(4, formData, setErrors)) {
      console.log("✅ Validation passed, calling onSubmit");
      onSubmit(formData);
    } else {
      console.log("❌ Validation failed");
    }
  };

  return {
    currentStep,
    errors,
    handleInputChange,
    handleTicketChange,
    addTicketTier,
    removeTicketTier,
    handleImageUpload,
    handleNext,
    handlePrevious,
    handleSubmit,
  };
};
