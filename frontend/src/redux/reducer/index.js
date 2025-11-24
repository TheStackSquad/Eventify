//frontend/src/redux/reducer/index.js
import { combineReducers } from "@reduxjs/toolkit";
import { persistReducer, createMigrate } from "redux-persist";

const storage =
  typeof window !== "undefined"
    ? require("redux-persist/lib/storage").default
    : {
        getItem: () => Promise.resolve(null),
        setItem: () => Promise.resolve(),
        removeItem: () => Promise.resolve(),
      };

import authReducer from "./authReducers";
import eventReducer from "./eventReducer";
import ticketReducer from "./ticketReducer";
import vendorReducer from "./vendorReducer";
import inquiryReducer from "./inquiryReducer";
import reviewsReducer from "./reviewReducer";
import passwordResetReducer from "./passwordResetReducer";

// ✅ ADD THIS: Migration to add eventAnalytics field
const migrations = {
  0: (state) => {
    console.log("🔄 Running migration to version 0: Adding eventAnalytics");
    return {
      ...state,
      events: {
        ...state.events,
        eventAnalytics: {},
        aggregatedAnalytics: state.events?.aggregatedAnalytics || {
          totalCapacity: 0,
          potentialRevenue: 0,
          averageTicketPrice: 0,
          totalRevenue: 0,
          ticketsSold: 0,
          ticketsRemaining: 0,
          sellThroughRate: 0,
        },
      },
    };
  },
};

const persistConfig = {
  key: "root",
  version: 0,
  storage,
  whitelist: ["auth", "events"],
  migrate: createMigrate(migrations, { debug: true }),
};

const combinedReducer = combineReducers({
  auth: authReducer,
  events: eventReducer,
  tickets: ticketReducer,
  vendors: vendorReducer,
  inquiry: inquiryReducer,
  reviews: reviewsReducer,
  passwordReset: passwordResetReducer,
});

const persistedReducer = persistReducer(persistConfig, combinedReducer);

export default persistedReducer;
