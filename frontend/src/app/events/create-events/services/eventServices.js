// frontend/src/app/events/create-events/services/eventServices.js
import { frontendInstance } from "@/axiosConfig/axios";

export const handleImageUpload = async (imageFile, eventId = null) => {
  // Validate input
  if (!imageFile || !(imageFile instanceof File)) {
    throw new Error("Invalid image file provided");
  }

  // Validate file size (e.g., 5MB limit)
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  if (imageFile.size > MAX_FILE_SIZE) {
    throw new Error("Image size exceeds 5MB limit");
  }

  // Validate file type
  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  if (!ALLOWED_TYPES.includes(imageFile.type)) {
    throw new Error(
      "Invalid image format. Only JPEG, PNG, WebP, and GIF are allowed",
    );
  }

  try {
    const formData = new FormData();
    formData.append("file", imageFile);

    if (eventId) {
      formData.append("eventId", eventId);
    }

    console.log("📤 Uploading image to Next.js API route", {
      fileName: imageFile.name,
      fileSize: `${(imageFile.size / 1024).toFixed(2)} KB`,
      fileType: imageFile.type,
      eventId: eventId || "new event",
    });

    const response = await frontendInstance.post("/api/event-image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 30000, // 30 second timeout for uploads
    });

    if (!response.data?.url) {
      throw new Error("Upload succeeded but no URL returned");
    }

    console.log("✅ Image upload successful:", {
      url: response.data.url,
      status: response.status,
    });

    return response.data.url;
  } catch (error) {
    console.error("❌ Image upload failed:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    // Provide user-friendly error messages
    if (error.code === "ECONNABORTED") {
      throw new Error(
        "Upload timed out. Please try again with a smaller image.",
      );
    }

    const errorMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Failed to upload image";

    throw new Error(errorMessage);
  }
};

export const deleteImage = async (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") {
    console.warn("⚠️ Invalid image URL provided for deletion:", imageUrl);
    return { success: false, message: "Invalid URL" };
  }

  // Skip deletion for non-Vercel Blob URLs (safety check)
  if (!imageUrl.includes("blob.vercel-storage.com")) {
    console.warn("⚠️ Attempted to delete non-Vercel Blob URL:", imageUrl);
    return { success: false, message: "Not a Vercel Blob URL" };
  }

  try {
    console.log("🗑️ Deleting image:", imageUrl);

    const response = await frontendInstance.delete("/api/event-image", {
      data: { url: imageUrl },
      timeout: 10000, // 10 second timeout
    });

    console.log("✅ Image deleted successfully");
    return response.data;
  } catch (error) {
    console.error("❌ Image deletion failed:", {
      url: imageUrl,
      message: error.message,
      response: error.response?.data,
    });

    // Don't throw - log and return error info
    // This prevents deletion failures from blocking the main operation
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
};

export const isVercelBlobUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  return url.includes("blob.vercel-storage.com");
};

export const validateEventForm = (formData, initialData = null) => {
  const errors = [];
  const errorMap = {}; // NEW: Map errors to specific fields for UI
  const now = new Date();
  const bufferTime = new Date(now.getTime() - 30 * 60000);
  const isEditMode = !!initialData;

  // Helper to add both error message and field mapping
  const addError = (message, field = null) => {
    errors.push(message);
    if (field) {
      errorMap[field] = message;
    }
  };

  // --- 1. BASIC FIELD VALIDATION ---
  if (!formData.eventTitle?.trim()) {
    addError("Event title is required", "eventTitle");
  }
  if (!formData.eventDescription?.trim()) {
    addError("Event description is required", "eventDescription");
  }
  if (!formData.category?.trim()) {
    addError("Please select an event category", "category");
  }
  if (!formData.eventType) {
    addError("Please select if the event is Physical or Virtual", "eventType");
  }

  // --- 2. TEMPORAL INTEGRITY (Dates & Times) ---
  if (!formData.startDate) {
    addError("Start date is required", "startDate");
  }
  if (!formData.startTime) {
    addError("Start time is required", "startTime");
  }

  if (formData.startDate && formData.endDate) {
    const start = new Date(
      `${formData.startDate}T${formData.startTime || "00:00"}:00`,
    );
    const end = new Date(
      `${formData.endDate}T${formData.endTime || "23:59"}:00`,
    );

    if (start > end) {
      addError("The event cannot end before it starts.", "endDate");
    }

    if (start < bufferTime) {
      addError("The selected start time has already passed.", "startDate");
    }

    if (isEditMode && initialData.soldCount > 0) {
      const originalStart = new Date(initialData.startDate);
      if (start.getTime() !== originalStart.getTime()) {
        addError("Date cannot be changed once tickets are sold.", "startDate");
      }
    }
  }

  // --- 3. TICKETING & FINANCIAL FAIRNESS ---
  if (!formData.tickets || formData.tickets.length === 0) {
    addError("You must add at least one ticket tier.", "tickets");
  } else {
    formData.tickets.forEach((ticket, index) => {
      const label = ticket.tierName || `Ticket #${index + 1}`;
      const initialTicket = initialData?.tickets?.find(
        (t) => t.id === ticket.id,
      );
      const ticketsSoldForThisTier = initialTicket?.soldCount || 0;

      if (!ticket.tierName?.trim()) {
        addError(`${label}: Name is required.`, `ticket_${index}_tierName`);
      }

      if (ticket.price < 0) {
        addError(
          `${label}: Price cannot be negative.`,
          `ticket_${index}_price`,
        );
      }

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

  // --- 4. LOGISTICS & DISCOVERY ---
  if (formData.eventType === "physical") {
    if (!formData.venueName?.trim()) {
      addError("Venue name is required.", "venueName");
    }
    if (!formData.city?.trim()) {
      addError("Please specify the city.", "city");
    }
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

  // --- 5. IMAGE VALIDATION (FIXED: Check both preview and file) ---
  // Allow either uploaded file OR existing image URL
  const hasImage =
    formData.eventImageFile ||
    formData.eventImage ||
    formData.eventImagePreview;

  if (!hasImage) {
    addError("An event cover image is required.", "eventImage");
  }

  return {
    isValid: errors.length === 0,
    errors,
    errorMap, // NEW: Return field-specific error mapping
  };
};