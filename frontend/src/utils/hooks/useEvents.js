// frontend/src/utils/hooks/useEvents.js

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createEventApi,
  fetchUserEventsApi,
  fetchAllEventsApi,
  fetchEventByIdApi,
  fetchEventAnalyticsApi,
  updateEventApi,
  deleteEventApi,
  publishEventApi,
  likeEventApi,
} from "@/services/eventsApi";
import toastAlert from "@/components/common/toast/toastAlert";
import {
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
} from "@/utils/constants/globalConstants";

// ====================================================================
// QUERY KEYS
// ====================================================================
export const eventKeys = {
  all: ["events"],
  user: (userId) => ["events", "user", userId],
  list: ["events", "list"],
  detail: (id) => ["events", "detail", id],
  analytics: (id) => ["events", "analytics", id],
};

// ====================================================================
// QUERY HOOKS (READ OPERATIONS)
// ====================================================================

export function useAllEvents() {
  return useQuery({
    queryKey: eventKeys.list,
    queryFn: fetchAllEventsApi,
    staleTime: 1000 * 60 * 5,
    onError: (error) => {
      console.error("❌ [QUERY] Failed to fetch all events:", error.message);
    },
  });
}

export function useUserEvents(userId, isEnabled = true) {
  return useQuery({
    queryKey: eventKeys.user(userId),
    queryFn: fetchUserEventsApi,
    enabled: isEnabled && !!userId,
    staleTime: 1000 * 60 * 5,
    onError: (error) => {
      console.error("❌ [QUERY] Failed to fetch user events:", error.message);
    },
  });
}

export function useEvent(eventId) {
  return useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: () => fetchEventByIdApi(eventId),
    enabled: !!eventId,
    staleTime: 1000 * 60 * 60,
    onError: (error) => {
      console.error(
        `❌ [QUERY] Failed to fetch event ${eventId}:`,
        error.message
      );
    },
  });
}

export function useEventAnalytics(eventId, isEnabled = true) {
  return useQuery({
    queryKey: eventKeys.analytics(eventId),
    queryFn: () => fetchEventAnalyticsApi(eventId),
    enabled: isEnabled && !!eventId,
    staleTime: 1000 * 60 * 1,
    onError: (error) => {
      console.error(
        `❌ [QUERY] Failed to fetch analytics for ${eventId}:`,
        error.message
      );
    },
  });
}

// ====================================================================
// MUTATION HOOKS (WRITE OPERATIONS)
// ====================================================================

export function useCreateEvent(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEventApi,
    onSuccess: (data) => {
      toastAlert.success(SUCCESS_MESSAGES.EVENT_CREATED);

      queryClient.setQueryData(eventKeys.user(userId), (oldData) => {
        const newData = Array.isArray(oldData) ? oldData : [];
        return [data.event, ...newData];
      });

      queryClient.invalidateQueries({ queryKey: eventKeys.list });
    },
    onError: (error) => {
      const message =
        error.response?.data?.message || ERROR_MESSAGES.CREATE_EVENT_FAILED;
      toastAlert.error(message);
      console.error("❌ [MUTATION] Create event failed:", {
        message,
        response: error.response?.data,
        status: error.response?.status,
      });
    },
  });
}

export function useUpdateEvent(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEventApi,
    onSuccess: (data, variables) => {
      toastAlert.success(SUCCESS_MESSAGES.EVENT_UPDATED);

      const updatedEvent = data.event;
      const eventId = variables.eventId;

      queryClient.invalidateQueries({ queryKey: eventKeys.user(userId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.list });
      queryClient.setQueryData(eventKeys.detail(eventId), updatedEvent);
    },
    onError: (error) => {
      const message =
        error.response?.data?.message || ERROR_MESSAGES.UPDATE_EVENT_FAILED;
      toastAlert.error(message);
      console.error("❌ [MUTATION] Update event failed:", {
        message,
        response: error.response?.data,
        status: error.response?.status,
      });
    },
  });
}

export function useDeleteEvent(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEventApi,
    onSuccess: (data) => {
      toastAlert.success(SUCCESS_MESSAGES.EVENT_DELETED);
      const deletedEventId = data.eventId;

      queryClient.setQueryData(eventKeys.user(userId), (oldData) => {
        return (oldData || []).filter((event) => event.id !== deletedEventId);
      });

      queryClient.invalidateQueries({ queryKey: eventKeys.list });
      queryClient.removeQueries({ queryKey: eventKeys.detail(deletedEventId) });
      queryClient.removeQueries({
        queryKey: eventKeys.analytics(deletedEventId),
      });
    },
    onError: (error) => {
      const message =
        error.response?.data?.message || ERROR_MESSAGES.DELETE_EVENT_FAILED;
      toastAlert.error(message);
      console.error("❌ [MUTATION] Delete event failed:", {
        message,
        response: error.response?.data,
        status: error.response?.status,
      });
    },
  });
}

