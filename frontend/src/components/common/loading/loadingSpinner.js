// frontend/src/components/common/loading/loadingSpinner.js

import React from "react";

const LoadingSpinner = ({
  message = "Loading events...",
  subMessage = "Please wait while we fetch the latest updates",
  size = "md",
  color = "white",
  className = "",
  showText = true,
}) => {
  const sizeClasses = {
    sm: { spinner: "w-8 h-8 border-2", text: "text-sm" },
    md: { spinner: "w-12 h-12 border-4", text: "text-base" },
    lg: { spinner: "w-16 h-16 border-4", text: "text-lg" },
    xl: { spinner: "w-20 h-20 border-8", text: "text-xl" },
  };

  const colorClasses = {
    white: {
      border: "border-white/20",
      top: "border-t-white",
      text: "text-white",
    },
    blue: {
      border: "border-blue-500/20",
      top: "border-t-blue-500",
      text: "text-blue-500",
    },
    // ... add others as needed
  };

  const selectedSize = sizeClasses[size] || sizeClasses.md;
  const selectedColor = colorClasses[color] || colorClasses.white;

  return (
    /* This wrapper ensures it's centered in the middle of the screen */
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm ${className}`}
    >
      <div className="relative flex flex-col items-center">
        {/* The Actual Spinner */}
        <div
          className={`
            ${selectedSize.spinner} 
            ${selectedColor.border} 
            ${selectedColor.top} 
            rounded-full animate-spin mb-4
          `}
        ></div>

        {/* Loading Text */}
        {showText && (
          <div className="text-center">
            <h2
              className={`font-semibold ${selectedColor.text} ${selectedSize.text}`}
            >
              {message}
            </h2>
            {subMessage && (
              <p className="text-gray-400 text-sm mt-1">{subMessage}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;