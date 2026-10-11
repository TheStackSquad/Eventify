// frontend/src/app/settings/notifications/page.js

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/utils/hooks/useAuth";
import backendInstance from "@/axiosConfig/axios";
import toastAlert from "@/components/common/toast/toastAlert";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";

export default function NotificationSettings() {
  const { user } = useAuth();
  const [allowReminders, setAllowReminders] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current preference
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await backendInstance.get("/api/user/preferences");
        setAllowReminders(response.data.allowReminderEmails);
      } catch (error) {
        console.error("Failed to fetch preferences:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.id) fetchPreferences();
    else if (!user) setIsLoading(false); // Stop loading if no user session found
  }, [user]);

  // Update preference
  const handleToggle = async (checked) => {
    setIsSaving(true);
    try {
      await backendInstance.patch("/api/user/preferences", {
        allowReminderEmails: checked,
      });
      setAllowReminders(checked);
      toastAlert.success(
        checked ? "Reminder emails enabled" : "Reminder emails disabled",
      );
    } catch (error) {
      toastAlert.error("Failed to update preferences");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <LoadingSpinner
        message="Loading your settings..."
        subMessage="Getting your notification preferences ready"
        color="blue" // Matching the blue theme of the info box
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Show the spinner as an overlay if we're saving a change */}
      {isSaving && (
        <LoadingSpinner
          message="Saving changes..."
          subMessage="Updating your preferences"
          color="blue"
        />
      )}

      <h1 className="text-2xl font-bold mb-6">Email Notifications</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Subscription Reminders */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">
              Subscription Reminders
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Get notified 7, 3, and 1 day before your subscription expires.
              Payment confirmations are always sent.
            </p>
          </div>
          <input
            type="checkbox"
            className="w-11 h-6 bg-gray-200 rounded-full appearance-none checked:bg-blue-600 transition-colors relative cursor-pointer
             before:content-[''] before:absolute before:w-5 before:h-5 before:bg-white before:rounded-full before:top-0.5 before:left-0.5
             checked:before:translate-x-5 before:transition-transform disabled:opacity-50"
            checked={allowReminders}
            onChange={(e) => handleToggle(e.target.checked)}
            disabled={isSaving}
          />
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Payment receipts and important account
            notifications will always be sent regardless of this setting.
          </p>
        </div>
      </div>
    </div>
  );
}