export function usePublishEvent(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: publishEventApi,
    onSuccess: (data) => {
      const isPublished = data.event?.isPublished;
      const message = isPublished ? "Event published! 🚀" : "Event unpublished";

      toastAlert.success(message);

      const eventId = data.event.id;

      queryClient.invalidateQueries({ queryKey: eventKeys.user(userId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.list });
      queryClient.setQueryData(eventKeys.detail(eventId), data.event);
    },
    onError: (error) => {
      const message =
        error.response?.data?.message || "Failed to update event status";
      toastAlert.error(message);
      console.error("❌ [MUTATION] Publish/Unpublish failed:", {
        message,
        response: error.response?.data,
        status: error.response?.status,
      });
    },
  });
}

export function useLikeEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: likeEventApi,

    onMutate: async (eventId) => {
      // 1. Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: eventKeys.detail(eventId) });
      await queryClient.cancelQueries({ queryKey: eventKeys.list });

      // 2. Snapshot current state
      const previousEventDetail = queryClient.getQueryData(
        eventKeys.detail(eventId)
      );
      const previousEventList = queryClient.getQueryData(eventKeys.list);

      // 3. Optimistically update DETAIL
      if (previousEventDetail) {
        queryClient.setQueryData(eventKeys.detail(eventId), (old) => {
          const wasLiked = old.isLiked ?? false;           // ✅ Changed field name
          const currentCount = old.likesCount ?? 0;        // ✅ Changed field name
          
          return {
            ...old,
            isLiked: !wasLiked,                            // ✅ Changed field name
            likesCount: currentCount + (wasLiked ? -1 : 1), // ✅ Changed field name
          };
        });
      }

      // 4. Optimistically update LIST
      if (previousEventList) {
        queryClient.setQueryData(eventKeys.list, (oldList) => {
          return oldList?.map((event) => {
            if (event.id === eventId) {
              const wasLiked = event.isLiked ?? false;     // ✅ Changed field name
              const currentCount = event.likesCount ?? 0;  // ✅ Changed field name
              
              return {
                ...event,
                isLiked: !wasLiked,                        // ✅ Changed field name
                likesCount: currentCount + (wasLiked ? -1 : 1), // ✅ Changed field name
              };
            }
            return event;
          });
        });
      }

      return { previousEventDetail, previousEventList, eventId };
    },

    onSuccess: (data, eventId) => {
      // Backend returns: { eventId, newLikeCount, isLiked }
      const { newLikeCount, isLiked } = data;

      // Update LIST cache with server data
      queryClient.setQueryData(eventKeys.list, (oldList) => {
        if (!oldList) return oldList;

        return oldList.map((event) => {
          if (event.id === eventId) {
            return {
              ...event,
              likesCount: newLikeCount,  // ✅ Map to likesCount
              isLiked: isLiked,          // ✅ Keep as isLiked
            };
          }
          return event;
        });
      });

      // Update DETAIL cache with server data
      queryClient.setQueryData(eventKeys.detail(eventId), (old) => {
        if (!old) return old;
        return {
          ...old,
          likesCount: newLikeCount,    // ✅ Map to likesCount
          isLiked: isLiked,            // ✅ Keep as isLiked
        };
      });

      const message = isLiked
        ? "Event added to favorites!"
        : "Event removed from favorites";
      toastAlert.success(message);
    },

    onError: (error, eventId, context) => {
      const responseData = error.response?.data;
      const statusCode = error.response?.status;

      // Check if login required
      const isLoginRequired =
        statusCode === 403 && responseData?.action_required === "LOGIN";

      if (isLoginRequired) {
        // Rollback optimistic update
        if (context?.previousEventDetail) {
          queryClient.setQueryData(
            eventKeys.detail(context.eventId),
            context.previousEventDetail
          );
        }
        if (context?.previousEventList) {
          queryClient.setQueryData(eventKeys.list, context.previousEventList);
        }

        const loginMessage =
          responseData?.message ||
          "Please log in to save this event to your favorites permanently.";
        toastAlert.info(loginMessage);

        console.warn(
          "⚠️ [MUTATION] Like failed: Login required (cookies likely disabled)."
        );
        return;
      }

      // Generic error - rollback
      if (context?.previousEventDetail) {
        queryClient.setQueryData(
          eventKeys.detail(context.eventId),
          context.previousEventDetail
        );
      }
      if (context?.previousEventList) {
        queryClient.setQueryData(eventKeys.list, context.previousEventList);
      }

      const message = responseData?.message || "Failed to update like status";
      toastAlert.error(message);
      console.error("❌ [MUTATION] Like event failed:", error);
    },
  });
}