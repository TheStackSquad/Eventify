// frontend/src/components/create-events/utils/loadingState.js

export default function LoadingState({
  title = "Loading Event Details",
  message = "Please wait while we prepare your form...",
  showProgress = false,
  progress = 0,
}) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        {/* Spinner - Single CSS animation */}
        <div className="relative inline-block mb-6">
          <div className="w-16 h-16 border-4 border-gray-800 border-t-green-500 rounded-full animate-spin" />
          {/* Inner glow effect */}
          <div
            className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-green-400/30 rounded-full animate-spin"
            style={{ animationDuration: "1.5s" }}
          />
        </div>

        {/* Title - No animation for better performance */}
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>

        {/* Message - Static text */}
        <p className="text-sm text-gray-400 mb-6">{message}</p>

        {/* Optional Progress Bar - Pure CSS */}
        {showProgress && (
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}

        {/* Subtle hint - No animation */}
        <p className="text-xs text-gray-500 mt-4">
          This should only take a moment
        </p>
      </div>

      {/* 
        IMPORTANT: No @keyframes needed - using Tailwind's animate-spin
        This is the most performant option for Lighthouse
      */}
    </div>
  );
}

export function InlineLoadingState({ message = "Loading..." }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-8 h-8 border-3 border-gray-700 border-t-green-500 rounded-full animate-spin mr-3" />
      <span className="text-gray-400 text-sm">{message}</span>
    </div>
  );
}


export function FormSkeleton() {
  return (
    <div className="space-y-6 p-8 animate-pulse">
      {/* Title skeleton */}
      <div className="h-10 bg-gray-800 rounded w-3/4" />

      {/* Description skeleton */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-800 rounded" />
        <div className="h-4 bg-gray-800 rounded w-5/6" />
      </div>

      {/* Form fields skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-12 bg-gray-800 rounded" />
        <div className="h-12 bg-gray-800 rounded" />
      </div>

      {/* Image skeleton */}
      <div className="h-48 bg-gray-800 rounded" />
    </div>
  );
}
