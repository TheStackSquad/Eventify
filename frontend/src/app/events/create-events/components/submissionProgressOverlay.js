// frontend/src/app/events/create-events/components/submissionProgressOverlay.js
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Save, CheckCircle, AlertCircle } from "lucide-react";

export default function SubmissionProgressOverlay({
  isSubmitting,
  uploadProgress,
  currentStep,
}) {
  const steps = {
    "Uploading image...": { icon: Upload, color: "text-blue-500" },
    "Creating event...": { icon: Save, color: "text-green-500" },
    "Updating event...": { icon: Save, color: "text-yellow-500" },
    "Success!": { icon: CheckCircle, color: "text-emerald-500" },
  };

  const stepConfig = steps[currentStep] || {
    icon: AlertCircle,
    color: "text-gray-500",
  };
  const StepIcon = stepConfig.icon;

  return (
    <AnimatePresence>
      {isSubmitting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
          >
            <div className="text-center">
              {/* Animated icon container */}
              <motion.div
                animate={{
                  rotate: currentStep === "Uploading image..." ? 360 : 0,
                }}
                transition={{
                  duration: 2,
                  repeat: currentStep === "Uploading image..." ? Infinity : 0,
                  ease: "linear",
                }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center mx-auto mb-6"
              >
                <StepIcon className={`w-10 h-10 ${stepConfig.color}`} />
              </motion.div>

              {/* Progress text */}
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <h3 className="text-xl font-semibold text-white mb-2">
                  {currentStep}
                </h3>
                <p className="text-gray-400 text-sm">
                  {uploadProgress < 100
                    ? "Please wait while we process your event..."
                    : "Almost done!"}
                </p>
              </motion.div>

              {/* Progress bar with glow effect */}
              <div className="relative mb-2">
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    className={`h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 ${
                      uploadProgress === 100 ? "animate-pulse" : ""
                    }`}
                  />
                </div>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <motion.div
                    animate={{ x: ["0%", "100%"] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="absolute top-0 h-3 w-4 bg-white/30 blur-sm"
                  />
                )}
              </div>

              {/* Percentage and status */}
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-gray-400">
                  {uploadProgress}% complete
                </span>
                <motion.span
                  animate={uploadProgress === 100 ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className={`text-sm font-medium ${
                    uploadProgress === 100
                      ? "text-emerald-400"
                      : "text-blue-400"
                  }`}
                >
                  {uploadProgress === 100 ? "Ready!" : "Processing..."}
                </motion.span>
              </div>

              {/* Loading dots animation */}
              {uploadProgress < 100 && (
                <div className="flex justify-center mt-6 space-x-2">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ y: [0, -8, 0] }}
                      transition={{
                        duration: 0.6,
                        delay: i * 0.1,
                        repeat: Infinity,
                      }}
                      className="w-2 h-2 bg-blue-400 rounded-full"
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
