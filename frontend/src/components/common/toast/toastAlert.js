// frontend/src/components/common/toast/toastAlert.js
import { toast } from "react-toastify";
import { parseError } from "@/utils/constants/errorMessages";

/**
 * Enhanced toast that automatically parses technical errors
 * into user-friendly messages while maintaining backward compatibility
 */
const toastAlert = {
  success: (message) => {
    toast.success(message);
  },

  error: (message) => {
    // If message is an Error object or has error properties, parse it
    if (message instanceof Error || message?.response || message?.message) {
      const parsedError = parseError(message);

      // Show user-friendly message with optional icon
      const displayMessage = parsedError.icon
        ? `${parsedError.icon} ${parsedError.message}`
        : parsedError.message;

      toast.error(displayMessage, {
        // Add additional context if available
        autoClose: parsedError.severity === "error" ? 5000 : 4000,
      });

      // Log original error in development for debugging
      if (process.env.NODE_ENV === "development" && parsedError.originalError) {
        console.error("Original error:", parsedError.originalError);
        console.log("Error details:", parsedError);
      }
    } else {
      // Handle plain string messages (backward compatible)
      toast.error(message);
    }
  },

  warn: (message) => {
    // Optional: Add parsing for warnings too
    if (message instanceof Error || message?.response || message?.message) {
      const parsedError = parseError(message);
      const displayMessage = parsedError.icon
        ? `${parsedError.icon} ${parsedError.message}`
        : parsedError.message;
      toast.warn(displayMessage);
    } else {
      toast.warn(message);
    }
  },

  info: (message) => {
    toast.info(message);
  },
};

export default toastAlert;
