// frontend/src/services/authApi.js

import backendInstance, { ENDPOINTS } from "@/axiosConfig/axios";

/**
 * AUTH API FUNCTIONS
 * Raw API calls for authentication operations
 * These are consumed by React Query hooks
 */

// ====================================================================
// SIGNUP
// ====================================================================
export const signupApi = async (formData) => {
  // Remove confirmPassword before sending to backend
  const { confirmPassword, ...apiPayload } = formData;
  
  const response = await backendInstance.post(ENDPOINTS.AUTH.SIGNUP, apiPayload);
  return response.data;
};

// ====================================================================
// LOGIN
// ====================================================================
export const loginApi = async (credentials) => {
  const response = await backendInstance.post(
    ENDPOINTS.AUTH.LOGIN,
    credentials
  );
  return response.data;
};

// ====================================================================
// VERIFY SESSION
// ====================================================================
export const verifySessionApi = async () => {
  const response = await backendInstance.get(ENDPOINTS.AUTH.ME);
  return response.data.user;
};

// ====================================================================
// LOGOUT
// ====================================================================
export const logoutApi = async () => {
  const response = await backendInstance.post(ENDPOINTS.AUTH.LOGOUT);
  return response.data;
};

// ====================================================================
// PASSWORD RESET (Future use)
// ====================================================================
export const forgotPasswordApi = async (email) => {
  const response = await backendInstance.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, {
    email,
  });
  return response.data;
};

export const verifyResetTokenApi = async (token) => {
  const response = await backendInstance.get(
    ENDPOINTS.AUTH.VERIFY_RESET_TOKEN,
    {
      params: { token },
    }
  );
  return response.data;
};

export const resetPasswordApi = async (token, newPassword) => {
  const response = await backendInstance.post(ENDPOINTS.AUTH.RESET_PASSWORD, {
    token,
    newPassword,
  });
  return response.data;
};