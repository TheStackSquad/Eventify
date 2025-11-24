// frontend/src/redux/reducer/eventReducer.js
import { createSlice } from "@reduxjs/toolkit";
import * as eventActions from "@/redux/action/eventAction";
import { STATUS, EVENT_DEFAULTS } from "@/utils/constants/globalConstants";

// 1. IMPORT LIKE ACTIONS
import {
  toggleLikeOptimistic,
  toggleEventLike,
} from "@/redux/action/likeAction";

const initialState = EVENT_DEFAULTS.INITIAL_STATE;


const eventSlice = createSlice({
  name: "events",
  initialState,
  reducers: {
    clearAnalytics: (state) => {
      state.eventAnalytics = {};
      state.aggregatedAnalytics = initialState.aggregatedAnalytics;
    },
    clearSelectedEvent: (state) => {
      state.selectedEvent = null;
    },
    /** Clear errors */
    clearEventError(state) {
      state.error = null;
    },

    /** Set selected event for viewing/editing (used for detail view) */
    setSelectedEvent(state, action) {
      state.selectedEvent = action.payload;
    },

    /** Clear current event (used for form editing pre-fill) */
    clearCurrentEvent(state) {
      state.currentEvent = null;
    },
  },
  extraReducers: (builder) => {
    // console.log("🔍 [DEBUG] Building extraReducers...");

    // ====================================================================
    // 🛑 LIKE/UNLIKE LOGIC INTEGRATION 🛑 (Optimistic Update Pattern)
    // ====================================================================

    // 1. Optimistic Update (Immediate UI change)
    builder.addCase(toggleLikeOptimistic, (state, action) => {
      const eventId = action.payload;
      const event = state.userEvents.find((e) => e.id === eventId);

      if (event) {
        // Ensure likeCount exists before modification
        if (typeof event.likeCount !== "number") {
          // Initialize if missing
          event.likeCount = event.isLikedByUser ? 1 : 0;
        }

        const isLiking = !event.isLikedByUser;

        event.isLikedByUser = isLiking;
        event.likeCount = event.likeCount + (isLiking ? 1 : -1);
        console.log(
          `🔍 [DEBUG] OPTIMISTIC: Event ${eventId} like status changed to ${isLiking}`
        );
      }
    });

    // 2. Server Confirmation (Success): Override optimistic value with server's final data
    builder.addCase(toggleEventLike.fulfilled, (state, action) => {
      const { eventId, newLikeCount, isLiked } = action.payload;
      const event = state.userEvents.find((e) => e.id === eventId);

      if (event) {
        event.likeCount = newLikeCount;
        event.isLikedByUser = isLiked;
        console.log(
          `🔍 [DEBUG] FULFILLED: Event ${eventId} confirmed. New count: ${newLikeCount}`
        );
      }
    });

    // 3. Server Confirmation (Failure/Rollback): Revert the optimistic change
    builder.addCase(toggleEventLike.rejected, (state, action) => {
      const { eventId } = action.meta.arg; // Assuming eventId is in the meta/argument of the thunk
      const event = state.userEvents.find((e) => e.id === eventId);

      if (event) {
        // Rollback: Flip the status back. If it was liked by optimistic, it becomes unliked.
        const wasLiking = event.isLikedByUser;

        event.isLikedByUser = !wasLiking;
        event.likeCount = event.likeCount + (wasLiking ? -1 : 1);

        // Set error for component to show rollback message
        state.error =
          action.error?.message ||
          "Failed to update like status. Rolling back change.";
        console.error(
          `🔍 [DEBUG] REJECTED: Event ${eventId} like failed. Rolled back.`
        );
      }
    });

    // ====================================================================
    // 🛑 END LIKE/UNLIKE LOGIC INTEGRATION 🛑
    // ====================================================================

    // ====================================================================
    // 🏷️ CRUD OPERATIONS (CREATE, UPDATE, DELETE, PUBLISH)
    // ====================================================================

    // CREATE EVENT
    builder
      .addCase(eventActions.createEvent.pending, (state) => {
        console.log("🔍 [DEBUG] createEvent.pending triggered");
        state.status = STATUS.LOADING;
        state.error = null;
      })
      .addCase(eventActions.createEvent.fulfilled, (state, action) => {
        console.log("🔍 [DEBUG] createEvent.fulfilled triggered");
        state.status = STATUS.SUCCEEDED;
        // Prepend new event to the userEvents array
        state.userEvents.unshift(action.payload.event);
        state.error = null;
      })
      .addCase(eventActions.createEvent.rejected, (state, action) => {
        console.log("🔍 [DEBUG] createEvent.rejected triggered");
        state.status = STATUS.FAILED;
        state.error = action.payload?.message || "Failed to create event";
      })

      // UPDATE EVENT
      .addCase(eventActions.updateEvent.fulfilled, (state, action) => {
        console.log("🔍 [DEBUG] updateEvent.fulfilled triggered");
        const updatedEvent = action.payload.event;

        // 1. Update in userEvents array
        const index = state.userEvents.findIndex(
          (e) => e.id === updatedEvent.id
        );
        if (index !== -1) {
          state.userEvents[index] = updatedEvent;
        }

        // 2. Update selectedEvent if it's the same event
        if (state.selectedEvent?.id === updatedEvent.id) {
          state.selectedEvent = updatedEvent;
        }

        // 3. Update currentEvent if it's the same event
        if (state.currentEvent?.id === updatedEvent.id) {
          state.currentEvent = updatedEvent;
        }
      })

      // DELETE EVENT
      .addCase(eventActions.deleteEvent.fulfilled, (state, action) => {
        console.log("🔍 [DEBUG] deleteEvent.fulfilled triggered");
        const deletedEventId = action.payload.eventId;

        // Remove event from userEvents array
        state.userEvents = state.userEvents.filter(
          (e) => e.id !== deletedEventId
        );

        // Clear selected/current if they match the deleted event
        if (state.selectedEvent?.id === deletedEventId) {
          state.selectedEvent = null;
          state.analytics = initialState.analytics;
        }
        if (state.currentEvent?.id === deletedEventId) {
          state.currentEvent = null;
        }
      })

      // PUBLISH EVENT
      .addCase(eventActions.publishEvent.fulfilled, (state, action) => {
        console.log("🔍 [DEBUG] publishEvent.fulfilled triggered");
        const publishedEvent = action.payload.event;

        // 1. Update in userEvents array
        const index = state.userEvents.findIndex(
          (e) => e.id === publishedEvent.id
        );
        if (index !== -1) {
          state.userEvents[index] = publishedEvent;
        }

        // 2. Update selectedEvent
        if (state.selectedEvent?.id === publishedEvent.id) {
          state.selectedEvent = publishedEvent;
        }

        // 3. Update currentEvent
        if (state.currentEvent?.id === publishedEvent.id) {
          state.currentEvent = publishedEvent;
        }
      });

    // GET EVENT BY ID (For pre-filling edit form or fetching single detail)
    builder
      .addCase(eventActions.getEventById.pending, (state) => {
        console.log("🔍 [DEBUG] getEventById.pending triggered");
        state.status = STATUS.LOADING;
        state.error = null;
      })
      .addCase(eventActions.getEventById.fulfilled, (state, action) => {
        console.log("🔍 [DEBUG] getEventById.fulfilled triggered");
        state.status = STATUS.SUCCEEDED;
        state.currentEvent = action.payload; // Store for form pre-fill/single view
        state.error = null;
      })
      .addCase(eventActions.getEventById.rejected, (state, action) => {
        console.log("🔍 [DEBUG] getEventById.rejected triggered");
        state.status = STATUS.FAILED;
        state.error = action.payload?.message || "Failed to fetch event";
        state.currentEvent = null;
      })

      // FETCH USER EVENTS (The events owned by the user)
      .addCase(eventActions.fetchUserEvents.pending, (state) => {
        console.log("🔍 [DEBUG] fetchUserEvents.pending triggered");
        state.status = STATUS.LOADING;
        state.error = null;
      })
      .addCase(eventActions.fetchUserEvents.fulfilled, (state, action) => {
        console.log("🔍 [DEBUG] fetchUserEvents.fulfilled triggered");
        state.status = STATUS.SUCCEEDED;
        state.userEvents = action.payload || [];
        state.error = null;

        // 🆕 Calculate potential metrics from ticket data
        calculatePotentialMetrics(state);
      })
      .addCase(eventActions.fetchUserEvents.rejected, (state, action) => {
        console.log("🔍 [DEBUG] fetchUserEvents.rejected triggered");
        state.status = STATUS.FAILED;
        state.error = action.payload?.message || "Failed to fetch user events";
      })

      // FETCH ALL EVENTS (Publicly visible events)
      .addCase(eventActions.fetchAllEvents.pending, (state) => {
        console.log("🔍 [DEBUG] fetchAllEvents.pending triggered");
        state.allEventsStatus = STATUS.LOADING;
        state.error = null;
      })
      .addCase(eventActions.fetchAllEvents.fulfilled, (state, action) => {
        console.log("🔍 [DEBUG] fetchAllEvents.fulfilled triggered");
        state.allEventsStatus = STATUS.SUCCEEDED;
        state.allEvents = action.payload || [];
        state.error = null;
      })
      .addCase(eventActions.fetchAllEvents.rejected, (state, action) => {
        console.log("🔍 [DEBUG] fetchAllEvents.rejected triggered");
        state.allEventsStatus = STATUS.FAILED;
        state.error = action.payload?.message || "Failed to fetch all events";
      })

      // FETCH EVENT ANALYTICS
      builder
        .addCase(eventActions.fetchEventAnalytics.pending, (state, action) => {
          console.log("🔍 [DEBUG] fetchEventAnalytics.pending triggered");
          const eventId = action.meta.arg.eventId;

          // Initialize analytics object for this event if doesn't exist
          if (!state.eventAnalytics[eventId]) {
            state.eventAnalytics[eventId] = {
              data: null,
              status: STATUS.IDLE,
              error: null,
              fetchedAt: null,
            };
          }

          state.eventAnalytics[eventId].status = STATUS.LOADING;
          state.eventAnalytics[eventId].error = null;
        })
        .addCase(
          eventActions.fetchEventAnalytics.fulfilled,
          (state, action) => {
            console.log("✅ [DEBUG] fetchEventAnalytics.fulfilled triggered");
            const eventId = action.meta.arg.eventId;

            // Store analytics for this specific event
            state.eventAnalytics[eventId] = {
              data: action.payload,
              status: STATUS.SUCCEEDED,
              error: null,
              fetchedAt: new Date().toISOString(),
            };

            // 🆕 Recalculate aggregated analytics across all events
            updateAggregatedAnalytics(state);
          }
        )
        .addCase(eventActions.fetchEventAnalytics.rejected, (state, action) => {
          console.log("❌ [DEBUG] fetchEventAnalytics.rejected triggered");
          const eventId = action.meta.arg.eventId;

          state.eventAnalytics[eventId] = {
            data: null,
            status: STATUS.FAILED,
            error: action.payload?.message || "Failed to fetch analytics",
            fetchedAt: null,
          };
        });

    // console.log("🔍 [DEBUG] extraReducers build completed");
  },
});

