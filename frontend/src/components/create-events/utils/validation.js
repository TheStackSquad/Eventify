// frontend/src/components/create-events/utils/validation.js
export const validateStep = (step, formData, setErrors) => {
  const newErrors = {};

  if (step === 1) {
    if (!formData.eventTitle?.trim())
      newErrors.eventTitle = "Event title is required";
    if (!formData.eventDescription?.trim())
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
    formData.tickets.forEach((ticket, index) => {
      // 1. Tier Name Validation
      if (!ticket.tierName?.trim())
        newErrors[`ticket_${index}_tierName`] = "Tier name is required";

      // 2. Price Validation (Condition-based)
      // Only require price if isFree is false
      if (!ticket.isFree) {
        if (
          ticket.price === "" ||
          ticket.price === undefined ||
          ticket.price === null
        ) {
          newErrors[`ticket_${index}_price`] =
            "Price is required for paid tickets";
        } else if (parseFloat(ticket.price) <= 0) {
          newErrors[`ticket_${index}_price`] =
            "Paid tickets must have a price greater than 0";
        }
      }

      // 3. Quantity Validation
      if (!ticket.quantity || parseInt(ticket.quantity) <= 0) {
        newErrors[`ticket_${index}_quantity`] = "Quantity must be at least 1";
      }
    });
  }

  if (step === 4) {
    // Only require Paystack code if there's at least one paid ticket
    const hasPaidTickets = formData.tickets.some((t) => !t.isFree);
    if (hasPaidTickets && !formData.paystackSubaccountCode) {
      newErrors.paystackSubaccountCode =
        "Paystack subaccount is required for paid events";
    }
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
