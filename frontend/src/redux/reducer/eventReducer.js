// // frontend/src/redux/reducer/eventReducer.js
// import { createSlice } from "@reduxjs/toolkit";
// import * as eventActions from "@/redux/action/eventAction";
// import { STATUS, EVENT_DEFAULTS } from "@/utils/constants/globalConstants";

// // 1. IMPORT LIKE ACTIONS
// import {
//   toggleLikeOptimistic,
//   toggleEventLike,
// } from "@/redux/action/likeAction";

// const initialState = EVENT_DEFAULTS.INITIAL_STATE;

// const eventSlice = createSlice({
//   name: "events",
//   initialState,
//   reducers: {
//     // 🆕 CRITICAL: Reset entire events state (for logout/user change)
//     resetEventsState: (state) => {
//       console.log("🔄 [DEBUG] Resetting events state to initial");
//       return initialState;
//     },

//     clearAnalytics: (state) => {
//       state.eventAnalytics = {};
//       state.aggregatedAnalytics = initialState.aggregatedAnalytics;
//     },

//     clearSelectedEvent: (state) => {
//       state.selectedEvent = null;
//     },

//     /** Clear errors */
//     clearEventError(state) {
//       state.error = null;
//     },

//     /** Set selected event for viewing/editing (used for detail view) */
//     setSelectedEvent(state, action) {
//       state.selectedEvent = action.payload;
//     },

//     /** Clear current event (used for form editing pre-fill) */
//     clearCurrentEvent(state) {
//       state.currentEvent = null;
//     },
//   },
//   extraReducers: (builder) => {
//     // ====================================================================
//     // 🛑 LIKE/UNLIKE LOGIC INTEGRATION 🛑 (Optimistic Update Pattern)
//     // ====================================================================

//     // 1. Optimistic Update (Immediate UI change)
//     builder.addCase(toggleLikeOptimistic, (state, action) => {
//       const eventId = action.payload;
//       const event = state.userEvents.find((e) => e.id === eventId);

//       if (event) {
//         // Ensure likeCount exists before modification
//         if (typeof event.likeCount !== "number") {
//           // Initialize if missing
//           event.likeCount = event.isLikedByUser ? 1 : 0;
//         }

//         const isLiking = !event.isLikedByUser;

//         event.isLikedByUser = isLiking;
//         event.likeCount = event.likeCount + (isLiking ? 1 : -1);
//         console.log(
//           `🔍 [DEBUG] OPTIMISTIC: Event ${eventId} like status changed to ${isLiking}`
//         );
//       }
//     });

//     // 2. Server Confirmation (Success): Override optimistic value with server's final data
//     builder.addCase(toggleEventLike.fulfilled, (state, action) => {
//       const { eventId, newLikeCount, isLiked } = action.payload;
//       const event = state.userEvents.find((e) => e.id === eventId);

//       if (event) {
//         event.likeCount = newLikeCount;
//         event.isLikedByUser = isLiked;
//         console.log(
//           `🔍 [DEBUG] FULFILLED: Event ${eventId} confirmed. New count: ${newLikeCount}`
//         );
//       }
//     });

//     // 3. Server Confirmation (Failure/Rollback): Revert the optimistic change
//     builder.addCase(toggleEventLike.rejected, (state, action) => {
//       const { eventId } = action.meta.arg;
//       const event = state.userEvents.find((e) => e.id === eventId);

//       if (event) {
//         const wasLiking = event.isLikedByUser;

//         event.isLikedByUser = !wasLiking;
//         event.likeCount = event.likeCount + (wasLiking ? -1 : 1);

//         state.error =
//           action.error?.message ||
//           "Failed to update like status. Rolling back change.";
//         console.error(
//           `🔍 [DEBUG] REJECTED: Event ${eventId} like failed. Rolled back.`
//         );
//       }
//     });

//     // ====================================================================
//     // 🏷️ CRUD OPERATIONS (CREATE, UPDATE, DELETE, PUBLISH)
//     // ====================================================================

//     // CREATE EVENT
//     builder
//       .addCase(eventActions.createEvent.pending, (state) => {
//         console.log("🔍 [DEBUG] createEvent.pending triggered");
//         state.status = STATUS.LOADING;
//         state.error = null;
//       })
//       .addCase(eventActions.createEvent.fulfilled, (state, action) => {
//         console.log("🔍 [DEBUG] createEvent.fulfilled triggered");
//         state.status = STATUS.SUCCEEDED;
//         state.userEvents.unshift(action.payload.event);
//         state.error = null;
//       })
//       .addCase(eventActions.createEvent.rejected, (state, action) => {
//         console.log("🔍 [DEBUG] createEvent.rejected triggered");
//         state.status = STATUS.FAILED;
//         state.error = action.payload?.message || "Failed to create event";
//       })

