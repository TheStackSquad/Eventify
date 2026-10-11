// frontend/src/services/userPreferencesApi.js

import backendInstance from "@/axiosConfig/axios";

/**
 * Fetch user email preferences
 * @returns {Promise<{allowReminderEmails: boolean}>}
 */
export async function fetchUserPreferences() {
  const response = await backendInstance.get("/api/user/preferences");
  return response.data;
}

/**
 * Update user email preferences
 * @param {boolean} allowReminderEmails
 * @returns {Promise<{message: string, allowReminderEmails: boolean}>}
 */
export async function updateUserPreferences(allowReminderEmails) {
  const response = await backendInstance.patch("/api/user/preferences", {
    allowReminderEmails,
  });
  return response.data;
}
