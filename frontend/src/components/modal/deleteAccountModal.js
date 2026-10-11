// frontend/src/components/modal/deleteAccountModal.js
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Trash2, Clock } from "lucide-react";
import { useEffect } from "react";

export default function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}) {
  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-gray-900 w-full max-w-md overflow-hidden rounded-2xl shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>

              <h3
                id="delete-modal-title"
                className="text-xl font-bold text-gray-900 dark:text-white mb-2"
              >
                Are you sure you want to leave?
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                We&apos;d hate to see you go. Deleting your account will remove
                access to your events and profile data.
              </p>

              {/* Grace Period Notice */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 mb-8 flex items-start gap-3 text-left">
                <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                    30-Day Recovery Period
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-500/80">
                    Your account will be queued for deletion. You can restore it
                    anytime within 30 days by signing back in.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={onConfirm}
                  disabled={isDeleting}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95 shadow-lg shadow-red-500/20"
                >
                  <Trash2 className="w-5 h-5" />
                  {isDeleting ? "Processing..." : "Delete My Account"}
                </button>
                <button
                  onClick={onClose}
                  className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium py-2 transition-colors"
                >
                  Maybe I&apos;ll stay
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
