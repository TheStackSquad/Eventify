// frontend/src/utils/hooks/useEvents.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import {
  fetchUserEventsApi,
  fetchAllEventsApi,
  fetchEventByIdApi,
  fetchEventAnalyticsApi,
  createEventApi,
  updateEventApi,
  deleteEventApi,
  publishEventApi,
  likeEventApi,
} from "@/services/eventsApi";

// QUERY KEYS
export const eventKeys = {
  all: ["events"],
  lists: () => [...eventKeys.all, "list"],
  list: () => [...eventKeys.lists()],
  users: () => [...eventKeys.all, "user"],
  user: (userId) => [...eventKeys.users(), userId],
  details: () => [...eventKeys.all, "detail"],
  detail: (eventId) => [...eventKeys.details(), eventId],
  analytics: (eventId) => [...eventKeys.all, "analytics", eventId],
};

// SHARED CONFIG
const QUERY_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  retry: (failureCount, error) => {
    // Don't retry auth errors
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      return false;
    }
    // Retry network/server errors up to 2 times
    return failureCount < 2;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
};

const MUTATION_CONFIG = {
  retry: 3,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
};

// QUERY HOOKS - All return normalized data

// Fetch all events (PUBLIC - no auth required)
export function useAllEvents() {
  return useQuery({
    queryKey: eventKeys.list(),
    queryFn: fetchAllEventsApi,
    ...QUERY_CONFIG,
    // Public endpoint - always enabled
    enabled: true,
  });
}

// Fetch events for specific user (PROTECTED)
export function useUserEvents(userId, isEnabled = true) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: eventKeys.user(userId),
    queryFn: () => fetchUserEventsApi(userId),
    ...QUERY_CONFIG,
    // Only fetch if authenticated AND userId exists AND manually enabled
    enabled: isAuthenticated && !!userId && isEnabled,
  });
}

export function useEvent(eventId, options = {}) {
  return useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: () => fetchEventByIdApi(eventId),
    ...QUERY_CONFIG,
    staleTime: 60 * 60 * 1000, // 1 hour (events don't change often)
    // Merge default config with user options
    enabled: options.enabled !== undefined ? options.enabled : !!eventId,
    ...options,
  });
}

export function useEventAnalytics(eventId, isEnabled = true) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: eventKeys.analytics(eventId),
    queryFn: () => fetchEventAnalyticsApi(eventId),
    ...QUERY_CONFIG,
    staleTime: 1 * 60 * 1000, // 1 minute (analytics change frequently)
    // Only fetch if authenticated AND eventId exists AND manually enabled
    enabled: isAuthenticated && !!eventId && isEnabled,
  });
}

// MUTATION HOOKS (All require authentication)

// Create new event (PROTECTED)
export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: createEventApi,
    ...MUTATION_CONFIG,
    onMutate: async (newEventData) => {
      if (process.env.NODE_ENV === "development") {
        console.log("🎨 [useCreateEvent] Creating event:", {
          title: newEventData.eventTitle,
          userId: user?.id,
        });
      }
    },
    onSuccess: (newEvent) => {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ [useCreateEvent] Event created:", {
          eventId: newEvent?.id,
          title: newEvent?.eventTitle,
        });
      }

      // Invalidate list queries to refetch
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      queryClient.invalidateQueries({ queryKey: eventKeys.users() });

      // Optimistically set the new event in cache
      if (newEvent?.id) {
        queryClient.setQueryData(eventKeys.detail(newEvent.id), newEvent);
      }
    },
    onError: (error) => {
      console.error("❌ [useCreateEvent] Failed:", {
        message: error.message,
        status: error.response?.status,
      });
    },
  });
}

//  Update existing event (PROTECTED)
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEventApi,
    ...MUTATION_CONFIG,
    onMutate: async (variables) => {
      if (process.env.NODE_ENV === "development") {
        console.log("✏️ [useUpdateEvent] Updating event:", {
          eventId: variables.eventId,
        });
      }

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: eventKeys.detail(variables.eventId),
      });

      // Snapshot previous value for rollback
      const previousEvent = queryClient.getQueryData(
        eventKeys.detail(variables.eventId),
      );

      // Optimistically update cache
      if (previousEvent) {
        queryClient.setQueryData(eventKeys.detail(variables.eventId), {
          ...previousEvent,
          ...variables.eventData,
        });
      }

      return { previousEvent };
    },
    onSuccess: (updatedEvent, variables) => {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ [useUpdateEvent] Event updated:", {
          eventId: variables.eventId,
        });
      }

      // Update cache with server response
      queryClient.setQueryData(
        eventKeys.detail(variables.eventId),
        updatedEvent,
      );

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      queryClient.invalidateQueries({ queryKey: eventKeys.users() });
    },
    onError: (error, variables, context) => {
      console.error("❌ [useUpdateEvent] Failed:", {
        eventId: variables.eventId,
        message: error.message,
      });

      // Rollback to previous value
      if (context?.previousEvent) {
        queryClient.setQueryData(
          eventKeys.detail(variables.eventId),
          context.previousEvent,
        );
      }
    },
  });
}