//       // UPDATE EVENT
//       .addCase(eventActions.updateEvent.fulfilled, (state, action) => {
//         console.log("🔍 [DEBUG] updateEvent.fulfilled triggered");
//         const updatedEvent = action.payload.event;

//         const index = state.userEvents.findIndex(
//           (e) => e.id === updatedEvent.id
//         );
//         if (index !== -1) {
//           state.userEvents[index] = updatedEvent;
//         }

//         if (state.selectedEvent?.id === updatedEvent.id) {
//           state.selectedEvent = updatedEvent;
//         }

//         if (state.currentEvent?.id === updatedEvent.id) {
//           state.currentEvent = updatedEvent;
//         }
//       })

//       // DELETE EVENT
//       .addCase(eventActions.deleteEvent.fulfilled, (state, action) => {
//         console.log("🔍 [DEBUG] deleteEvent.fulfilled triggered");
//         const deletedEventId = action.payload.eventId;

//         state.userEvents = state.userEvents.filter(
//           (e) => e.id !== deletedEventId
//         );

//         if (state.selectedEvent?.id === deletedEventId) {
//           state.selectedEvent = null;
//           state.analytics = initialState.analytics;
//         }
//         if (state.currentEvent?.id === deletedEventId) {
//           state.currentEvent = null;
//         }
//       })

//       // PUBLISH EVENT
//       .addCase(eventActions.publishEvent.fulfilled, (state, action) => {
//         console.log("🔍 [DEBUG] publishEvent.fulfilled triggered");
//         const publishedEvent = action.payload.event;

//         const index = state.userEvents.findIndex(
//           (e) => e.id === publishedEvent.id
//         );
//         if (index !== -1) {
//           state.userEvents[index] = publishedEvent;
//         }

//         if (state.selectedEvent?.id === publishedEvent.id) {
//           state.selectedEvent = publishedEvent;
//         }

//         if (state.currentEvent?.id === publishedEvent.id) {
//           state.currentEvent = publishedEvent;
//         }
//       });

//     // GET EVENT BY ID
//     builder
//       .addCase(eventActions.getEventById.pending, (state) => {
//         console.log("🔍 [DEBUG] getEventById.pending triggered");
//         state.status = STATUS.LOADING;
//         state.error = null;
//       })
//       .addCase(eventActions.getEventById.fulfilled, (state, action) => {
//         console.log("🔍 [DEBUG] getEventById.fulfilled triggered");
//         state.status = STATUS.SUCCEEDED;
//         state.currentEvent = action.payload;
//         state.error = null;
//       })
//       .addCase(eventActions.getEventById.rejected, (state, action) => {
//         console.log("🔍 [DEBUG] getEventById.rejected triggered");
//         state.status = STATUS.FAILED;
//         state.error = action.payload?.message || "Failed to fetch event";
//         state.currentEvent = null;
//       })

//       // FETCH USER EVENTS
//       .addCase(eventActions.fetchUserEvents.pending, (state) => {
//         console.log("🔍 [DEBUG] fetchUserEvents.pending triggered");
//         state.status = STATUS.LOADING;
//         state.error = null;
//       })
//       .addCase(eventActions.fetchUserEvents.fulfilled, (state, action) => {
//         console.log("🔍 [DEBUG] fetchUserEvents.fulfilled triggered");
//         state.status = STATUS.SUCCEEDED;
//         state.userEvents = action.payload || [];
//         state.error = null;

//         calculatePotentialMetrics(state);
//       })
//       .addCase(eventActions.fetchUserEvents.rejected, (state, action) => {
//         console.log("🔍 [DEBUG] fetchUserEvents.rejected triggered");
//         state.status = STATUS.FAILED;
//         state.error = action.payload?.message || "Failed to fetch user events";
//       })

//       // FETCH ALL EVENTS
//       .addCase(eventActions.fetchAllEvents.pending, (state) => {
//         console.log("🔍 [DEBUG] fetchAllEvents.pending triggered");
//         state.allEventsStatus = STATUS.LOADING;
//         state.error = null;
//       })
//       .addCase(eventActions.fetchAllEvents.fulfilled, (state, action) => {
//         console.log("🔍 [DEBUG] fetchAllEvents.fulfilled triggered");
//         state.allEventsStatus = STATUS.SUCCEEDED;
//         state.allEvents = action.payload || [];
//         state.error = null;
//       })
//       .addCase(eventActions.fetchAllEvents.rejected, (state, action) => {
//         console.log("🔍 [DEBUG] fetchAllEvents.rejected triggered");
//         state.allEventsStatus = STATUS.FAILED;
//         state.error = action.payload?.message || "Failed to fetch all events";
//       })

//       // FETCH EVENT ANALYTICS
//       .addCase(eventActions.fetchEventAnalytics.pending, (state, action) => {
//         console.log("🔍 [DEBUG] fetchEventAnalytics.pending triggered");
//         const eventId = action.meta.arg.eventId;

