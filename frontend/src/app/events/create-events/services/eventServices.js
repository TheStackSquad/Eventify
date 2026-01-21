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
  const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!ALLOWED_TYPES.includes(imageFile.type)) {
    throw new Error("Invalid image format. Only JPEG, PNG, WebP, and GIF are allowed");
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
      throw new Error("Upload timed out. Please try again with a smaller image.");
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
  const now = new Date();
  // 30-minute grace period for "Today" events
  const bufferTime = new Date(now.getTime() - 30 * 60000);
  const isEditMode = !!initialData;

  // --- 1. BASIC FIELD VALIDATION ---
  if (!formData.eventTitle?.trim()) errors.push("Event title is required");
  if (!formData.eventDescription?.trim())
    errors.push("Event description is required");
  if (!formData.category?.trim())
    errors.push("Please select an event category");
  if (!formData.eventType)
    errors.push("Please select if the event is Physical or Virtual");

  // --- 2. TEMPORAL INTEGRITY (Dates & Times) ---
  if (formData.startDate && formData.endDate) {
    const start = new Date(
      `${formData.startDate}T${formData.startTime || "00:00"}:00`,
    );
    const end = new Date(
      `${formData.endDate}T${formData.endTime || "23:59"}:00`,
    );

    if (start > end) {
      errors.push("The event cannot end before it starts.");
    }

    if (start < bufferTime) {
      errors.push("The selected start time has already passed.");
    }

    // Fairness Rule: Prevent last-minute date changes if tickets are sold
    if (isEditMode && initialData.soldCount > 0) {
      const originalStart = new Date(initialData.startDate);
      if (start.getTime() !== originalStart.getTime()) {
        errors.push(
          "Date cannot be changed once tickets are sold. Please contact support or notify attendees.",
        );
      }
    }
  }

  // --- 3. TICKETING & FINANCIAL FAIRNESS ---
  if (!formData.tickets || formData.tickets.length === 0) {
    errors.push("You must add at least one ticket tier.");
  } else {
    formData.tickets.forEach((ticket, index) => {
      const label = ticket.tierName || `Ticket #${index + 1}`;
      const initialTicket = initialData?.tickets?.find(
        (t) => t.id === ticket.id,
      );
      const ticketsSoldForThisTier = initialTicket?.soldCount || 0;

      // Basic Tier Checks
      if (!ticket.tierName?.trim()) errors.push(`${label}: Name is required.`);

      // Price Fairness: Reject negative, allow 0 (Free)
      if (ticket.price < 0) {
        errors.push(`${label}: Price cannot be negative.`);
      }

      // INTEGRITY: Price Lock if sold
      if (isEditMode && ticketsSoldForThisTier > 0) {
        if (Number(ticket.price) !== Number(initialTicket.price)) {
          errors.push(
            `${label}: Price cannot be changed because tickets have already been sold at the original price.`,
          );
        }
      }

      // INTEGRITY: Capacity Floor
      if (ticket.quantity < ticketsSoldForThisTier) {
        errors.push(
          `${label}: Capacity cannot be less than the ${ticketsSoldForThisTier} tickets already sold.`,
        );
      } else if (ticket.quantity <= 0) {
        errors.push(`${label}: Total capacity must be at least 1.`);
      }
    });

    // Check for Tier Deletion Integrity
    if (isEditMode) {
      initialData.tickets.forEach((initialTicket) => {
        const stillExists = formData.tickets.some(
          (t) => t.id === initialTicket.id,
        );
        if (!stillExists && initialTicket.soldCount > 0) {
          errors.push(
            `Cannot delete '${initialTicket.tierName}' because attendees have already purchased tickets from this tier.`,
          );
        }
      });
    }
  }

  // --- 4. LOGISTICS & DISCOVERY ---
  if (formData.eventType === "physical") {
    if (!formData.venueName?.trim()) errors.push("Venue name is required.");
    if (!formData.city?.trim()) errors.push("Please specify the city.");
  }

  if (formData.eventType === "virtual") {
    if (
      !formData.meetingLink?.trim() ||
      !formData.meetingLink.startsWith("http")
    ) {
      errors.push(
        "A valid virtual meeting link (starting with http/https) is required.",
      );
    }
  }

  if (!formData.eventImage) {
    errors.push("An event cover image is required for a professional look.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