// Delete event (PROTECTED)
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEventApi,
    ...MUTATION_CONFIG,
    onMutate: async (eventId) => {
      if (process.env.NODE_ENV === "development") {
        console.log("🗑️ [useDeleteEvent] Deleting event:", { eventId });
      }

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: eventKeys.detail(eventId),
      });

      // Snapshot for rollback
      const previousEvent = queryClient.getQueryData(eventKeys.detail(eventId));

      return { previousEvent, eventId };
    },
    onSuccess: (data, eventId) => {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ [useDeleteEvent] Event deleted:", { eventId });
      }

      // Remove from cache
      queryClient.removeQueries({ queryKey: eventKeys.detail(eventId) });

      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      queryClient.invalidateQueries({ queryKey: eventKeys.users() });
    },
    onError: (error, eventId, context) => {
      console.error("❌ [useDeleteEvent] Failed:", {
        eventId,
        message: error.message,
      });

      // Restore deleted event in cache
      if (context?.previousEvent) {
        queryClient.setQueryData(
          eventKeys.detail(eventId),
          context.previousEvent,
        );
      }
    },
  });
}

//  Publish/unpublish event (PROTECTED)
export function usePublishEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: publishEventApi,
    ...MUTATION_CONFIG,
    onMutate: async (variables) => {
      if (process.env.NODE_ENV === "development") {
        console.log("📢 [usePublishEvent] Publishing event:", {
          eventId: variables.eventId,
          publish: variables.publish,
        });
      }

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: eventKeys.detail(variables.eventId),
      });

      // Snapshot for rollback
      const previousEvent = queryClient.getQueryData(
        eventKeys.detail(variables.eventId),
      );

      // Optimistically update
      if (previousEvent) {
        queryClient.setQueryData(eventKeys.detail(variables.eventId), {
          ...previousEvent,
          isPublished: variables.publish,
        });
      }

      return { previousEvent };
    },
    onSuccess: (updatedEvent, variables) => {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ [usePublishEvent] Event published:", {
          eventId: variables.eventId,
        });
      }

      // Update with server response
      queryClient.setQueryData(
        eventKeys.detail(variables.eventId),
        updatedEvent,
      );

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      queryClient.invalidateQueries({ queryKey: eventKeys.users() });
    },
    onError: (error, variables, context) => {
      console.error("❌ [usePublishEvent] Failed:", {
        eventId: variables.eventId,
        message: error.message,
      });

      // Rollback
      if (context?.previousEvent) {
        queryClient.setQueryData(
          eventKeys.detail(variables.eventId),
          context.previousEvent,
        );
      }
    },
  });
}

// Like/unlike event (PROTECTED)
export function useLikeEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: likeEventApi,
    onMutate: async (eventId) => {
      if (process.env.NODE_ENV === "development") {
        console.log("❤️ [useLikeEvent] Toggling like:", {
          eventId,
          userId: user?.id,
        });
      }

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: eventKeys.detail(eventId),
      });

      // Snapshot for rollback
      const previousEvent = queryClient.getQueryData(eventKeys.detail(eventId));

      // Optimistically update like count
      if (previousEvent) {
        const isLiked = previousEvent.likes?.includes(user?.id);
        const newLikes = isLiked
          ? previousEvent.likes.filter((id) => id !== user?.id)
          : [...(previousEvent.likes || []), user?.id];

        queryClient.setQueryData(eventKeys.detail(eventId), {
          ...previousEvent,
          likes: newLikes,
          likeCount: newLikes.length,
        });
      }

      return { previousEvent };
    },
    onSuccess: (data, eventId) => {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ [useLikeEvent] Like toggled:", { eventId });
      }

      // Invalidate to refetch accurate data
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
    onError: (error, eventId, context) => {
      console.error("❌ [useLikeEvent] Failed:", {
        eventId,
        message: error.message,
      });

      // Rollback
      if (context?.previousEvent) {
        queryClient.setQueryData(
          eventKeys.detail(eventId),
          context.previousEvent,
        );
      }
    },
  });
}

// UTILITY HOOKS

export function useIsEventOwner(eventId) {
  const { user } = useAuth();
  const { data: event } = useEvent(eventId);

  return event?.userId === user?.id;
}

export function useHasLikedEvent(eventId) {
  const { user } = useAuth();
  const { data: event } = useEvent(eventId);

  return event?.likes?.includes(user?.id) || false;
}
