// frontend/src/app/events/create-events/utils/eventTransformers.js


//Aligns Backend Model to Frontend Form State
export const transformEventToFormData = (event) => {
  if (!event) return null;

  const safeDate = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");
  const safeTime = (d) => (d ? new Date(d).toTimeString().slice(0, 5) : "");

  return {
    ...event,
    // 1. Map 'title' from API to 'eventTitle' for the Form
    eventTitle: event.title || event.eventTitle || "",

    // 2. Map 'image' from API to 'eventImagePreview'
    eventImagePreview: event.image || event.eventImagePreview || "",

    // 3. Handle Dates
    startDate: safeDate(event.startDate || event.date),
    startTime: safeTime(event.startDate || event.date),

    // 4. Ensure tickets exist
    tickets: (event.tickets || []).map((t) => ({
      id: t.id || t.ID,
      tierName: t.tierName || t.name || "",
      price: t.price ? t.price / 100 : 0,
      quantity: t.quantity || t.capacity || 0,
      soldCount: t.soldCount || t.sold || 0,
      description: t.description || "",
    })),
  };
};


export const prepareEventPayload = (formData, imageUrl) => {
  const payload = { ...formData };
  
  // 1. Map Image URL
  if (imageUrl) payload.eventImage = imageUrl;

  // 2. Format Dates (Backend needs time.Time)
  if (payload.startDate && payload.startTime) {
    payload.startDate = new Date(`${payload.startDate}T${payload.startTime}:00`).toISOString();
  }
  if (payload.endDate && payload.endTime) {
    payload.endDate = new Date(`${payload.endDate}T${payload.endTime}:00`).toISOString();
  }

  // 3. Convert Numeric Types (The int32 fix)
  if (payload.maxAttendees) {
    payload.maxAttendees = parseInt(payload.maxAttendees, 10) || 0;
  }

  // 4. THE FIX: Match the "TicketTiers" key and internal fields
  const sanitizedTickets = (payload.tickets || []).map((t) => ({
    // Use the keys required by the TicketTier struct binding
    tierName: t.tierName,
    price: parseFloat(t.price) || 0,
    quantity: parseInt(t.quantity, 10) || 0, // Capacity
    description: t.description || "",
  }));

  // Assign to the key the validator is asking for
  payload.TicketTiers = sanitizedTickets; 

  // 5. Cleanup
  // Remove the old 'tickets' key and UI helper fields
  const fieldsToRemove = [
    'tickets', 
    'eventImagePreview', 
    'startTime', 
    'endTime', 
    'timezone'
  ];
  fieldsToRemove.forEach(k => delete payload[k]);
  
  return payload;
};