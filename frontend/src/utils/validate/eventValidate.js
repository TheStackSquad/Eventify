//frontend/src/utils/validate/eventValidate.js

export const validateStep = (step, formData, setErrors) => {
  const newErrors = {};

  if (step === 1) {
    if (!formData.eventTitle.trim())
      newErrors.eventTitle = "Event title is required";
    if (!formData.eventDescription.trim())
      newErrors.eventDescription = "Description is required";
    if (!formData.category) newErrors.category = "Category is required";
  }

  if (step === 2) {
    if (!formData.startDate) newErrors.startDate = "Start date is required";
    if (!formData.startTime) newErrors.startTime = "Start time is required";

    if (formData.eventType === "physical") {
      if (!formData.venueName) newErrors.venueName = "Venue name is required";
      if (!formData.venueAddress)
        newErrors.venueAddress = "Venue address is required";
      if (!formData.city) newErrors.city = "City is required";
    } else {
      if (!formData.virtualPlatform)
        newErrors.virtualPlatform = "Platform is required";
      if (!formData.meetingLink)
        newErrors.meetingLink = "Meeting link is required";
    }
  }

if (step === 3) {
  if (!formData.tickets || formData.tickets.length === 0) {
    newErrors.tickets = "At least one ticket tier is required";
  } else {
    formData.tickets.forEach((ticket, index) => {
      // Check Tier Name
      if (!ticket.tierName.trim()) {
        newErrors[`ticket_${index}_tierName`] = "Tier name is required";
      }

      // Check Price - Refined to allow 0 (Free) but block undefined/null
      // We use isNaN to ensure it's a valid number (e.g., 5000 or 0)
      if (
        ticket.price === undefined ||
        ticket.price === null ||
        isNaN(ticket.price)
      ) {
        newErrors[`ticket_${index}_price`] = "Price is required";
      } else if (ticket.price < 0) {
        newErrors[`ticket_${index}_price`] = "Price cannot be negative";
      }

      // Check Quantity
      if (!ticket.quantity || ticket.quantity <= 0) {
        newErrors[`ticket_${index}_quantity`] = "Quantity must be at least 1";
      }
    });
  }
}

  if (step === 4) {
    if (!formData.paystackSubaccountCode) {
      newErrors.paystackSubaccountCode = "Paystack subaccount is required";
    }
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
