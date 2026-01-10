// frontend/src/app/events/create-events/utils/eventTransformers.js

/**
 * Transforms backend event data to frontend form data structure
 * Used when loading an existing event for editing
 */
export const transformEventToFormData = (event) => {
  const safeParseDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
  };

  const safeParseTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? "" : date.toTimeString().slice(0, 5);
  };

  return {
    eventTitle: event.eventTitle || "",
    eventDescription: event.eventDescription || "",
    category: event.category || "",
    eventType: event.eventType || "physical",
    eventImage: event.eventImage || "",
    venueName: event.venueName || "",
    venueAddress: event.venueAddress || "",
    city: event.city || "",
    state: event.state || "",
    country: event.country || "",
    virtualPlatform: event.virtualPlatform || "",
    meetingLink: event.meetingLink || "",
    startDate: safeParseDate(event.startDate),
    startTime: safeParseTime(event.startDate),
    endDate: safeParseDate(event.endDate),
    endTime: safeParseTime(event.endDate),
    tickets: event.tickets || [],
    tags: event.tags || [],
    maxAttendees: event.maxAttendees?.toString() || "",
    paystackSubaccountCode: event.paystackSubaccountCode || "",
  };
};

/**
 * Prepares form data for API submission
 * Transforms frontend form data to backend-compatible payload
 *
 * @param {Object} formData - Form data from the frontend
 * @param {string} imageUrl - Uploaded image URL (if new image)
 * @param {string} userId - Current user ID (NOT sent to backend)
 * @returns {Object} Backend-ready payload
 */
export const prepareEventPayload = (formData, imageUrl) => {
  console.log("📦 Preparing payload from formData:", formData);

  const payload = { ...formData };

  // 1. Handle image URL
  if (imageUrl) {
    payload.eventImage = imageUrl;
  }

  // 2. Combine date and time fields into ISO strings
  if (payload.startDate && payload.startTime) {
    const startDateTimeStr = `${payload.startDate}T${payload.startTime}:00`;
    const endDateTimeStr = `${payload.endDate}T${payload.endTime}:00`;

    const startDateTime = new Date(startDateTimeStr);
    const endDateTime = new Date(endDateTimeStr);

    if (!isNaN(startDateTime.getTime())) {
      payload.startDate = startDateTime.toISOString();
    }
    if (!isNaN(endDateTime.getTime())) {
      payload.endDate = endDateTime.toISOString();
    }
  }

  // 3. Parse maxAttendees to integer
  if (payload.maxAttendees) {
    const parsed = parseInt(payload.maxAttendees, 10);
    payload.maxAttendees = isNaN(parsed) ? null : parsed;
  } else {
    payload.maxAttendees = null;
  }

  // 4. Remove client-only fields
  const fieldsToRemove = [
    "eventImagePreview",
    "startTime",
    "endTime",
    "timezone",
  ];

  fieldsToRemove.forEach((field) => {
    delete payload[field];
  });

  // 5. Remove empty optional fields
  Object.keys(payload).forEach((key) => {
    if (payload[key] === "" || payload[key] === null) {
      delete payload[key];
    }
  });

  // 6. Ensure tickets array exists and is properly formatted
  if (!payload.tickets || !Array.isArray(payload.tickets)) {
    payload.tickets = [];
  }

  console.log("✅ Final payload:", payload);
  return payload;
};
