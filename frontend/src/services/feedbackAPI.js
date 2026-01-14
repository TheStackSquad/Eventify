// frontend/src/services/feedbackAPI.js
import backendInstance from "@/axiosConfig/axios";

const FEEDBACK_URL = "/api/v1/feedback";

export async function createFeedbackAPI(feedbackData) {
  const payload = {
    name: feedbackData.name,
    email: feedbackData.email,
    type: feedbackData.type,
    message: feedbackData.message,
    imageUrl: feedbackData.imageUrl || "",
  };
  const response = await backendInstance.post(FEEDBACK_URL, payload);
  return response.data;
}

export async function fetchAllFeedback() {
  const response = await backendInstance.get("/api/v1/admin/feedback");
  return response.data?.data || response.data;
}

export async function deleteFeedback(feedbackId) {
  const response = await backendInstance.delete(
    `/api/v1/admin/feedback/${feedbackId}`
  );
  return response.data;
}
