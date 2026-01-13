// frontend/src/components/onboarding/feedback/feedbackModal.js
"use client";

import { motion, AnimatePresence } from "framer-motion";
import FeedbackHeader from "@/components/onboarding/feedback/components/feedbackHeader";
import FeedbackForm from "@/components/onboarding/feedback/components/feedbackForm";
import useFeedbackForm from "@/components/onboarding/feedback/hooks/useFeedbackForm";

/**
 * Main Feedback Modal Wrapper
 * Handles overlay animation and modal container
 */
export default function FeedbackModal({ isOpen, onClose }) {
  const { formState, actions, submission } = useFeedbackForm(onClose);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <FeedbackHeader
              onClose={onClose}
              isSubmitting={submission.isSubmitting}
            />
            <FeedbackForm
              formState={formState}
              actions={actions}
              submission={submission}
              onClose={onClose}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
