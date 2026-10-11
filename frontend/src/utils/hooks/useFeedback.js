//frontend/src/utils/hooks/useFeedback.js

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAllFeedback, deleteFeedback } from "@/services/feedbackAPI";
import toastAlert from "@/components/common/toast/toastAlert";
import globalConstants from "@/utils/constants/globalConstants";

const { SUCCESS_MESSAGES, ERROR_MESSAGES } = globalConstants;

// Define a unique query key for the feedback list
const FEEDBACK_QUERY_KEY = ["feedbackList"];

/**
 * Hook to fetch all feedback submissions.
 * Automatically handles loading, error, and caching.
 * @returns {Object} Query result object (data, isLoading, isError, etc.).
 */
export const useFetchFeedback = () => {
  return useQuery({
    queryKey: FEEDBACK_QUERY_KEY,
    queryFn: fetchAllFeedback,
    // Optional: Configure caching settings
    staleTime: 5 * 60 * 1000, // Data is considered fresh for 5 minutes
  });
};

/**
 * Hook to delete a feedback submission.
 * Automatically refetches the list on success and shows toast alerts.
 * @returns {Object} Mutation result object (mutate, isPending, status, etc.).
 */
export const useDeleteFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFeedback,
    onSuccess: () => {
      // Invalidate the feedback list query to trigger an automatic background refetch
      queryClient.invalidateQueries({ queryKey: FEEDBACK_QUERY_KEY });
      toastAlert.success(
        SUCCESS_MESSAGES.FEEDBACK_DELETED || "Feedback deleted successfully."
      );
    },
    onError: (error) => {
      // Extract a specific error message if available
      const message =
        error.response?.data?.message || ERROR_MESSAGES.FEEDBACK_DELETE_FAILED;
      toastAlert.error(message);
    },
  });
};