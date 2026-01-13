// frontend/src/services/feedbackAPI.js
import axios from "@/axiosConfig/axios";

const FEEDBACK_URL = "/api/v1/feedback"; // Backend endpoint

export async function createFeedbackAPI(feedbackData) {
  // Backend expects: { name, email, type, message, imageUrl }
  const payload = {
    name: feedbackData.name,
    email: feedbackData.email,
    type: feedbackData.type,
    message: feedbackData.message,
    imageUrl: feedbackData.imageUrl || "", // Empty string if no image
  };

  console.log("[createFeedbackAPI] Sending to backend:", {
    endpoint: FEEDBACK_URL,
    payload: payload,
  });

  const response = await axios.post(FEEDBACK_URL, payload);
  return response.data;
}

// Optional: Admin endpoints
export async function fetchAllFeedback() {
  const response = await axios.get("/api/v1/admin/feedback"); // Adjust if different
  return response.data?.data || response.data;
}

export async function deleteFeedback(feedbackId) {
  const response = await axios.delete(`/api/v1/admin/feedback/${feedbackId}`);
  return response.data;
}
