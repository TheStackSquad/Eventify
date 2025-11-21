// frontend/src/redux/reducer/index.js

import { combineReducers } from "@reduxjs/toolkit";
import { persistReducer } from "redux-persist";

const storage =
  typeof window !== "undefined"
    ? require("redux-persist/lib/storage").default // Browser: uses localStorage
    : {
        // Server: no-op storage to fulfill the Promise API
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
// update with likeReducer

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["auth", "events"],
};


const combinedReducer = combineReducers({
  auth: authReducer,
  events: eventReducer,
  tickets: ticketReducer,
  vendors: vendorReducer,
  inquiry: inquiryReducer,
  reviews: reviewsReducer,
  passwordReset: passwordResetReducer,
  // update with likeReducer
});

const persistedReducer = persistReducer(persistConfig, combinedReducer);

export default persistedReducer;