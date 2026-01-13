// frontend/src/services/eventsApi.js
import axios from "@/axiosConfig/axios";
import { API_ENDPOINTS } from "@/utils/constants/globalConstants";

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getCookie = (name) => {
  if (typeof document === "undefined") return "";
  const cookies = document.cookie.split("; ");
  const cookie = cookies.find((c) => c.startsWith(`${name}=`));
  return cookie ? cookie.split("=")[1] : "";
};

// ============================================
// RESPONSE NORMALIZERS - SYNC WITH HOOKS
// ============================================

/**
 * Normalize events response to match hook expectations
 * HOOK EXPECTS: Flat array of events
 */
const normalizeEventsResponse = (axiosResponse) => {
  // axiosResponse is the full Axios response object
  const responseData = axiosResponse.data;

  console.log("[normalizeEventsResponse] Processing response:", {
    status: axiosResponse.status,
    responseDataType: typeof responseData,
    responseDataKeys: Object.keys(responseData || {}),
    fullAxiosKeys: Object.keys(axiosResponse),
  });

  // Pattern 1: Nested structure { data: { events: [], filters: {}, total: 3 } }
  if (responseData?.data?.events && Array.isArray(responseData.data.events)) {
    console.log(
      `✓ Found ${responseData.data.events.length} events in data.data.events`
    );
    return responseData.data.events;
  }

  // Pattern 2: Direct structure { events: [], filters: {}, total: 3 }
  if (responseData?.events && Array.isArray(responseData.events)) {
    console.log(`✓ Found ${responseData.events.length} events in data.events`);
    return responseData.events;
  }

  // Pattern 3: Direct array [event1, event2, ...]
  if (Array.isArray(responseData)) {
    console.log(`✓ Found ${responseData.length} events in direct array`);
    return responseData;
  }

  console.warn(
    "[normalizeEventsResponse] No events array found, returning empty"
  );
  return [];
};

/**
 * Normalize single event response
 */
const normalizeEventResponse = (axiosResponse) => {
  const responseData = axiosResponse.data;

  if (responseData?.data?.event) return responseData.data.event;
  if (responseData?.event) return responseData.event;
  if (responseData?.data && !Array.isArray(responseData.data))
    return responseData.data;
  return responseData || {};
};

/**
 * Normalize analytics response
 */
const normalizeAnalyticsResponse = (axiosResponse) => {
  const responseData = axiosResponse.data;

  if (responseData?.data?.analytics) return responseData.data.analytics;
  if (responseData?.analytics) return responseData.analytics;
  if (responseData?.data) return responseData.data;
  return responseData || {};
};

// ============================================
// API FUNCTIONS - SYNC WITH HOOKS
// ============================================

/**
 * CREATE EVENT - Returns single event object
 */
export async function createEventApi(eventData) {
  try {
    const response = await axios.post(API_ENDPOINTS.EVENTS.CREATE, eventData);
    return normalizeEventResponse(response);
  } catch (error) {
    console.error("[createEventApi]", error.response?.data || error.message);
    throw error;
  }
}

/**
 * FETCH USER EVENTS - Returns flat array
 */
export async function fetchUserEventsApi() {
  const response = await axios.get(API_ENDPOINTS.EVENTS.MY_EVENTS);
  return normalizeEventsResponse(response);
}

/**
 * FETCH ALL EVENTS - CRITICAL: Must return flat array for useAllEvents hook
 */
export async function fetchAllEventsApi() {
  console.log("[fetchAllEventsApi] Calling:", API_ENDPOINTS.EVENTS.BASE);

  const response = await axios.get(API_ENDPOINTS.EVENTS.BASE);
  const events = normalizeEventsResponse(response);

  console.log("[fetchAllEventsApi] Returning:", {
    eventsCount: events.length,
    isArray: Array.isArray(events),
    firstEventId: events[0]?.id,
  });

  return events; // Hook expects flat array
}

/**
 * FETCH EVENT BY ID - Returns single event object
 */
export async function fetchEventByIdApi(eventId) {
  if (!eventId) throw new Error("Event ID is required");

  const endpoint = API_ENDPOINTS.EVENTS.GET_BY_ID.replace(":eventId", eventId);
  const response = await axios.get(endpoint);

  return normalizeEventResponse(response);
}

/**
 * FETCH EVENT ANALYTICS - Returns analytics object
 */
export async function fetchEventAnalyticsApi(eventId) {
  if (!eventId) throw new Error("Event ID is required");

  const endpoint = API_ENDPOINTS.EVENTS.ANALYTICS.replace(":eventId", eventId);
  const response = await axios.get(endpoint);

  return normalizeAnalyticsResponse(response);
}

/**
 * UPDATE EVENT - Returns updated event object
 */
export async function updateEventApi({ eventId, updates }) {
  const endpoint = API_ENDPOINTS.EVENTS.UPDATE.replace(":id", eventId);
  const response = await axios.put(endpoint, updates);

  return normalizeEventResponse(response);
}

/**
 * DELETE EVENT - Returns { eventId } confirmation
 */
export async function deleteEventApi(eventId) {
  const endpoint = API_ENDPOINTS.EVENTS.DELETE.replace(":id", eventId);
  await axios.delete(endpoint);

  return { eventId };
}

/**
 * PUBLISH EVENT - Returns updated event object
 */
export async function publishEventApi({ eventId, isPublished }) {
  const response = await axios.patch(`/events/${eventId}/publish`, {
    isPublished,
  });
  return normalizeEventResponse(response);
}

/**
 * LIKE EVENT - Returns like status object
 */
export async function likeEventApi(eventId) {
  if (!eventId) throw new Error("Event ID is required");

  const endpoint = API_ENDPOINTS.EVENTS.LIKE.replace(":eventId", eventId);
  const guestId = getCookie("guest_id");

  const response = await axios.post(endpoint, {
    guest_id: guestId || undefined,
  });

  return response.data;
}
