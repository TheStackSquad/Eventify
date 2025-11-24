// frontend/src/redux/action/eventAction.js

import { createAsyncThunk } from "@reduxjs/toolkit";
import axios from "@/axiosConfig/axios";
import toastAlert from "@/components/common/toast/toastAlert";
import {
  REDUX_ACTION_TYPES,
  API_ENDPOINTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "@/utils/constants/globalConstants";

// Helper function to check for and handle the AbortError
// NOTE: This function simply returns the rejectWithValue object.
const handleAbortError = (error, rejectWithValue) => {
  if (axios.isCancel(error) || error.name === "AbortError") {
    // Return a message that we can ignore in the component if needed
    return rejectWithValue({ message: "Request aborted", isAborted: true });
  }
  return null; // Must return null or undefined if no abort error occurred
};

// --- CORE ASYNC THUNKS ---

export const createEvent = createAsyncThunk(
  REDUX_ACTION_TYPES.CREATE_EVENT,
  // Destructure eventData and signal from the payload
  async ({ eventData, signal }, { rejectWithValue }) => {
    console.log("Data IN redux:", eventData);
    try {
      const response = await axios.post(
        API_ENDPOINTS.EVENTS.CREATE,
        eventData,
        { signal }
      );
      toastAlert.success(SUCCESS_MESSAGES.EVENT_CREATED);
      return response.data;
    } catch (error) {
      // 1. Check for Abort and return immediately if found
      const abortResult = handleAbortError(error, rejectWithValue);
      if (abortResult) {
        return abortResult;
      }

      // 2. Handle API/network error
      const message =
        error.response?.data?.message || ERROR_MESSAGES.CREATE_EVENT_FAILED;
      toastAlert("error", message);
      return rejectWithValue({ message });
    }
  }
);

export const fetchUserEvents = createAsyncThunk(
  REDUX_ACTION_TYPES.FETCH_USER_EVENTS,
  // Accept signal directly since there was no original argument
  async (signal, { rejectWithValue }) => {
    try {
      const response = await axios.get(API_ENDPOINTS.EVENTS.MY_EVENTS, {
        signal,
      });
      return response.data;
    } catch (error) {
      // 1. Check for Abort and return immediately if found
      const abortResult = handleAbortError(error, rejectWithValue);
      if (abortResult) {
        return abortResult;
      }

      // 2. Handle API/network error
      const message =
        error.response?.data?.message || ERROR_MESSAGES.FETCH_EVENTS_FAILED;
      // Note: No toastAlert here for non-critical listing fetches, as per original logic.
      return rejectWithValue({ message });
    }
  }
);

// NEW: Fetch ALL events (for public event listing page)
export const fetchAllEvents = createAsyncThunk(
  REDUX_ACTION_TYPES.FETCH_ALL_EVENTS,
  // Accept signal directly since there was no original argument
  async (signal, { rejectWithValue }) => {
    try {
      const response = await axios.get(API_ENDPOINTS.EVENTS.BASE, { signal });
      return response.data;
    } catch (error) {
      // 1. Check for Abort and return immediately if found
      const abortResult = handleAbortError(error, rejectWithValue);
      if (abortResult) {
        return abortResult;
      }

      // 2. Handle API/network error
      const message =
        error.response?.data?.message || ERROR_MESSAGES.FETCH_EVENTS_FAILED;
      // Note: No toastAlert here for non-critical listing fetches, as per original logic.
      return rejectWithValue({ message });
    }
  }
);

export const fetchEventAnalytics = createAsyncThunk(
  REDUX_ACTION_TYPES.FETCH_EVENT_ANALYTICS,
  async ({ eventId, signal }, { rejectWithValue }) => {
    // 💡 LOG 1: Log the start of the thunk and the input payload
    console.log("--- fetchEventAnalytics START ---");
    console.log("Payload received:", {
      eventId,
      signal: signal ? "AbortSignal present" : "No AbortSignal",
    });

    try {
      // ✅ FIX 1: Use :eventId instead of :id
      const endpoint = API_ENDPOINTS.EVENTS.ANALYTICS.replace(
        ":eventId",
        eventId
      );

      // 💡 LOG 2: Log the constructed endpoint before the API call
      console.log("API Endpoint:", endpoint);

      const response = await axios.get(endpoint, { signal });

      // 💡 LOG 3: Log the successful response status and part of the data
      console.log("API Response Status:", response.status);
      console.log(
        "Data received (partial view):",
        response.data.data
          ? {
              keys: Object.keys(response.data.data),
              count: Array.isArray(response.data.data)
                ? response.data.data.length
                : "N/A",
            }
          : "No data.data field"
      );

      // 💡 LOG 4: Log the successful return
      console.log("--- fetchEventAnalytics SUCCESS END ---");

      return response.data.data;
    } catch (error) {
      // 💡 LOG 5: Log any error caught in the try/catch block
      console.error("fetchEventAnalytics ERROR caught:", error);

      // Check for Abort and return immediately if found
      const abortResult = handleAbortError(error, rejectWithValue);
      if (abortResult) {
        // 💡 LOG 6: Log if the request was aborted
        console.log("Request aborted successfully.");
        return abortResult;
      }

      // Handle API/network error
      const message =
        error.response?.data?.message || ERROR_MESSAGES.FETCH_ANALYTICS_FAILED;

      // 💡 LOG 7: Log the error message being rejected
      console.log("--- fetchEventAnalytics FAILURE END (Rejecting) ---");
      console.error("Rejection Message:", message);

      return rejectWithValue({ message });
    }
  }
);

export const getEventById = createAsyncThunk(
  REDUX_ACTION_TYPES.GET_EVENT_BY_ID,
  // Destructure eventId and signal from the payload
  async ({ eventId, signal }, { rejectWithValue }) => {
    try {
      const endpoint = API_ENDPOINTS.EVENTS.GET_BY_ID.replace(
        ":eventId",
        eventId
      );
      console.log("🔍 Fetching event from:", endpoint);

      const response = await axios.get(endpoint, { signal });
      return response.data;
    } catch (error) {
      // 1. Check for Abort and return immediately if found
      const abortResult = handleAbortError(error, rejectWithValue);
      if (abortResult) {
        return abortResult;
      }

      // 2. Handle API/network error
      const message =
        error.response?.data?.message || ERROR_MESSAGES.FETCH_EVENT_FAILED;
      toastAlert("error", message);
      return rejectWithValue({ message });
    }
  }
);

export const updateEvent = createAsyncThunk(
  REDUX_ACTION_TYPES.UPDATE_EVENT,
  // Destructure eventId, updates, and signal from the payload
  async ({ eventId, updates, signal }, { rejectWithValue }) => {
    try {
      const endpoint = API_ENDPOINTS.EVENTS.UPDATE.replace(":id", eventId);
      const response = await axios.put(endpoint, updates, { signal });
      toastAlert.success(SUCCESS_MESSAGES.EVENT_UPDATED);
      return response.data;
    } catch (error) {
      // 1. Check for Abort and return immediately if found
      const abortResult = handleAbortError(error, rejectWithValue);
      if (abortResult) {
        return abortResult;
      }

      // 2. Handle API/network error
      const message =
        error.response?.data?.message || ERROR_MESSAGES.UPDATE_EVENT_FAILED;
      toastAlert("error", message);
      return rejectWithValue({ message });
    }
  }
);

export const deleteEvent = createAsyncThunk(
  REDUX_ACTION_TYPES.DELETE_EVENT,
  // Destructure eventId and signal from the payload
  async ({ eventId, signal }, { rejectWithValue }) => {
    try {
      const endpoint = API_ENDPOINTS.EVENTS.DELETE.replace(":id", eventId);
      await axios.delete(endpoint, { signal });
      toastAlert.success(SUCCESS_MESSAGES.EVENT_DELETED);
      return { eventId };
    } catch (error) {
      // 1. Check for Abort and return immediately if found
      const abortResult = handleAbortError(error, rejectWithValue);
      if (abortResult) {
        return abortResult;
      }

      // 2. Handle API/network error
      const message =
        error.response?.data?.message || ERROR_MESSAGES.DELETE_EVENT_FAILED;
      toastAlert("error", message);
      return rejectWithValue({ message });
    }
  }
);

export const publishEvent = createAsyncThunk(
  REDUX_ACTION_TYPES.PUBLISH_EVENT,
  // Destructure eventId, isPublished, and signal from the payload
  async ({ eventId, isPublished, signal }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `/events/${eventId}/publish`,
        { isPublished },
        { signal }
      );

      // Using toastAlert directly as per original logic, though toastAlert.success
      // might be cleaner, this preserves original intent.
      toastAlert(
        "success",
        isPublished ? "Event published! 🚀" : "Event unpublished"
      );

      return response.data;
    } catch (error) {
      // 1. Check for Abort and return immediately if found
      const abortResult = handleAbortError(error, rejectWithValue);
      if (abortResult) {
        return abortResult;
      }

      // 2. Handle API/network error
      const message =
        error.response?.data?.message || "Failed to update event status";
      toastAlert("error", message);
      return rejectWithValue({ message });
    }
  }
);
