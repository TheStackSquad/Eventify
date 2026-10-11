// frontend/src/app/events/create-events/components/enhancedUploadProgress.jsx

"use client";
import React, { useMemo, useState, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  LazyMotion,
  domAnimation,
} from "framer-motion";

// Only import icons that are actually used
import { Upload, CheckCircle, Loader2, Zap } from "lucide-react";

/**
 * Enhanced Upload Progress Overlay
 * Optimized for Lighthouse with:
 * - Reduced animation complexity
 * - Lazy-loaded animations
 * - Optimized icon loading
 * - Better accessibility
 * - Reduced layout shifts
 */
export default function EnhancedUploadProgress({
  isSubmitting,
  uploadProgress = 0,
  currentStep = "",
}) {
  const [isClient, setIsClient] = useState(false);

  // Only run animations on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Calculate which stage we're in (memoized)
  const stage = useMemo(() => {
    if (!isSubmitting) return null;
    if (uploadProgress === 100) return "finalizing";
    if (uploadProgress >= 60) return "processing";
    if (uploadProgress > 0) return "uploading";
    return "preparing";
  }, [uploadProgress, isSubmitting]);

  // Dynamic messaging based on stage (memoized)
  const message = useMemo(() => {
    if (!stage) return null;

    const messages = {
      preparing: {
        title: "Setting Things Up",
        subtitle: "Preparing your event data...",
        icon: Loader2,
        iconColor: "text-purple-600",
        bgColor: "bg-purple-100",
        estimate: "Just a moment",
      },
      uploading: {
        title: "Uploading Image",
        subtitle: "Uploading your event banner...",
        icon: Upload,
        iconColor: "text-blue-600",
        bgColor: "bg-blue-100",
        estimate: "Usually takes 3-5 seconds",
      },
      processing: {
        title: "Creating Event",
        subtitle: "Saving event details and tickets...",
        icon: Zap,
        iconColor: "text-amber-600",
        bgColor: "bg-amber-100",
        estimate: "Almost there",
      },
      finalizing: {
        title: "Finalizing",
        subtitle: "Adding finishing touches...",
        icon: CheckCircle,
        iconColor: "text-green-600",
        bgColor: "bg-green-100",
        estimate: "Just a second",
      },
    };

    return messages[stage];
  }, [stage]);

  // Don't render anything if not submitting
  if (!isSubmitting || !message) return null;

  const Icon = message.icon;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          style={{
            contain: "layout style paint", // Performance optimization
            willChange: "opacity", // Hint to browser
          }}
          role="alert"
          aria-live="polite"
          aria-label="Upload progress"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              mass: 1,
            }}
            className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-lg"
          >
            {/* Icon Section - Optimized with less animation */}
            <div className="text-center mb-5">
              <div
                className={`inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 ${message.bgColor} rounded-full mb-4`}
                aria-hidden="true"
              >
                <Icon
                  className={`w-6 h-6 md:w-8 md:h-8 ${message.iconColor}`}
                />
              </div>

              {/* Title - Static for better performance */}
              <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">
                {currentStep || message.title}
              </h3>

              {/* Subtitle */}
              <p className="text-sm text-gray-600">{message.subtitle}</p>
            </div>

            {/* Progress Bar - Simplified animation */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Progress
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {uploadProgress}%
                </span>
              </div>

              <div
                className="relative w-full h-2.5 bg-gray-200 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label={`${uploadProgress}% complete`}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500"
                  style={{
                    width: `${uploadProgress}%`,
                    transition: "width 0.3s ease-out",
                  }}
                />
              </div>
            </div>

            {/* Info Card */}
            <div
              className={`p-3 ${
                stage === "finalizing"
                  ? "bg-green-50 border border-green-200"
                  : "bg-blue-50 border border-blue-200"
              } rounded-lg`}
            >
              <p
                className={`text-xs font-medium text-center ${
                  stage === "finalizing" ? "text-green-800" : "text-blue-800"
                }`}
              >
                {stage === "finalizing" ? (
                  <>🎉 Success! Redirecting you shortly...</>
                ) : stage === "uploading" ? (
                  <>📸 Image upload in progress • Stay on this page</>
                ) : (
                  <>⚡ Please keep this window open</>
                )}
              </p>
            </div>

            {/* Estimate text */}
            <p className="text-xs text-gray-500 text-center mt-3">
              {message.estimate}
            </p>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </LazyMotion>
  );
}

/**
 * Minimal Version - Optimized for performance
 * Uses pure CSS animations, no external libraries
 */
export function MinimalUploadProgress({ isSubmitting, uploadProgress = 0 }) {
  if (!isSubmitting) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      style={{
        contain: "layout style paint",
        backdropFilter: "blur(2px)",
      }}
      role="alert"
      aria-live="polite"
    >
      <div
        className="bg-white rounded-xl p-6 max-w-sm w-full shadow-lg"
        style={{ willChange: "transform, opacity" }}
      >
        <div className="text-center mb-4">
          {/* Pure CSS spinner - no JS animation library */}
          <div
            className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            aria-hidden="true"
            style={{
              animation: "spin 0.8s linear infinite",
              willChange: "transform",
            }}
          />
          <p className="text-sm font-medium text-gray-900 mb-2">
            {uploadProgress === 100 ? "Finalizing..." : "Processing..."}
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={uploadProgress}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            className="h-full bg-blue-600"
            style={{
              width: `${uploadProgress}%`,
              transition: "width 0.3s ease-out",
            }}
          />
        </div>

        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-gray-500">Keep this window open</p>
          <p className="text-xs font-medium text-gray-700">{uploadProgress}%</p>
        </div>
      </div>

      {/* CSS Animation in global styles (should be in your global.css) */}
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin {
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * Ultra-minimal version for critical performance
 * No animations, minimal DOM, smallest bundle
 */
export function StaticUploadProgress({ isSubmitting, uploadProgress = 0 }) {
  if (!isSubmitting) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      style={{ contain: "strict" }}
    >
      <div className="bg-white rounded-lg p-4 max-w-xs w-full shadow-md">
        <div className="text-center">
          {/* Simple dots animation */}
          <div className="flex justify-center mb-3" aria-hidden="true">
            <span className="w-2 h-2 bg-blue-600 rounded-full mx-1 animate-pulse" />
            <span
              className="w-2 h-2 bg-blue-600 rounded-full mx-1 animate-pulse"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="w-2 h-2 bg-blue-600 rounded-full mx-1 animate-pulse"
              style={{ animationDelay: "0.4s" }}
            />
          </div>

          <p className="text-sm font-medium text-gray-900 mb-2">
            Processing... {uploadProgress}%
          </p>

          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>

          <p className="text-xs text-gray-500 mt-2">Please wait</p>
        </div>
      </div>
    </div>
  );
}
