// //frontend/src/redux/store.js

// import { configureStore } from "@reduxjs/toolkit";
// import {
//   persistStore,
//   FLUSH,
//   REHYDRATE,
//   PAUSE,
//   PERSIST,
//   PURGE,
//   REGISTER,
// } from "redux-persist";
// import persistedReducer from "@/redux/reducer/index";


// // Create the Redux store
// const store = configureStore({
//   // Use the persisted reducer as the root reducer
//   reducer: persistedReducer,

//   // Custom middleware to silence specific redux-persist actions warnings
//   middleware: (getDefaultMiddleware) =>
//     getDefaultMiddleware({
//       serializableCheck: {
//         ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
//       },
//     }),
//   devTools: process.env.NODE_ENV !== "production",
// });

// // Create the persistor object (used by the PersistGate component)
// export const persistor = persistStore(store);

// export default store;
