// frontend/src/components/common/loading/loadingSpinner.jsx (Fixed & Simplified)
import React from "react";

const LoadingSpinner = ({
  message = "Loading...",
  subMessage = "Please wait...",
  size = "md",
  color = "white", // Default to white for better visibility on blur
  className = "",
  showText = true,
}) => {
  // Size configurations - simpler approach
  const sizeClasses = {
    sm: {
      spinner: "w-12 h-12 border-3",
      text: "text-sm",
      subText: "text-xs",
    },
    md: {
      spinner: "w-16 h-16 border-3",
      text: "text-base",
      subText: "text-sm",
    },
    lg: {
      spinner: "w-20 h-20 border-4",
      text: "text-lg",
      subText: "text-base",
    },
    xl: {
      spinner: "w-24 h-24 border-4",
      text: "text-xl",
      subText: "text-lg",
    },
  };

  // Color configurations optimized for blur backgrounds
  const colorClasses = {
    white: {
      bg: "border-white/20",
      spinner: "border-t-white",
      text: "text-white",
      subtext: "text-white/80",
    },
    indigo: {
      bg: "border-indigo-500/20",
      spinner: "border-t-indigo-400",
      text: "text-indigo-100",
      subtext: "text-indigo-200",
    },
    blue: {
      bg: "border-blue-500/20",
      spinner: "border-t-blue-400",
      text: "text-blue-100",
      subtext: "text-blue-200",
    },
    green: {
      bg: "border-green-500/20",
      spinner: "border-t-green-400",
      text: "text-green-100",
      subtext: "text-green-200",
    },
    purple: {
      bg: "border-purple-500/20",
      spinner: "border-t-purple-400",
      text: "text-purple-100",
      subtext: "text-purple-200",
    },
    gray: {
      bg: "border-gray-500/20",
      spinner: "border-t-gray-300",
      text: "text-gray-200",
      subtext: "text-gray-300",
    },
  };

  const {
    spinner: spinnerSize,
    text: textSize,
    subText: subTextSize,
  } = sizeClasses[size] || sizeClasses.md;

  const {
    bg,
    spinner: spinnerColor,
    text: textColor,
    subtext: subtextColor,
  } = colorClasses[color] || colorClasses.white;

  return (
    <div className={`text-center ${className}`}>
      {/* Animated Spinner - NO background container */}
      <div className={`relative ${spinnerSize} mx-auto mb-4`}>
        {/* Background circle - transparent for blur bg */}
        <div className={`absolute inset-0 rounded-full ${bg}`}></div>
        {/* Animated spinner */}
        <div
          className={`absolute inset-0 rounded-full ${spinnerColor} animate-spin`}
        ></div>
      </div>

      {/* Loading Text */}
      {showText && (
        <>
          <h2 className={`font-bold ${textColor} mb-2 ${textSize}`}>
            {message}
          </h2>
          <p className={`${subtextColor} ${subTextSize}`}>{subMessage}</p>
        </>
      )}
    </div>
  );
};

export default LoadingSpinner;
