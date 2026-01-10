// frontend/src/services/eventsApi.js

import axios from "@/axiosConfig/axios";
import { API_ENDPOINTS } from "@/utils/constants/globalConstants";

const getCookie = (name) => {
  if (typeof document === "undefined") return "";
  const cookieString = document.cookie;
  const cookies = cookieString.split("; ");
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const [key, value] = cookie.split("=");
    if (key === name) {
      return value;
    }
  }
  return "";
};

export async function createEventApi(eventData) {
  try {
    console.log("📤 [createEventApi] Sending event data:", {
      dataType: typeof eventData,
      keys: Object.keys(eventData || {}),
      dataSample: JSON.stringify(eventData).substring(0, 200) + "...",
    });

    const response = await axios.post(API_ENDPOINTS.EVENTS.CREATE, eventData);

    console.log("✅ [createEventApi] Success:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "🚨 [createEventApi] API call failed:",
      error.response?.data || error.message,
      "Full error:",
      error
    );
    throw error;
  }
}

export async function fetchUserEventsApi() {
  const response = await axios.get(API_ENDPOINTS.EVENTS.MY_EVENTS);
  return response.data;
}

export async function fetchAllEventsApi() {
  const response = await axios.get(API_ENDPOINTS.EVENTS.BASE);
  console.log('event data:', response);
  return response.data;
}

export async function fetchEventByIdApi(eventId) {
  if (!eventId) {
    throw new Error("Event ID is required to fetch an event.");
  }
  const endpoint = API_ENDPOINTS.EVENTS.GET_BY_ID.replace(":eventId", eventId);
  const response = await axios.get(endpoint);
  return response.data;
}

export async function fetchEventAnalyticsApi(eventId) {
  if (!eventId) {
    throw new Error("Event ID is required for analytics.");
  }
  const endpoint = API_ENDPOINTS.EVENTS.ANALYTICS.replace(":eventId", eventId);
  const response = await axios.get(endpoint);
  // Assuming the analytics data is nested under 'data' as per Redux logic
  return response.data.data;
}

export async function updateEventApi({ eventId, updates }) {
  const endpoint = API_ENDPOINTS.EVENTS.UPDATE.replace(":id", eventId);
  const response = await axios.put(endpoint, updates);
  return response.data;
}

export async function deleteEventApi(eventId) {
  const endpoint = API_ENDPOINTS.EVENTS.DELETE.replace(":id", eventId);
  await axios.delete(endpoint);
  return { eventId };
}

export async function publishEventApi({ eventId, isPublished }) {
  const response = await axios.patch(
    `/events/${eventId}/publish`, // Hardcoded endpoint used in original thunk
    { isPublished }
  );
  return response.data;
}

export async function likeEventApi(eventId) {
    if (!eventId) {
        throw new Error("Event ID is required to like/unlike an event.");
    }
    
    const endpoint = API_ENDPOINTS.EVENTS.LIKE.replace(":eventId", eventId);
    
    const guestId = getCookie("guest_id"); 
    
    // The axios instance is configured with `withCredentials: true`, 
    // ensuring the `guest_id` cookie is sent automatically.
    
    const response = await axios.post(endpoint, {
        // We can optionally pass the guestId in the body for debugging/service clarity
        guest_id: guestId || undefined // Send only if we found it
    });

    return response.data;
}