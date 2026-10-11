//frontend/src/redux/reduxProvider.js

"use client";

import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import store, { persistor } from "@/redux/store";

export default function ReduxProvider({ children }) {
  return (
    // 1. Provider gives components access to the store
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
}
