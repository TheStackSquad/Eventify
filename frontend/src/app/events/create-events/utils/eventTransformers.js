// frontend/src/app/events/create-events/utils/eventTransformers.js

/**
 * Transforms Backend Event data into the shape required by the React Form.
 * Maps Go Model JSON tags -> Frontend Form Field Names.
 */
export const transformEventToFormData = (event) => {
  if (!event) return null;

  // Split ISO date-time into parts for the form inputs
  const start = event.startDate ? new Date(event.startDate) : null;
  const end = event.endDate ? new Date(event.endDate) : null;

  return {
    // Identity
    id: event.id,
    organizerId: event.organizerId || event.userId,

    // Core Info (Check both Title and eventTitle for safety)
    eventTitle: event.eventTitle || event.title || "",
    eventDescription: event.eventDescription || event.description || "",
    category: event.category || "",
    eventType: event.eventType || "physical",

    // Dates & Times
    startDate: start ? start.toISOString().split("T")[0] : "",
    startTime: start ? start.toTimeString().slice(0, 5) : "",
    endDate: end ? end.toISOString().split("T")[0] : "",
    endTime: end ? end.toTimeString().slice(0, 5) : "",

    // Location
    venueName: event.venueName || "",
    venueAddress: event.venueAddress || "",
    city: event.city || "",
    state: event.state || "",
    country: event.country || "",
    virtualPlatform: event.virtualPlatform || "",
    meetingLink: event.meetingLink || "",

    // Tickets (Crucial: Map Go "capacity" or "quantity" to form "quantity")
    tickets: (event.tickets || []).map((t) => ({
      id: t.id,
      tierName: t.tierName || t.name || "",
      price: Number(t.price || 0),
      quantity: Number(t.quantity || t.capacity || 0),
      description: t.description || "",
      soldCount: t.soldCount || 0,
      isFree: Number(t.price) === 0,
    })),

    // Media
    eventImage: event.eventImage || "",
    eventImagePreview: event.eventImage || "", // Use same URL for preview

    // Other
    tags: Array.isArray(event.tags) ? event.tags : [],
    maxAttendees: Number(event.maxAttendees || 0),
  };
};
/**
 * Transforms Form/UI data into the JSON payload the Go Backend expects.
 */
export function prepareEventPayload(formData) {
  // Helper to combine date and time strings back into an ISO string for Go time.Time
  const combineDateTime = (date, time) => {
    if (!date) return null;
    try {
      return time
        ? new Date(`${date}T${time}`).toISOString()
        : new Date(date).toISOString();
    } catch (e) {
      return new Date(date).toISOString();
    }
  };

  return {
    organizerId: formData.organizerId,
    eventTitle: formData.eventTitle,
    eventDescription: formData.eventDescription,
    category: formData.category,
    eventType: formData.eventType,
    eventImage: formData.eventImage, // Maps to EventImageURL via json:"eventImage"
    venueName: formData.venueName || null,
    venueAddress: formData.venueAddress || null,
    city: formData.city || null,
    state: formData.state || null,
    country: formData.country || null,
    virtualPlatform: formData.virtualPlatform || null,
    meetingLink: formData.meetingLink || null,
    startDate: combineDateTime(formData.startDate, formData.startTime),
    endDate: combineDateTime(formData.endDate, formData.endTime),
    maxAttendees: formData.maxAttendees ? Number(formData.maxAttendees) : null,
    tags: formData.tags || [],

    // Ticket Mapping: Aligning with Go's TicketTier JSON tags
    tickets: (formData.tickets || []).map((ticket) => ({
      id: ticket.id || undefined,
      tierName: ticket.tierName, // json:"tierName"
      description: ticket.description || "",
      price: Number(ticket.price), // float64
      quantity: Number(ticket.quantity), // json:"quantity" (maps to Capacity in Go)
    })),
  };
}

/**
 * Normalizes the Backend response back into the Frontend structure.
 */
export function normalizeEventResponse(data) {
  if (!data) return null;

  return {
    ...data,
    tickets: (data.tickets || []).map((t) => ({
      ...t,
      tierName: t.tierName || "",
      price: Number(t.price || 0),
      quantity: Number(t.quantity || 0),
      soldCount: Number(t.soldCount || 0),
      available: Number(t.available || 0),
    })),
  };
}
// Helper: Format price for display
export const formatPriceDisplay = (kobo) => {
  const naira = kobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(naira);
};

// Helper: Check if any fields should be locked (tickets sold)
export const getFieldLockStatus = (tickets = []) => {
  const hasTicketsSold = tickets.some((t) => (t.soldCount || 0) > 0);

  return {
    priceFields: hasTicketsSold,
    quantityFields: hasTicketsSold,
    ticketStructure: hasTicketsSold,
    venueFields: hasTicketsSold,
    paystackSubaccount: hasTicketsSold,
    lockReason: hasTicketsSold
      ? "These fields cannot be modified because tickets have already been sold"
      : null,
  };
};