function calculatePotentialMetrics(state) {
  const events = state.userEvents || [];
  
  if (events.length === 0) {
    state.aggregatedAnalytics = { ...initialState.aggregatedAnalytics };
    return;
  }
  
  let totalCapacity = 0;
  let potentialRevenue = 0;
  let totalPriceSum = 0;
  
  events.forEach((event) => {
    if (event.tickets && Array.isArray(event.tickets)) {
      event.tickets.forEach((ticket) => {
        const quantity = ticket.quantity || 0;
        const price = ticket.price || 0;
        
        totalCapacity += quantity;
        potentialRevenue += price * quantity;
        totalPriceSum += price * quantity;
      });
    }
  });
  
  const averageTicketPrice =
    totalCapacity > 0 ? Math.round(totalPriceSum / totalCapacity) : 0;
  
  // Update aggregated analytics with calculated values
  state.aggregatedAnalytics.totalCapacity = totalCapacity;
  state.aggregatedAnalytics.potentialRevenue = potentialRevenue;
  state.aggregatedAnalytics.averageTicketPrice = averageTicketPrice;
  
  // Keep existing real analytics data if available
  // Only update if no real data exists
  if (state.aggregatedAnalytics.totalRevenue === 0) {
    state.aggregatedAnalytics.ticketsRemaining = totalCapacity;
  }
  
  console.log("📊 [DEBUG] Potential metrics calculated:", {
    totalCapacity,
    potentialRevenue,
    averageTicketPrice,
  });
}

