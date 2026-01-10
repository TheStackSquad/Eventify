// frontend/src/app/events/create-events/services/eventServices.js

import { frontendInstance } from "@/axiosConfig/axios";

export const handleImageUpload = async (imageFile, eventId = null) => {
  try {
    const formData = new FormData();
    formData.append("file", imageFile);
    
    if (eventId) {
      formData.append("eventId", eventId);
    }

    console.log("📤 Uploading image to Next.js API route", {
      fileName: imageFile.name,
      fileSize: imageFile.size,
      fileType: imageFile.type,
      eventId: eventId || "new event",
    });

    // ✅ Use frontendInstance instead of axios
    const response = await frontendInstance.post("/api/event-image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

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

    const errorMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      "Failed to upload image";

    throw new Error(errorMessage);
  }
};

// ✅ Add new delete function
export const deleteImage = async (imageUrl) => {
  try {
    console.log("🗑️ Deleting image:", imageUrl);

    const response = await frontendInstance.delete("/api/event-image", {
      data: { url: imageUrl },
    });

    console.log("✅ Image deleted successfully");
    return response.data;
  } catch (error) {
    console.error("❌ Image deletion failed:", error);
    throw error;
  }
};


export const validateEventForm = (formData) => {
  const errors = [];

  // Required fields
  if (!formData.eventTitle?.trim()) {
    errors.push("Event title is required");
  }

  if (!formData.eventDescription?.trim()) {
    errors.push("Event description is required");
  }

  if (!formData.category?.trim()) {
    errors.push("Category is required");
  }

  if (!formData.eventType) {
    errors.push("Event type is required");
  }

  if (!formData.startDate) {
    errors.push("Start date is required");
  }

  if (!formData.endDate) {
    errors.push("End date is required");
  }

  // Date validation
  if (formData.startDate && formData.endDate) {
    const start = new Date(
      `${formData.startDate}T${formData.startTime || "00:00"}:00`
    );
    const end = new Date(
      `${formData.endDate}T${formData.endTime || "23:59"}:00`
    );

    if (start > end) {
      errors.push("End date/time must be after start date/time");
    }

    if (start < new Date()) {
      errors.push("Event cannot start in the past");
    }
  }

  // Tickets validation
  if (!formData.tickets || formData.tickets.length === 0) {
    errors.push("At least one ticket tier is required");
  } else {
    formData.tickets.forEach((ticket, index) => {
      if (!ticket.tierName?.trim()) {
        errors.push(`Ticket #${index + 1}: Name is required`);
      }
      if (!ticket.price || ticket.price <= 0) {
        errors.push(`Ticket #${index + 1}: Valid price is required`);
      }
      if (!ticket.quantity || ticket.quantity <= 0) {
        errors.push(`Ticket #${index + 1}: Valid quantity is required`);
      }
    });
  }

  // Physical event validation
  if (formData.eventType === "physical") {
    if (!formData.venueName?.trim()) {
      errors.push("Venue name is required for physical events");
    }
    if (!formData.city?.trim()) {
      errors.push("City is required for physical events");
    }
  }

  // Virtual event validation
  if (formData.eventType === "virtual") {
    if (!formData.virtualPlatform?.trim()) {
      errors.push("Virtual platform is required for virtual events");
    }
    if (!formData.meetingLink?.trim()) {
      errors.push("Meeting link is required for virtual events");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
