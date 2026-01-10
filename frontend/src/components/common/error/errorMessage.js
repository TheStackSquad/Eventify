//frontend/src/components/common/error/errorMessage.js
"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

export default function ErrorMessage({
  title = "Something went wrong",
  message,
  onRetry,
}) {
  if (!message) {
    return null;
  }

  return (
    <div className="min-h-[400px] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-red-500/10 p-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>

        <p className="text-gray-400 mb-6 leading-relaxed">{message}</p>

        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}