/**
 * Aggregate real analytics data from all successfully fetched event analytics
 * This updates dashboard with actual sales data
 */
function updateAggregatedAnalytics(state) {
  const analyticsEntries = Object.values(state.eventAnalytics).filter(
    (entry) => entry.status === STATUS.SUCCEEDED && entry.data
  );
  
  if (analyticsEntries.length === 0) {
    console.log("📊 [DEBUG] No analytics data to aggregate, keeping potential metrics");
    return;
  }
  
  // Aggregate real data from backend analytics
  let totalRevenue = 0;
  let ticketsSold = 0;
  let ticketsRemaining = 0;
  
  analyticsEntries.forEach((entry) => {
    const analytics = entry.data;
    
    // Backend returns revenue in kobo, tickets as numbers
    if (analytics.overview) {
      totalRevenue += analytics.overview.totalRevenue || 0;
      ticketsSold += analytics.overview.ticketsSold || 0;
    }
    
    if (analytics.tickets) {
      ticketsRemaining += analytics.tickets.totalRemaining || 0;
    }
  });
  
  // Update with real data
  state.aggregatedAnalytics.totalRevenue = totalRevenue;
  state.aggregatedAnalytics.ticketsSold = ticketsSold;
  state.aggregatedAnalytics.ticketsRemaining = ticketsRemaining;
  
  // Calculate sell-through rate
  const totalCapacity = state.aggregatedAnalytics.totalCapacity;
  if (totalCapacity > 0) {
    state.aggregatedAnalytics.sellThroughRate = 
      parseFloat(((ticketsSold / totalCapacity) * 100).toFixed(2));
  }
  
  console.log("📊 [DEBUG] Aggregated analytics updated:", {
    totalRevenue,
    ticketsSold,
    ticketsRemaining,
    fromEventsCount: analyticsEntries.length,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export const {
  clearEventError,
  clearAnalytics,
  setSelectedEvent,
  clearSelectedEvent,
  clearCurrentEvent,
} = eventSlice.actions;

// console.log("🔍 [DEBUG] eventSlice created successfully");
export default eventSlice.reducer;
