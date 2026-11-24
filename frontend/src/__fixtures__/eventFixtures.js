/**
 * __fixtures__/eventFixtures.js
 *
 * Shared mock factories for the Eventify test suite.
 * Import these in every test file — do NOT duplicate them.
 *
 * Usage:
 *   const { makeTicket, makeEvent, makeFormData } = require("../__fixtures__/eventFixtures");
 */

const makeTicket = (overrides = {}) => ({
  id: "tier-1",
  tierName: "General Admission",
  price: 5000, // Naira — backend sends naira, no kobo conversion needed
  quantity: 100,
  soldCount: 0,
  description: "Standard entry",
  isFree: false,
  ...overrides,
});

const makeEvent = (overrides = {}) => ({
  id: "evt-001",
  eventTitle: "Lagos Tech Summit",
  eventDescription: "Annual technology conference",
  category: "Technology",
  eventType: "physical",
  startDate: "2099-06-15T09:00:00Z",
  endDate: "2099-06-15T18:00:00Z",
  venueName: "Lagos Convention Centre",
  venueAddress: "123 Main Street",
  city: "Lagos",
  state: "Lagos",
  country: "Nigeria",
  tickets: [makeTicket()],
  eventImage: "https://blob.vercel-storage.com/test/img.jpg",
  tags: [],
  maxAttendees: 200,
  organizerId: "user-123",
  ...overrides,
});

const makeFormData = (overrides = {}) => ({
  eventTitle: "Lagos Tech Summit",
  eventDescription: "Annual technology conference",
  category: "Technology",
  eventType: "physical",
  startDate: "2099-06-15",
  startTime: "09:00",
  endDate: "2099-06-15",
  endTime: "18:00",
  venueName: "Lagos Convention Centre",
  venueAddress: "123 Main Street",
  city: "Lagos",
  state: "Lagos",
  country: "Nigeria",
  virtualPlatform: "",
  meetingLink: "",
  tickets: [makeTicket()],
  eventImage: "https://blob.vercel-storage.com/test/img.jpg",
  eventImagePreview: "https://blob.vercel-storage.com/test/img.jpg",
  eventImageFile: null,
  tags: [],
  maxAttendees: 200,
  organizerId: "user-123",
  paystackSubaccountCode: "ACCT_testxxx",
  ...overrides,
});

// Inline pure-function implementations
// ─────────────────────────────────────────────────────────────────────────────
// These mirror the real source files. Swap for real imports once module
// resolution is confirmed working in your Jest config.
// ─────────────────────────────────────────────────────────────────────────────

const transformEventToFormData = (event) => {
  if (!event) return null;
  const start = event.startDate ? new Date(event.startDate) : null;
  const end = event.endDate ? new Date(event.endDate) : null;
  return {
    id: event.id,
    organizerId: event.organizerId || event.userId,
    eventTitle: event.eventTitle || event.title || "",
    eventDescription: event.eventDescription || event.description || "",
    category: event.category || "",
    eventType: event.eventType || "physical",
    startDate: start ? start.toISOString().split("T")[0] : "",
    startTime: start ? start.toTimeString().slice(0, 5) : "",
    endDate: end ? end.toISOString().split("T")[0] : "",
    endTime: end ? end.toTimeString().slice(0, 5) : "",
    venueName: event.venueName || "",
    venueAddress: event.venueAddress || "",
    city: event.city || "",
    state: event.state || "",
    country: event.country || "",
    virtualPlatform: event.virtualPlatform || "",
    meetingLink: event.meetingLink || "",
    tickets: (event.tickets || []).map((t) => ({
      id: t.id,
      tierName: t.tierName || t.name || "",
      price: Number(t.price || 0),
      quantity: Number(t.quantity || t.capacity || 0),
      description: t.description || "",
      soldCount: t.soldCount || 0,
      isFree: Number(t.price) === 0,
    })),
    eventImage: event.eventImage || "",
    eventImagePreview: event.eventImage || "",
    tags: Array.isArray(event.tags) ? event.tags : [],
    maxAttendees: Number(event.maxAttendees || 0),
  };
};

