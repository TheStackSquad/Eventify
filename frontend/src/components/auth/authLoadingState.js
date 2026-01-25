// frontend/src/components/auth/authLoadingState.js
"use client";

export default function AuthLoadingState({ message = "Loading..." }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full px-6 py-12 text-center">
        {/* Animated spinner */}
        <div className="relative mx-auto w-16 h-16 mb-6">
          <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-indigo-600 rounded-full animate-spin"></div>
        </div>

        {/* Message */}
        <p className="text-gray-600 font-medium">{message}</p>

        {/* Optional: Subtle hint */}
        <p className="text-gray-400 text-sm mt-2">
          This should only take a moment
        </p>
      </div>
    </div>
  );
}
