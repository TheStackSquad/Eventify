// frontend/src/hooks/useEmailPreferences.js

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchUserPreferences,
  updateUserPreferences,
} from "@/services/userPreferencesApi";
import toastAlert from "@/components/common/toast/toastAlert";

export function useEmailPreferences(userId) {
  const [allowReminders, setAllowReminders] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch preferences on mount
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        const data = await fetchUserPreferences();
        setAllowReminders(data.allowReminderEmails ?? true);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch email preferences:", err);
        setError(err);
        // Don't show error toast on initial load - fail silently
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [userId]);

  // Update preferences
  const updatePreference = useCallback(async (newValue) => {
    try {
      const response = await updateUserPreferences(newValue);
      setAllowReminders(response.allowReminderEmails);

      toastAlert.success(
        newValue
          ? "Reminder emails enabled successfully"
          : "Reminder emails disabled successfully",
      );

      return true;
    } catch (err) {
      console.error("Failed to update email preferences:", err);

      const message =
        err.response?.data?.message ||
        "Failed to update preferences. Please try again.";
      toastAlert.error(message);

      return false;
    }
  }, []);

  return {
    allowReminders,
    isLoading,
    error,
    updatePreference,
  };
}