const prepareEventPayload = (formData) => {
  const combineDateTime = (date, time) => {
    if (!date) return null;
    try {
      return time
        ? new Date(`${date}T${time}`).toISOString()
        : new Date(date).toISOString();
    } catch {
      return new Date(date).toISOString();
    }
  };
  return {
    organizerId: formData.organizerId,
    eventTitle: formData.eventTitle,
    eventDescription: formData.eventDescription,
    category: formData.category,
    eventType: formData.eventType,
    eventImage: formData.eventImage,
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
    tickets: (formData.tickets || []).map((ticket) => ({
      id: ticket.id || undefined,
      tierName: ticket.tierName,
      description: ticket.description || "",
      price: Number(ticket.price),
      quantity: Number(ticket.quantity),
    })),
  };
};

const normalizeEventResponse = (data) => {
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
};

const getFieldLockStatus = (tickets = []) => {
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

const validateEventForm = (formData, initialData = null) => {
  const errors = [];
  const errorMap = {};
  const now = new Date();
  const bufferTime = new Date(now.getTime() - 30 * 60000);
  const isEditMode = !!initialData;

  const addError = (message, field = null) => {
    errors.push(message);
    if (field) errorMap[field] = message;
  };

  if (!formData.eventTitle?.trim())
    addError("Event title is required", "eventTitle");
  if (!formData.eventDescription?.trim())
    addError("Event description is required", "eventDescription");
  if (!formData.category?.trim())
    addError("Please select an event category", "category");
  if (!formData.eventType)
    addError("Please select if the event is Physical or Virtual", "eventType");
  if (!formData.startDate) addError("Start date is required", "startDate");
  if (!formData.startTime) addError("Start time is required", "startTime");

  if (formData.startDate && formData.endDate) {
    const start = new Date(
      `${formData.startDate}T${formData.startTime || "00:00"}:00`,
    );
    const end = new Date(
      `${formData.endDate}T${formData.endTime || "23:59"}:00`,
    );
    if (start > end)
      addError("The event cannot end before it starts.", "endDate");
    if (start < bufferTime)
      addError("The selected start time has already passed.", "startDate");
    if (isEditMode && initialData.soldCount > 0) {
      const originalStart = new Date(initialData.startDate);
      if (start.getTime() !== originalStart.getTime()) {
        addError("Date cannot be changed once tickets are sold.", "startDate");
      }
    }
  }

  if (!formData.tickets || formData.tickets.length === 0) {
    addError("You must add at least one ticket tier.", "tickets");
  } else {
    formData.tickets.forEach((ticket, index) => {
      const label = ticket.tierName || `Ticket #${index + 1}`;
      const initialTicket = initialData?.tickets?.find(
        (t) => t.id === ticket.id,
      );
      const ticketsSoldForThisTier = initialTicket?.soldCount || 0;
      if (!ticket.tierName?.trim())
        addError(`${label}: Name is required.`, `ticket_${index}_tierName`);
      if (ticket.price < 0)
        addError(
          `${label}: Price cannot be negative.`,
          `ticket_${index}_price`,
        );
      if (isEditMode && ticketsSoldForThisTier > 0) {
        if (Number(ticket.price) !== Number(initialTicket.price)) {
          addError(
            `${label}: Price cannot be changed after tickets are sold.`,
            `ticket_${index}_price`,
          );
        }
      }
      if (ticket.quantity < ticketsSoldForThisTier) {
        addError(
          `${label}: Capacity cannot be less than ${ticketsSoldForThisTier} tickets sold.`,
          `ticket_${index}_quantity`,
        );
      } else if (ticket.quantity <= 0) {
        addError(
          `${label}: Total capacity must be at least 1.`,
          `ticket_${index}_quantity`,
        );
      }
    });
    if (isEditMode && initialData?.tickets) {
      initialData.tickets.forEach((initialTicket) => {
        const stillExists = formData.tickets.some(
          (t) => t.id === initialTicket.id,
        );
        if (!stillExists && initialTicket.soldCount > 0) {
          addError(
            `Cannot delete '${initialTicket.tierName}' - tickets already sold.`,
            "tickets",
          );
        }
      });
    }
  }

  if (formData.eventType === "physical") {
    if (!formData.venueName?.trim())
      addError("Venue name is required.", "venueName");
    if (!formData.city?.trim()) addError("Please specify the city.", "city");
  }

  if (formData.eventType === "virtual") {
    if (
      !formData.meetingLink?.trim() ||
      !formData.meetingLink.startsWith("http")
    ) {
      addError(
        "A valid virtual meeting link (starting with http/https) is required.",
        "meetingLink",
      );
    }
  }

  const hasImage =
    formData.eventImageFile ||
    formData.eventImage ||
    formData.eventImagePreview;
  if (!hasImage) addError("An event cover image is required.", "eventImage");

  return { isValid: errors.length === 0, errors, errorMap };
};

const computeLockStatus = (tickets = []) => {
  const totalSold = tickets.reduce((sum, t) => sum + (t.soldCount || 0), 0);
  const hasSales = totalSold > 0;
  return {
    priceFields: hasSales,
    paystackSubaccount: hasSales,
    quantityFields: false,
    venueFields: hasSales,
    venueAddress: hasSales,
    city: hasSales,
    state: hasSales,
    country: hasSales,
    canAddTiers: !hasSales,
    canRemoveTiers: !hasSales,
    canRenameTiers: !hasSales,
    totalSold,
    hasAnySales: hasSales,
    lockReason: hasSales
      ? `Cannot modify: ${totalSold} ticket${totalSold === 1 ? "" : "s"} already sold`
      : null,
    shortReason: hasSales ? "Tickets sold" : null,
  };
};

const isTicketLocked = (ticket) => {
  if (!ticket) return false;
  if (!ticket.id) return false;
  const isExisting = !ticket.id.toString().startsWith("temp-");
  const hasSales = (ticket.soldCount || 0) > 0;
  return isExisting && hasSales;
};

const getMinCapacity = (ticket) => Math.max(1, ticket.soldCount || 0);

const koboToNaira = (kobo) => {
  if (typeof kobo !== "number" || isNaN(kobo) || kobo < 0) return 0;
  return kobo / 100;
};

const formatCurrency = (naira) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira ?? 0);

