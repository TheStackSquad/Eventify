// frontend/src/redux/action/actionAuth.js

import { createAsyncThunk, createAction } from "@reduxjs/toolkit";
import axios from "@/axiosConfig/axios";
//import toastAlert from "@/components/common/toast/toastAlert";
import {
  REDUX_ACTION_TYPES,
  API_ENDPOINTS,
} from "@/utils/constants/globalConstants";

export const signupUser = createAsyncThunk(
  // Use the constant for the action type
  REDUX_ACTION_TYPES.SIGNUP,
  async (formData, { rejectWithValue }) => {
    // LOG A: Trace the data received from the component
    console.log("LOG A: signupUser Thunk received formData:", formData);

    const { confirmPassword, ...apiPayload } = formData;

    try {
      // LOG B: Trace the API endpoint and method and the *cleaned* data
      console.log(
        "LOG B: Attempting POST request to",
        API_ENDPOINTS.AUTH.SIGNUP, // 👈 Use the constant
        "with CLEANED data:",
        apiPayload
      );

      // API call to the Go backend, handles CORS/cookies via axiosConfig
      const response = await axios.post(
        API_ENDPOINTS.AUTH.SIGNUP, // 👈 Use the constant
        apiPayload
      );

      // ... (Rest of signupUser thunk remains the same)

      return response.data;
    } catch (error) {
      // 🎯 FIX: Correctly extract and return the server error message
      // 1. Check for API Response (400, 409, etc.)
      if (error.response) {
        return rejectWithValue(error.response.data);
      }
      if (error.request) {
        return rejectWithValue({
          // The exact message the test expects
          message: "Network error. Please check your connection.",
        });
      }
      // Handle network errors (when no response object exists
      return rejectWithValue({
        message: "An unexpected error occurred.",
      });
    }
  }
);


// signinUser with error handling
export const signinUser = createAsyncThunk(
  // Use the constant for the action type
  REDUX_ACTION_TYPES.SIGNIN,
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        API_ENDPOINTS.AUTH.SIGNIN, // 👈 Use the constant
        formData
      );

      // 🔑 LOG ADDED: Log the successful response details
      // The token itself is in the secure HTTP-only cookie, not directly in response.data.
      console.log("--- Signin Success Response ---");
      console.log("Status:", response.status); // Should be 200
      console.log("Message:", response.data.message);
      console.log("User Data:", response.data.user);
      // You can check for the Set-Cookie header in your browser's Network tab.
      console.log("Response Headers (Check for Set-Cookie):", response.headers);
      console.log("-----------------------------");

      return {
        user: response.data.user,
        message: response.data.message,
      };
    } catch (error) {
      // This logic ensures the test receives a payload for rejected actions
      if (error.response) {
        // Log the error response as well
        console.error("Signin Failed:", error.response.data?.message);
        return rejectWithValue({
          message: error.response.data?.message,
          code: error.response.status,
        });
      }
      // Fallback for network errors
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
  async (_, { rejectWithValue, dispatch }) => {
    console.log("🟣 [VERIFY SESSION] Starting...");

    try {
      console.log("🟣 [VERIFY SESSION] Calling:", API_ENDPOINTS.AUTH.ME);
      const response = await axios.get(API_ENDPOINTS.AUTH.ME);

      const user = response.data.user;
      const isAuthenticated = !!user;

      console.log("✅ [VERIFY SESSION] Success:", {
        status: response.status,
        userId: response.data.user?.id,
        userEmail: response.data.user?.email,
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
      console.error("❌ [VERIFY SESSION] Failed:", {
        status: error.response?.status,
        message: error.message,
        hasResponse: !!error.response,
        hasRequest: !!error.request,
      });

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
  // Use the constant for the action type
  REDUX_ACTION_TYPES.LOGOUT,
  async (_, { rejectWithValue }) => {
    try {
      await axios.post(
        API_ENDPOINTS.AUTH.LOGOUT // 👈 Use the constant
      );
      // ... (Rest of logoutUser thunk remains the same)
      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // ... (Error handling remains the same)
      return rejectWithValue({
        message: error.response?.data?.message || "Logout failed.",
        clearState: true,
      });
    }
  }
);


// Helper action to clear sensitive data
export const clearStaleAuthData = createAction('CLEAR_STALE_AUTH_DATA');