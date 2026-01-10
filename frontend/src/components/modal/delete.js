// frontend/src/components/modal/delete.js
"use client";

import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query"; // 🆕 TanStack Query imports
import { useAuth } from "@/utils/hooks/useAuth"; // 🆕 Import useAuth to get user ID for invalidation
import axiosInstance from "@/axiosConfig/axios"; // Assuming axiosInstance is available

// ❌ Removed: useDispatch, deleteEvent Redux action

/**
 * Placeholder API call function for event deletion.
 * In a real scenario, this would be imported from a centralized API file.
 * @param {string} eventId - The ID of the event to delete.
 * @returns {Promise<void>}
 */
const deleteEventApi = async (eventId) => {
  // Assuming the API endpoint for soft deletion (cancel) is DELETE /api/events/{eventId}
  const response = await axiosInstance.delete(`/api/events/${eventId}`);
  // We don't necessarily care about the response data, just the success status (200/204)
  if (response.status !== 200 && response.status !== 204) {
    throw new Error("Failed to delete event.");
  }
};

export default function DeleteModal({ isOpen, onClose, eventId, eventTitle }) {
  const queryClient = useQueryClient();
  const { user } = useAuth(); // Get the current user for the query key

  // ============================================================================
  // MUTATION HOOK
  // ============================================================================

  const deleteMutation = useMutation({
    mutationFn: deleteEventApi,
    // When the mutation succeeds, invalidate the list of user events
    // to force the DashboardPage to refetch the updated list.
    onSuccess: () => {
      // The key structure matches how useUserEvents is defined: ["events", "user", userId]
      queryClient.invalidateQueries({ queryKey: ["events", "user", user?.id] });
      // Close the modal after successful deletion
      onClose();
    },
    onError: (error) => {
      console.error("❌ Event deletion failed:", error);
      // Optional: Handle error display (e.g., using a toast notification)
    },
  });

  const { isPending, isError, error } = deleteMutation;

  const handleDeleteConfirm = useCallback(() => {
    if (eventId && !isPending) {
      // 🆕 Call the mutation's mutate function with the eventId as the variable
      deleteMutation.mutate(eventId);
      // Note: We no longer call onClose() here. It's called in onSuccess.
    }
  }, [eventId, isPending, deleteMutation]);

  if (!isOpen) return null;

  // Simple modal backdrop and content animation
  const backdropVariants = {
    visible: { opacity: 1 },
    hidden: { opacity: 0 },
  };

  const modalVariants = {
    visible: { y: 0, opacity: 1, scale: 1, transition: { duration: 0.3 } },
    hidden: { y: "100vh", opacity: 0, scale: 0.8 },
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={backdropVariants}
      onClick={onClose} // Close on backdrop click
    >
      <motion.div
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
        variants={modalVariants}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
      >
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-500 mr-3" />
            <h3 className="text-xl font-bold text-gray-900">
              Confirm Deletion
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isPending}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Display Error Message if mutation failed */}
        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm">
            Deletion failed: {error?.message || "Please try again."}
          </div>
        )}

        <div className="text-gray-700 mb-6">
          <p className="mb-4">
            Are you sure you want to ***cancel*** this event?
            <br />
            <strong className="text-red-600 text-lg">
              &quot;{eventTitle}&quot;
            </strong>
          </p>
          <p className="text-sm text-gray-500">
            This event will be removed from public view and your dashboard.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-md disabled:bg-red-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Yes, Soft Delete Event"
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}