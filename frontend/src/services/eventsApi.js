// frontend/src/services/eventsApi.js
import backendInstance from "@/axiosConfig/axios";
import { API_ENDPOINTS } from "@/utils/constants/globalConstants";
import {
  prepareEventPayload,
  // normalizeEventResponse,
} from "@/app/events/create-events/utils/eventTransformers";

const getCookie = (name) => {
  if (typeof document === "undefined") return "";
  const cookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`));
  return cookie ? cookie.split("=")[1] : "";
};

const normalizeEventsResponse = (axiosResponse) => {
  const responseData = axiosResponse.data;
  if (responseData?.data?.events) return responseData.data.events;
  if (responseData?.events) return responseData.events;
  if (Array.isArray(responseData)) return responseData;
  return [];
};

const normalizeEventResponse = (axiosResponse) => {
  const responseData = axiosResponse.data;
  if (responseData?.data?.event) return responseData.data.event;
  if (responseData?.event) return responseData.event;
  if (responseData?.data) return responseData.data;
  return responseData || {};
};

const normalizeAnalyticsResponse = (axiosResponse) => {
  const responseData = axiosResponse.data;
  if (responseData?.data?.analytics) return responseData.data.analytics;
  if (responseData?.analytics) return responseData.analytics;
  if (responseData?.data) return responseData.data;
  return responseData || {};
};

export async function createEventApi(eventData) {
  try {
    const response = await backendInstance.post(
      API_ENDPOINTS.EVENTS.CREATE,
      eventData
    );
    return normalizeEventResponse(response);
  } catch (error) {
    console.error("[createEventApi]", error.response?.data || error.message);
    throw error;
  }
}

export async function fetchUserEventsApi() {
  const response = await backendInstance.get(API_ENDPOINTS.EVENTS.MY_EVENTS);
  return normalizeEventsResponse(response);
}

export async function fetchAllEventsApi() {
  const response = await backendInstance.get(API_ENDPOINTS.EVENTS.BASE);
  return normalizeEventsResponse(response);
}

export async function fetchEventByIdApi(eventId) {
  if (!eventId) throw new Error("Event ID is required");
  const endpoint = API_ENDPOINTS.EVENTS.GET_BY_ID.replace(":eventId", eventId);
  const response = await backendInstance.get(endpoint);
  return normalizeEventResponse(response);
}

export async function fetchEventAnalyticsApi(eventId) {
  if (!eventId) throw new Error("Event ID is required");
  const endpoint = API_ENDPOINTS.EVENTS.ANALYTICS.replace(":eventId", eventId);
  const response = await backendInstance.get(endpoint);
  return normalizeAnalyticsResponse(response);
}

export async function updateEventApi({ eventId, updates }) {
  // 1. Validation Guard
  if (!eventId || eventId === 'undefined') {
    throw new Error('Invalid event ID provided to updateEventApi');
  }

  console.group("📡 [API Request] updateEventApi");
  
  try {
    // 2. THE FIX: Apply the mapping logic here
    // This ensures 'tierName' in UI maps to 'tierName' in Go JSON tag
    // and 'quantity' maps to 'quantity' (Capacity in Go struct)
    const sanitizedPayload = prepareEventPayload(updates);

    const endpoint = API_ENDPOINTS.EVENTS.UPDATE.replace(":eventId", eventId);
    
    console.log("📤 Sending Mapping-Verified Payload:", sanitizedPayload);

    // 3. Execute PUT request to Go Gin Server
    const response = await backendInstance.put(endpoint, sanitizedPayload);

    // 4. Normalize the response
    // Converts Go's response (with potential nulls) into clean UI data
    const normalizedData = normalizeEventResponse(response.data);
    
    console.log("✅ Received & Normalized Response:", normalizedData);
    console.groupEnd();
    
    return normalizedData;
  } catch (error) {
    console.error("❌ API Error in updateEventApi:", error);
    console.groupEnd();
    throw error;
  }
}

export async function deleteEventApi(eventId) {
  const endpoint = API_ENDPOINTS.EVENTS.DELETE.replace(":id", eventId);
  await backendInstance.delete(endpoint);
  return { eventId };
}

export async function publishEventApi({ eventId, isPublished }) {
  const response = await backendInstance.patch(`/events/${eventId}/publish`, {
    isPublished,
  });
  return normalizeEventResponse(response);
}

export async function likeEventApi(eventId) {
  if (!eventId) throw new Error("Event ID is required");
  const endpoint = API_ENDPOINTS.EVENTS.LIKE.replace(":eventId", eventId);
  const guestId = getCookie("guest_id");
  const response = await backendInstance.post(endpoint, {
    guest_id: guestId || undefined,
  });
  return response.data;
}