//         if (!state.eventAnalytics[eventId]) {
//           state.eventAnalytics[eventId] = {
//             data: null,
//             status: STATUS.IDLE,
//             error: null,
//             fetchedAt: null,
//           };
//         }

//         state.eventAnalytics[eventId].status = STATUS.LOADING;
//         state.eventAnalytics[eventId].error = null;
//       })
//       .addCase(eventActions.fetchEventAnalytics.fulfilled, (state, action) => {
//         console.log("✅ [DEBUG] fetchEventAnalytics.fulfilled triggered");
//         const eventId = action.meta.arg.eventId;

//         state.eventAnalytics[eventId] = {
//           data: action.payload,
//           status: STATUS.SUCCEEDED,
//           error: null,
//           fetchedAt: new Date().toISOString(),
//         };

//         updateAggregatedAnalytics(state);
//       })
//       .addCase(eventActions.fetchEventAnalytics.rejected, (state, action) => {
//         console.log("❌ [DEBUG] fetchEventAnalytics.rejected triggered");
//         const eventId = action.meta.arg.eventId;

//         state.eventAnalytics[eventId] = {
//           data: null,
//           status: STATUS.FAILED,
//           error: action.payload?.message || "Failed to fetch analytics",
//           fetchedAt: null,
//         };
//       });
//   },
// });

// function calculatePotentialMetrics(state) {
//   const events = state.userEvents || [];

//   if (events.length === 0) {
//     state.aggregatedAnalytics = { ...initialState.aggregatedAnalytics };
//     return;
//   }

//   let totalCapacity = 0;
//   let potentialRevenue = 0;
//   let totalPriceSum = 0;

//   events.forEach((event) => {
//     if (event.tickets && Array.isArray(event.tickets)) {
//       event.tickets.forEach((ticket) => {
//         const quantity = ticket.quantity || 0;
//         const price = ticket.price || 0;

//         totalCapacity += quantity;
//         potentialRevenue += price * quantity;
//         totalPriceSum += price * quantity;
//       });
//     }
//   });

//   const averageTicketPrice =
//     totalCapacity > 0 ? Math.round(totalPriceSum / totalCapacity) : 0;

//   state.aggregatedAnalytics.totalCapacity = totalCapacity;
//   state.aggregatedAnalytics.potentialRevenue = potentialRevenue;
//   state.aggregatedAnalytics.averageTicketPrice = averageTicketPrice;

//   if (state.aggregatedAnalytics.totalRevenue === 0) {
//     state.aggregatedAnalytics.ticketsRemaining = totalCapacity;
//   }

//   console.log("📊 [DEBUG] Potential metrics calculated:", {
//     totalCapacity,
//     potentialRevenue,
//     averageTicketPrice,
//   });
// }

// function updateAggregatedAnalytics(state) {
//   const analyticsEntries = Object.values(state.eventAnalytics).filter(
//     (entry) => entry.status === STATUS.SUCCEEDED && entry.data
//   );

//   if (analyticsEntries.length === 0) {
//     console.log(
//       "📊 [DEBUG] No analytics data to aggregate, keeping potential metrics"
//     );
//     return;
//   }

//   let totalRevenue = 0;
//   let ticketsSold = 0;
//   let ticketsRemaining = 0;

//   analyticsEntries.forEach((entry) => {
//     const analytics = entry.data;

//     if (analytics.overview) {
//       totalRevenue += analytics.overview.totalRevenue || 0;
//       ticketsSold += analytics.overview.ticketsSold || 0;
//     }

//     if (analytics.tickets) {
//       ticketsRemaining += analytics.tickets.totalRemaining || 0;
//     }
//   });

//   state.aggregatedAnalytics.totalRevenue = totalRevenue;
//   state.aggregatedAnalytics.ticketsSold = ticketsSold;
//   state.aggregatedAnalytics.ticketsRemaining = ticketsRemaining;

//   const totalCapacity = state.aggregatedAnalytics.totalCapacity;
//   if (totalCapacity > 0) {
//     state.aggregatedAnalytics.sellThroughRate = parseFloat(
//       ((ticketsSold / totalCapacity) * 100).toFixed(2)
//     );
//   }

//   console.log("📊 [DEBUG] Aggregated analytics updated:", {
//     totalRevenue,
//     ticketsSold,
//     ticketsRemaining,
//     fromEventsCount: analyticsEntries.length,
//   });
// }

// // ============================================================================
// // EXPORTS
// // ============================================================================

// export const {
//   resetEventsState, // 🆕 Export the reset action
//   clearEventError,
//   clearAnalytics,
//   setSelectedEvent,
//   clearSelectedEvent,
//   clearCurrentEvent,
// } = eventSlice.actions;

// export default eventSlice.reducer;
