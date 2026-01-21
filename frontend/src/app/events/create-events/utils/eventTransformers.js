// frontend/src/app/events/create-events/utils/eventTransformers.js


//Aligns Backend Model to Frontend Form State
export const transformEventToFormData = (event) => {
  const safeDate = (d) => d ? new Date(d).toISOString().split("T")[0] : "";
  const safeTime = (d) => d ? new Date(d).toTimeString().slice(0, 5) : "";

  return {
    ...event,
    startDate: safeDate(event.startDate),
    startTime: safeTime(event.startDate),
    endDate: safeDate(event.endDate),
    endTime: safeTime(event.endDate),
    tickets: (event.tickets || []).map(t => ({
      id: t.id || t.ID, // Stable UUID from Backend
      tierName: t.name || t.tierName || "",
      price: Number(t.priceKobo || t.price) || 0,
      quantity: Number(t.capacity || t.quantity) || 0,
      soldCount: Number(t.sold || t.soldCount) || 0,
      isFree: t.isFree || (t.priceKobo === 0),
      description: t.description || ""
    })),
  };
};

//Prepares Payload for API (Enforces UUID integrity)
export const prepareEventPayload = (formData, imageUrl) => {
  const payload = { ...formData };
  if (imageUrl) payload.eventImage = imageUrl;

  // Combine Dates
  if (payload.startDate && payload.startTime) {
    payload.startDate = new Date(`${payload.startDate}T${payload.startTime}:00`).toISOString();
    payload.endDate = new Date(`${payload.endDate}T${payload.endTime}:00`).toISOString();
  }

  // ALIGNMENT: Sanitize Tickets
  payload.tickets = (payload.tickets || []).map(t => ({
    // If ID is a temp string (e.g., from 'add ticket' button), send undefined
    // Backend will then generate a real UUID
    id: (t.id && !t.id.toString().startsWith('temp-')) ? t.id : undefined,
    tierName: t.tierName,
    price: parseFloat(t.price) || 0, // Backend handler will do * 100
    quantity: parseInt(t.quantity, 10) || 0,
    description: t.description || ""
  }));

  // Clean UI-only fields
  ['eventImagePreview', 'startTime', 'endTime', 'timezone'].forEach(k => delete payload[k]);
  
  return payload;
};