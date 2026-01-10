// frontend/src/redux/action/actionAuth.js

import { createAsyncThunk, createAction } from "@reduxjs/toolkit";
import axios from "@/axiosConfig/axios";
import { resetEventsState } from "@/redux/reducer/eventReducer";
import {
  REDUX_ACTION_TYPES,
  API_ENDPOINTS,
} from "@/utils/constants/globalConstants";

// ====================================================================
// ABORT HELPER
// ====================================================================

/**
 * Checks for and handles AbortError (native or Axios cancellation).
 * Returns a specific rejected value to be ignored by consuming logic.
 */
const handleAbortError = (error, rejectWithValue) => {
  if (axios.isCancel(error) || error.name === "AbortError") {
    console.log("🛑 Request aborted by AbortController.");
    // Return a specific object so the component/reducer can ignore it
    return rejectWithValue({ message: "Request aborted", isAborted: true });
  }
  return null;
};

// ====================================================================
// THUNKS
// ====================================================================

// signupUser with error handling
export const signupUser = createAsyncThunk(
  REDUX_ACTION_TYPES.SIGNUP,
  // 💡 Accept 'signal' from the payload
  async ({ formData, signal }, { rejectWithValue, dispatch }) => {
    console.log("LOG A: signupUser Thunk received formData:", formData);

    const { confirmPassword, ...apiPayload } = formData;

    try {
      // CRITICAL: Clear any stale events data BEFORE signup completes
      console.log("🔄 [AUTH] Clearing stale events data before signup");
      dispatch(resetEventsState());

      console.log(
        "LOG B: Attempting POST request to",
        API_ENDPOINTS.AUTH.SIGNUP
      );

      const response = await axios.post(
        API_ENDPOINTS.AUTH.SIGNUP,
        apiPayload,
        { signal } // 🔑 Pass the signal to Axios
      );

      return response.data;
    } catch (error) {
      // 1. Check for Abort and return immediately if found
      const abortResult = handleAbortError(error, rejectWithValue);
      if (abortResult) {
        return abortResult;
      }

      // 2. Handle API Response (400, 409, etc.)
      if (error.response) {
        return rejectWithValue(error.response.data);
      }
      if (error.request) {
        return rejectWithValue({
          message: "Network error. Please check your connection.",
        });
      }
      // 3. Handle unexpected errors
      return rejectWithValue({
        message: "An unexpected error occurred.",
      });
    }
  }
);

// signinUser with error handling
export const signinUser = createAsyncThunk(
  REDUX_ACTION_TYPES.SIGNIN,
  // 💡 Accept 'signal' from the payload
  async ({ formData, signal }, { rejectWithValue, dispatch }) => {
    try {
      // CRITICAL: Clear any stale events data BEFORE login completes
      console.log("🔄 [AUTH] Clearing stale events data before signin");
      dispatch(resetEventsState());

      const response = await axios.post(
        API_ENDPOINTS.AUTH.SIGNIN,
        formData,
        { signal } // 🔑 Pass the signal to Axios
      );

      console.log("--- Signin Success Response ---");
      console.log("Status:", response.status);

      return {
        user: response.data.user,
        message: response.data.message,
      };
    } catch (error) {
      // 1. Check for Abort and return immediately if found
      const abortResult = handleAbortError(error, rejectWithValue);
      if (abortResult) {
        return abortResult;
      }

      // 2. Handle non-abort errors
      if (error.response) {
        console.error("Signin Failed:", error.response.data?.message);
        return rejectWithValue({
          message: error.response.data?.message,
          code: error.response.status,
        });
      }
      console.error("Signin Network Error:", error.message);
      return rejectWithValue({
        message: "Network error during signin.",
        code: undefined,
      });
    }
  }
);

export const verifySession = createAsyncThunk(
  REDUX_ACTION_TYPES.VERIFY_SESSION,
  // 💡 Accept 'signal' directly (if no other payload is needed)
  async (signal, { rejectWithValue, dispatch }) => {
    console.log("🟣 [VERIFY SESSION] Starting...");

    try {
      console.log("🟣 [VERIFY SESSION] Calling:", API_ENDPOINTS.AUTH.ME);
      const response = await axios.get(API_ENDPOINTS.AUTH.ME, {
        signal, // 🔑 Pass the signal to Axios
      });

      const user = response.data.user;
      const isAuthenticated = !!user;

      console.log("✅ [VERIFY SESSION] Success:", {
        status: response.status,
        userId: response.data.user?.id,
      });

      return {
        user: {
          id: user?.id,
          name: user?.name,
          email: user?.email,
          is_admin: user?.is_admin,
        },
        sessionChecked: true,
        isAuthenticated: isAuthenticated,
      };
    } catch (error) {
      // 1. Check for Abort and return immediately if found
      const abortResult = handleAbortError(error, rejectWithValue);
      if (abortResult) {
        // Do NOT proceed with dispatch/reject for aborts
        return abortResult;
      }

      // 2. Handle non-abort errors
      console.error("❌ [VERIFY SESSION] Failed:", {
        status: error.response?.status,
        message: error.message,
      });

      // Clear state only for actual session failure, not for aborts
      dispatch(clearStaleAuthData());

      return rejectWithValue({
        message: "Session verification failed",
        status: error.response?.status,
        silent: true,
        isAuthError: error.response?.status === 401,
      });
    }
  }
);

// logoutUser with state cleanup
export const logoutUser = createAsyncThunk(
  REDUX_ACTION_TYPES.LOGOUT,
  // 💡 Accept 'signal' directly
  async (signal, { rejectWithValue, dispatch }) => {
    try {
      // 🔑 Pass the signal to Axios. Note: POST bodies are usually null for logout.
      await axios.post(API_ENDPOINTS.AUTH.LOGOUT, null, { signal });

      // CRITICAL: Clear events data on logout
      console.log("🔄 [AUTH] Clearing events data on logout");
      dispatch(resetEventsState());

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // 1. Check for Abort and return immediately if found
      const abortResult = handleAbortError(error, rejectWithValue);
      if (abortResult) {
        return abortResult;
      }

      // 2. Handle non-abort errors: Even if logout fails, clear data for safety
      console.log("🔄 [AUTH] Clearing events data despite logout error");
      dispatch(resetEventsState());

      return rejectWithValue({
        message: error.response?.data?.message || "Logout failed.",
        clearState: true,
      });
    }
  }
);

// Helper action to clear sensitive data
export const clearStaleAuthData = createAction("CLEAR_STALE_AUTH_DATA");
