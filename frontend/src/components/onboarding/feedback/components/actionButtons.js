// frontend/src/components/onboarding/feedback/components/actionButtons.js
import { Send } from "lucide-react";
import { motion } from "framer-motion";

export default function ActionButtons({
  onClose,
  onSubmit,
  isSubmitting,
  uploadProgress,
}) {
  return (
    <div className="flex gap-3 pt-6">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isSubmitting}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:from-purple-700 hover:to-indigo-700 transition-all"
      >
        {isSubmitting ? (
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                repeat: Infinity,
                duration: 1,
                ease: "linear",
              }}
              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
            />
            <span className="text-sm">
              {uploadProgress > 0 ? `${uploadProgress}%` : "Submitting..."}
            </span>
          </div>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Submit Feedback
          </>
        )}
      </button>
    </div>
  );
}
