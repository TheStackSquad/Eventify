// frontend/src/components/modal/emailPreferencesModal.js

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, BellOff, Mail, CheckCircle, Loader2 } from "lucide-react";

export default function EmailPreferencesModal({
  isOpen,
  onClose,
  initialValue,
  onSave,
}) {
  const [allowReminders, setAllowReminders] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);

  // Sync with prop changes
  useEffect(() => {
    setAllowReminders(initialValue);
    setHasChanged(false);
  }, [initialValue, isOpen]);

  const handleToggle = () => {
    const newValue = !allowReminders;
    setAllowReminders(newValue);
    setHasChanged(newValue !== initialValue);
  };

  const handleSave = async () => {
    if (!hasChanged) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(allowReminders);
      // Success handled by parent component
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      // Error handled by parent component
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = useCallback(() => {
    setAllowReminders(initialValue);
    setHasChanged(false);
    onClose();
  }, [initialValue, onClose]); // 2. Dependencies for the callback

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        handleCancel();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleCancel]); // 3. Now safe to include handleCancel


  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={handleCancel}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 px-6 py-8 text-white">
                <button
                  onClick={handleCancel}
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>

                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-bold">Email Preferences</h2>
                </div>
                <p className="text-indigo-100 text-sm">
                  Manage your subscription email notifications
                </p>
              </div>

              {/* Body */}
              <div className="px-6 py-6 space-y-6">
                {/* Toggle Section */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Bell size={18} className="text-gray-700" />
                      <h3 className="font-semibold text-gray-900">
                        Subscription Reminders
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Receive email reminders 7, 3, and 1 day before your
                      subscription expires. Helps you avoid service
                      interruption.
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={handleToggle}
                    disabled={isSaving}
                    className={`
                      relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full 
                      border-2 border-transparent transition-colors duration-200 ease-in-out 
                      focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2
                      ${allowReminders ? "bg-indigo-600" : "bg-gray-200"}
                      ${isSaving ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                    role="switch"
                    aria-checked={allowReminders}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-7 w-7 transform rounded-full 
                        bg-white shadow-lg ring-0 transition duration-200 ease-in-out
                        ${allowReminders ? "translate-x-6" : "translate-x-0"}
                      `}
                    />
                  </button>
                </div>

                {/* Status Indicator */}
                <div
                  className={`
                    flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all
                    ${
                      allowReminders
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-gray-50 border-gray-200 text-gray-600"
                    }
                  `}
                >
                  {allowReminders ? (
                    <>
                      <CheckCircle size={18} className="flex-shrink-0" />
                      <span className="text-sm font-medium">
                        Reminders enabled - You&apos;ll get timely notifications
                      </span>
                    </>
                  ) : (
                    <>
                      <BellOff size={18} className="flex-shrink-0" />
                      <span className="text-sm font-medium">
                        Reminders disabled - You won&apos;t receive expiry
                        alerts
                      </span>
                    </>
                  )}
                </div>

                {/* Important Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs text-blue-800 leading-relaxed">
                    <strong className="font-semibold">Note:</strong> Payment
                    receipts and critical account notifications will always be
                    sent regardless of this setting.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanged}
                  className={`
                    px-6 py-2 text-sm font-semibold rounded-lg transition-all
                    flex items-center gap-2
                    ${
                      hasChanged && !isSaving
                        ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }
                  `}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Preferences</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
