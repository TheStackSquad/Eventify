//frontend/src/components/common/toast/toastProvider.js

import React from "react";
import { ToastContainer } from "react-toastify";

export default function ToastProvider() {
  return (
    <ToastContainer
      // Positioned in the top-right corner
      position="top-right"
      // Messages auto-close after 5 seconds
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      // Example of applying a theme
      theme="colored"
    />
  );
}
