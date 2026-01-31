// frontend/src/utils/hooks/useEvents.js

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { transformEventToFormData } from "@/app/events/create-events/utils/eventTransformers";
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

// SHARED CONFIGURATION

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


// QUERY HOOKS - PUBLIC & PROTECTED

//Fetch all events (PUBLIC - no auth required)
export function useAllEvents() {
  return useQuery({
    queryKey: eventKeys.list(),
    queryFn: fetchAllEventsApi,
    ...QUERY_CONFIG,
    enabled: true, // Public endpoint - always enabled
  });
}

//Fetch events for specific user (PROTECTED)
export function useUserEvents(userId, isEnabled = true) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: eventKeys.user(userId),
    queryFn: () => fetchUserEventsApi(userId),
    ...QUERY_CONFIG,
    enabled: isAuthenticated && !!userId && isEnabled,
  });
}

// Fetch single event by ID (PROTECTED - for editing)
export function useEvent(eventId, options = {}) {
  return useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: async () => {
      const response = await fetchEventByIdApi(eventId);

      // Debug logging
      if (process.env.NODE_ENV === "development") {
        console.log("🔍 [useEvent] Raw API Response:", response);
        // Check ticket prices from backend
        if (response.tickets && response.tickets.length > 0) {
          console.log("💰 [useEvent] Ticket Prices (should be in Naira):", 
            response.tickets.map(t => ({ 
              tier: t.tierName, 
              price: t.price,
              isFree: t.isFree 
            }))
          );
        }
      }

      // Transform the data (only structure, no price conversion)
      const transformed = transformEventToFormData(response);

      if (process.env.NODE_ENV === "development") {
        console.log("✨ [useEvent] Transformed Data:", transformed);
      }

      return transformed;
    },
    ...QUERY_CONFIG,
    staleTime: 60 * 60 * 1000, // 1 hour (events don't change often)
    enabled: options.enabled !== undefined ? options.enabled : !!eventId,
    ...options,
  });
}

//Fetch event analytics (PROTECTED)
export function useEventAnalytics(eventId, isEnabled = true) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: eventKeys.analytics(eventId),
    queryFn: () => fetchEventAnalyticsApi(eventId),
    ...QUERY_CONFIG,
    staleTime: 1 * 60 * 1000, // 1 minute (analytics change frequently)
    enabled: isAuthenticated && !!eventId && isEnabled,
  });
}

// MUTATION HOOKS - ALL REQUIRE AUTHENTICATION

//Create new event (PROTECTED)
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
    onSuccess: (serverResponse) => {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ [useCreateEvent] Event created:", {
          eventId: serverResponse?.id,
          title: serverResponse?.eventTitle,
        });
      }

      // 🔍 CRITICAL: Transform server response before caching
      const transformed = ensureTransformedData(serverResponse);

      // Invalidate list queries to refetch
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      queryClient.invalidateQueries({ queryKey: eventKeys.users() });

      // Cache the transformed event
      if (transformed?.id) {
        queryClient.setQueryData(eventKeys.detail(transformed.id), transformed);
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

// update event (PROTECTED)

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables) => {
      console.group("🔧 [useUpdateEvent MutationFn]");
      console.log("📤 Mutation variables received:", {
        eventId: variables.eventId,
        updatesKeys: Object.keys(variables.updates),
      });

      // Mapping Verification: We ensure we are logging 'tickets' 
      // which is what prepareEventPayload generates
      if (variables.updates.tickets) {
        console.log("🎫 Mapping Verification (tickets):", {
          count: variables.updates.tickets.length,
          tiers: variables.updates.tickets.map((t, i) => ({
            index: i,
            id: t.id,
            tierName: t.tierName, // Exact name check
            price: t.price,
            type: typeof t.price,
            quantity: t.quantity,
          })),
        });
      }

      try {
        console.log("📡 Calling updateEventApi...");
        const response = await updateEventApi({
          eventId: variables.eventId,
          updates: variables.updates,
        });
        
        console.log("✅ updateEventApi response received");
        console.groupEnd();
        return response;
      } catch (error) {
        console.error("❌ updateEventApi error:", error.message);
        if (error.config) {
          console.error("Payload sent to server:", error.config.data);
        }
        console.groupEnd();
        throw error;
      }
    },
    ...MUTATION_CONFIG,
    
    onMutate: async (variables) => {
      console.group("🔄 [useUpdateEvent onMutate]");
      
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({
        queryKey: eventKeys.detail(variables.eventId),
      });

      // Snapshot the previous value
      const previousEvent = queryClient.getQueryData(
        eventKeys.detail(variables.eventId),
      );

      // Perform Optimistic Update
      if (previousEvent) {
        const updatedEvent = {
          ...previousEvent,
          ...variables.updates,
          // Sync naming: if payload has 'tickets', update the local 'tickets'
          tickets: variables.updates.tickets || previousEvent.tickets,
          updatedAt: new Date().toISOString(),
        };
        
        queryClient.setQueryData(eventKeys.detail(variables.eventId), updatedEvent);
        console.log("✅ Optimistic data set in cache");
      }

      console.groupEnd();
      return { previousEvent };
    },
    
    onSuccess: (updatedEvent, variables) => {
      console.group("✅ [useUpdateEvent onSuccess]");
      
      // Data Consistency Check
      if (updatedEvent?.tickets && variables.updates.tickets) {
        const match = updatedEvent.tickets[0]?.tierName === variables.updates.tickets[0]?.tierName;
        console.log(`🎫 Data Integrity Check: ${match ? "PASSED" : "FAILED"}`);
      }

      // Update cache with the definitive server response
      queryClient.setQueryData(
        eventKeys.detail(variables.eventId),
        updatedEvent,
      );

      // Invalidate related queries to trigger background refreshes
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      queryClient.invalidateQueries({ queryKey: eventKeys.users() });

      console.groupEnd();
    },
    
    onError: (error, variables, context) => {
      console.group("❌ [useUpdateEvent onError]");
      
      // Rollback to the previous state if the mutation fails
      if (context?.previousEvent) {
        console.log("🔄 Rolling back optimistic update...");
        queryClient.setQueryData(
          eventKeys.detail(variables.eventId),
          context.previousEvent,
        );
      }

      console.groupEnd();
    },
    
    onSettled: (data, error, variables) => {
      console.log("🏁 [useUpdateEvent onSettled] Sync complete for:", variables.eventId);
    },
  });
}


//Delete event (PROTECTED)
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

//Publish/unpublish event (PROTECTED)
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

      // Optimistically update publish status (safe - doesn't affect prices)
      if (previousEvent) {
        queryClient.setQueryData(eventKeys.detail(variables.eventId), {
          ...previousEvent,
          isPublished: variables.publish,
        });
      }

      return { previousEvent };
    },
    onSuccess: (serverResponse, variables) => {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ [usePublishEvent] Event published:", {
          eventId: variables.eventId,
        });
      }

      // Transform and update with server response
      const transformed = ensureTransformedData(serverResponse);
      queryClient.setQueryData(
        eventKeys.detail(variables.eventId),
        transformed,
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

//Like/unlike event (PROTECTED)
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

      // Optimistically update like count (safe - doesn't affect prices)
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

//Check if current user owns the event
export function useIsEventOwner(eventId) {
  const { user } = useAuth();
  const { data: event } = useEvent(eventId);

  return event?.userId === user?.id;
}

//Check if current user has liked the event
export function useHasLikedEvent(eventId) {
  const { user } = useAuth();
  const { data: event } = useEvent(eventId);

  return event?.likes?.includes(user?.id) || false;
}
