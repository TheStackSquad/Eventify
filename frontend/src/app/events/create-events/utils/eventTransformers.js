// frontend/src/app/events/create-events/utils/eventTransformers.js

export const transformEventToFormData = (event) => {
  if (!event) return null;

  // Helper for date/time strings
  const safeDate = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");
  const safeTime = (d) => (d ? new Date(d).toTimeString().slice(0, 5) : "");

  // EXPLICIT MAPPING: Only return what the form needs
  return {
    // Basic Info
    id: event.id,
    organizerId: event.organizerId || event.organizer_id,
    eventTitle: event.eventTitle || event.event_title || "",
    eventDescription: event.eventDescription || event.event_description || "",
    category: event.category || "",
    eventType: event.eventType || event.event_type || "physical",

    // Dates & Times
    startDate: safeDate(event.startDate || event.start_date),
    startTime: event.startTime || safeTime(event.startDate || event.start_date),
    endDate: safeDate(event.endDate || event.end_date),
    endTime: event.endTime || safeTime(event.endDate || event.end_date),
    timezone: event.timezone || "Africa/Lagos",

    // Location
    venueName: event.venueName || event.venue_name || "",
    venueAddress: event.venueAddress || event.venue_address || "",
    city: event.city || "",
    state: event.state || "",
    country: event.country || "Nigeria",
    virtualPlatform: event.virtualPlatform || event.virtual_platform || "",
    meetingLink: event.meetingLink || event.meeting_link || "",

    // Tickets - THE CRITICAL PART
    tickets: (event.tickets || []).map((t) => ({
      id: t.id,
      tierName: t.tierName || t.tier_name || "",
      price: (Number(t.price) || 0) / 100,
      quantity: Number(t.quantity) || 0,
      soldCount: Number(t.soldCount) || 0,
      isFree: (Number(t.price) || 0) === 0,
      description: t.description || "",
    })),

    // Images & Meta
    eventImage: event.eventImage || event.event_image_url || null,
    eventImagePreview:
      event.eventImagePreview ||
      event.eventImage ||
      event.event_image_url ||
      "",
    paystackSubaccountCode:
      event.paystackSubaccountCode || event.paystack_subaccount_code || "",
    tags: Array.isArray(event.tags) ? event.tags : [],
    maxAttendees: event.maxAttendees || event.max_attendees || "",
  };
};
export const prepareEventPayload = (
  formData,
  imageUrl = null,
  isEditMode = false,
) => {
  const payload = { ...formData };

  // 1. IMAGE HANDLING
  if (imageUrl) {
    payload.eventImage = imageUrl;
    if (process.env.NODE_ENV === "development") {
      console.log("📸 [Payload] Using NEW uploaded image:", imageUrl);
    }
  } else if (isEditMode && formData.eventImage) {
    payload.eventImage = formData.eventImage;
    if (process.env.NODE_ENV === "development") {
      console.log(
        "📸 [Payload] Preserving EXISTING image:",
        formData.eventImage,
      );
    }
  }

  // 2. Format Dates - Combine date/time into ISO timestamps
  if (payload.startDate && payload.startTime) {
    payload.startDate = new Date(
      `${payload.startDate}T${payload.startTime}:00`,
    ).toISOString();
  }
  if (payload.endDate && payload.endTime) {
    payload.endDate = new Date(
      `${payload.endDate}T${payload.endTime}:00`,
    ).toISOString();
  }

  // 3. Convert Numeric Types
  if (payload.maxAttendees) {
    payload.maxAttendees = parseInt(payload.maxAttendees, 10) || 0;
  }

  // 4. TICKETS - Convert price from naira BACK to kobo for backend
  const sanitizedTickets = (payload.tickets || []).map((t) => {
    // CRITICAL: Convert naira back to kobo (multiply by 100)
    const priceInKobo = Math.round(parseFloat(t.price || 0) * 100);

    const ticket = {
      tierName: t.tierName,
      price: priceInKobo, // Backend expects kobo
      quantity: parseInt(t.quantity, 10) || 0,
      description: t.description || "",
    };

    // Include ticket ID for updates (edit mode)
    if (t.id && isEditMode) {
      ticket.id = t.id;
    }

    // Log price conversion for debugging
    if (process.env.NODE_ENV === "development") {
      console.log(`💰 [Payload] ${ticket.tierName}:`, {
        frontendNaira: t.price,
        backendKobo: priceInKobo,
        calculation: `${t.price} × 100 = ${priceInKobo}`,
        quantity: ticket.quantity,
      });
    }

    return ticket;
  });

  // Assign to the key the backend validator expects
  payload.TicketTiers = sanitizedTickets;

  // 5. Cleanup - Remove UI-only fields
  const fieldsToRemove = [
    "tickets",
    "eventImagePreview",
    "eventImageFile",
    "startTime",
    "endTime",
    "timezone",
  ];

  fieldsToRemove.forEach((k) => delete payload[k]);

  // Log final payload structure
  if (process.env.NODE_ENV === "development") {
    console.log("📦 [Payload] Final structure:", {
      mode: isEditMode ? "EDIT" : "CREATE",
      eventTitle: payload.eventTitle,
      hasImage: !!payload.eventImage,
      ticketCount: payload.TicketTiers?.length || 0,
      tickets: payload.TicketTiers?.map((t) => ({
        name: t.tierName,
        priceKobo: t.price,
        priceNaira: t.price / 100,
      })),
    });
  }

  return payload;
};

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
