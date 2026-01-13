// frontend/src/utils/hooks/useEvents.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

// ============================================
// QUERY KEYS
// ============================================
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

// ============================================
// SHARED CONFIG
// ============================================
const MUTATION_CONFIG = {
  retry: 3,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
};

// ============================================
// QUERY HOOKS - All return normalized data
// ============================================

/**
 * Fetch all events (PUBLIC)
 * API returns: Flat array of events (already normalized in fetchAllEventsApi)
 */
export function useAllEvents() {
  return useQuery({
    queryKey: eventKeys.list(),
    queryFn: fetchAllEventsApi, // ← Returns flat array
    staleTime: 1000 * 60 * 5, // 5 minutes
    // No select needed - API already returns array
  });
}

/**
 * Fetch events for specific user
 * API returns: Flat array of events
 */
export function useUserEvents(userId, isEnabled = true) {
  return useQuery({
    queryKey: eventKeys.user(userId),
    queryFn: fetchUserEventsApi, // ← Returns flat array
    enabled: isEnabled && !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch single event by ID
 * API returns: Single event object
 */
export function useEvent(eventId) {
  return useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: () => fetchEventByIdApi(eventId), // ← Returns event object
    enabled: !!eventId,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Fetch event analytics
 * API returns: Analytics object
 */
export function useEventAnalytics(eventId, isEnabled = true) {
  return useQuery({
    queryKey: eventKeys.analytics(eventId),
    queryFn: () => fetchEventAnalyticsApi(eventId), // ← Returns analytics object
    enabled: isEnabled && !!eventId,
    staleTime: 1000 * 60 * 1, // 1 minute (analytics change often)
  });
}

// ============================================
// MUTATION HOOKS
// ============================================

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEventApi,
    ...MUTATION_CONFIG,
    onSuccess: (newEvent) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      queryClient.invalidateQueries({ queryKey: eventKeys.users() });

      if (newEvent?.id) {
        queryClient.setQueryData(eventKeys.detail(newEvent.id), newEvent);
      }
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEventApi,
    ...MUTATION_CONFIG,
    onSuccess: (updatedEvent, variables) => {
      queryClient.setQueryData(
        eventKeys.detail(variables.eventId),
        updatedEvent
      );
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      queryClient.invalidateQueries({ queryKey: eventKeys.users() });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEventApi,
    ...MUTATION_CONFIG,
    onSuccess: (data) => {
      queryClient.removeQueries({ queryKey: eventKeys.detail(data.eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      queryClient.invalidateQueries({ queryKey: eventKeys.users() });
    },
  });
}

export function usePublishEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: publishEventApi,
    ...MUTATION_CONFIG,
    onSuccess: (updatedEvent, variables) => {
      queryClient.setQueryData(
        eventKeys.detail(variables.eventId),
        updatedEvent
      );
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      queryClient.invalidateQueries({ queryKey: eventKeys.users() });
    },
  });
}

export function useLikeEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: likeEventApi,
    onSuccess: (data, eventId) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
  });
}