const validateImageFile = (imageFile, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024,
    allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"],
  } = options;
  if (!imageFile) return { isValid: false, error: "No image file provided" };
  if (!allowedTypes.includes(imageFile.type))
    return { isValid: false, error: "Invalid image type." };
  if (imageFile.size > maxSize)
    return { isValid: false, error: "Image size exceeds limit." };
  return { isValid: true };
};

const normalizeEventsForPage = (rawEvents) => {
  if (!rawEvents || !Array.isArray(rawEvents)) return [];
  return rawEvents.map((event) => {
    const startingPrice = event.tickets?.[0]?.price ?? 0;
    let tag = "New";
    if (startingPrice === 0) tag = "Free Ticket";
    else if (startingPrice > 10000) tag = "Trending";
    return {
      id: event.id,
      title: event.eventTitle,
      category: event.category,
      image: event.eventImage,
      price: startingPrice,
      isFree: startingPrice === 0,
      tag,
      filterTitle: event.eventTitle?.toLowerCase() ?? "",
      filterCity: event.city?.trim() || "N/A",
      startDate: event.startDate,
    };
  });
};

const filterAndSortEvents = (
  events,
  { searchTerm, category, location, sortBy },
) => {
  let result = events.filter((e) => {
    const matchesSearch = e.filterTitle.includes(searchTerm.toLowerCase());
    const matchesCategory = category === "All" || e.category === category;
    const matchesLocation =
      location === "All Locations" || e.filterCity === location;
    return matchesSearch && matchesCategory && matchesLocation;
  });
  const sorted = [...result];
  if (sortBy === "date-asc")
    sorted.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  else if (sortBy === "date-desc")
    sorted.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  else if (sortBy === "price-asc") sorted.sort((a, b) => a.price - b.price);
  else if (sortBy === "price-desc") sorted.sort((a, b) => b.price - a.price);
  return sorted;
};

module.exports = {
  // Factories
  makeTicket,
  makeEvent,
  makeFormData,
  // Transformer implementations
  transformEventToFormData,
  prepareEventPayload,
  normalizeEventResponse,
  getFieldLockStatus,
  // Validation
  validateEventForm,
  // Lock logic
  computeLockStatus,
  isTicketLocked,
  getMinCapacity,
  // Currency
  koboToNaira,
  formatCurrency,
  // Media
  validateImageFile,
  // Page client
  normalizeEventsForPage,
  filterAndSortEvents,
};
