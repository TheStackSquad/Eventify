// frontend/src/services/authAPI.js
import backendInstance from "@/axiosConfig/axios";
import { API_ENDPOINTS } from "@/utils/constants/globalConstants";

const IS_DEV = process.env.NODE_ENV === "development";

// Debug logging helper
const debugLog = (method, endpoint, data = {}) => {
  if (!IS_DEV) return;
  console.log(
    `🌐 [AuthAPI] ${method} ${endpoint}`,
    Object.keys(data).length ? data : "",
  );
};

// === SESSION VERIFICATION ===
export const verifySessionApi = async () => {
  debugLog("GET", API_ENDPOINTS.AUTH.VERIFY);

  try {
    const response = await backendInstance.get(API_ENDPOINTS.AUTH.VERIFY);

    debugLog("GET", API_ENDPOINTS.AUTH.VERIFY, {
      status: response.status,
      userId: response.data?.user?.id,
    });

    return response.data.user;
  } catch (error) {
    debugLog("GET", API_ENDPOINTS.AUTH.VERIFY, {
      error: error.response?.status || error.message,
      code: error.response?.data?.code,
    });
    throw error;
  }
};

// === LOGIN ===
export const loginApi = async (credentials) => {
  debugLog("POST", API_ENDPOINTS.AUTH.LOGIN, {
    email: credentials.email,
  });

  try {
    const response = await backendInstance.post(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials,
    );

    debugLog("POST", API_ENDPOINTS.AUTH.LOGIN, {
      status: response.status,
      userId: response.data?.user?.id,
    });

    return response.data;
  } catch (error) {
    debugLog("POST", API_ENDPOINTS.AUTH.LOGIN, {
      error: error.response?.status || error.message,
      code: error.response?.data?.code,
    });
    throw error;
  }
};

// === SIGNUP ===
export const signupApi = async (userData) => {
  debugLog("POST", API_ENDPOINTS.AUTH.SIGNUP, {
    email: userData.email,
  });

  try {
    const response = await backendInstance.post(
      API_ENDPOINTS.AUTH.SIGNUP,
      userData,
    );

    debugLog("POST", API_ENDPOINTS.AUTH.SIGNUP, {
      status: response.status,
      userId: response.data?.user?.id,
    });

    return response.data;
  } catch (error) {
    debugLog("POST", API_ENDPOINTS.AUTH.SIGNUP, {
      error: error.response?.status || error.message,
      code: error.response?.data?.code,
    });
    throw error;
  }
};

// === LOGOUT ===
export const logoutApi = async () => {
  debugLog("POST", API_ENDPOINTS.AUTH.LOGOUT);

  try {
    const response = await backendInstance.post(API_ENDPOINTS.AUTH.LOGOUT);

    debugLog("POST", API_ENDPOINTS.AUTH.LOGOUT, {
      status: response.status,
    });

    return response.data;
  } catch (error) {
    debugLog("POST", API_ENDPOINTS.AUTH.LOGOUT, {
      error: error.response?.status || error.message,
    });
    throw error;
  }
};

// === TOKEN REFRESH ===
export const refreshTokenApi = async () => {
  debugLog("POST", API_ENDPOINTS.AUTH.REFRESH);

  try {
    const response = await backendInstance.post(API_ENDPOINTS.AUTH.REFRESH);

    debugLog("POST", API_ENDPOINTS.AUTH.REFRESH, {
      status: response.status,
    });

    return response.data;
  } catch (error) {
    debugLog("POST", API_ENDPOINTS.AUTH.REFRESH, {
      error: error.response?.status || error.message,
      code: error.response?.data?.code,
    });
    throw error;
  }
};

// === PASSWORD RESET ===
export const forgotPasswordApi = async (email) => {
  debugLog("POST", API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });

  try {
    const response = await backendInstance.post(
      API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
      { email },
    );

    debugLog("POST", API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
      status: response.status,
    });

    return response.data;
  } catch (error) {
    debugLog("POST", API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
      error: error.response?.status || error.message,
    });
    throw error;
  }
};

export const verifyResetTokenApi = async (token) => {
  debugLog("POST", API_ENDPOINTS.AUTH.VERIFY_RESET_TOKEN);

  try {
    const response = await backendInstance.post(
      API_ENDPOINTS.AUTH.VERIFY_RESET_TOKEN,
      { token },
    );

    debugLog("POST", API_ENDPOINTS.AUTH.VERIFY_RESET_TOKEN, {
      status: response.status,
    });

    return response.data;
  } catch (error) {
    debugLog("POST", API_ENDPOINTS.AUTH.VERIFY_RESET_TOKEN, {
      error: error.response?.status || error.message,
    });
    throw error;
  }
};

export const resetPasswordApi = async (data) => {
  debugLog("POST", API_ENDPOINTS.AUTH.RESET_PASSWORD);

  try {
    const response = await backendInstance.post(
      API_ENDPOINTS.AUTH.RESET_PASSWORD,
      data,
    );

    debugLog("POST", API_ENDPOINTS.AUTH.RESET_PASSWORD, {
      status: response.status,
    });

    return response.data;
  } catch (error) {
    debugLog("POST", API_ENDPOINTS.AUTH.RESET_PASSWORD, {
      error: error.response?.status || error.message,
    });
    throw error;
  }
};
