//frontend/src/services/feedbackAPI.js

import axios, { ENDPOINTS } from "@/axiosConfig/axios";

// Define the base URL for the admin feedback API endpoints
const API_BASE_URL = ENDPOINTS.ADMIN_FEEDBACK;

/**
 * Fetches all feedback submissions from the backend (GET /api/admin/feedback).
 * @returns {Promise<Array>} A promise that resolves to a list of feedback objects.
 */
export async function fetchAllFeedback() {
  // This assumes the API response structure is { data: { feedbackList: [...] } }
  // Adjust based on your actual backend response structure.
  const response = await axios.get(API_BASE_URL);
  return response.data.feedbackList || response.data;
}

/**
 * Deletes a specific feedback submission (DELETE /api/admin/feedback/:feedbackId).
 * @param {string} feedbackId - The ID of the feedback to delete.
 * @returns {Promise<Object>} A promise that resolves to the success response data.
 */
export async function deleteFeedback(feedbackId) {
  const response = await axios.delete(`${API_BASE_URL}/${feedbackId}`);
  return response.data;
}