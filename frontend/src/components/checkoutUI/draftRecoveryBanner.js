// frontend/src/components/checkoutUI/draftRecoveryBanner.js
"use client";

import { motion } from "framer-motion";
import { RotateCcw, X } from "lucide-react";

export default function DraftRecoveryBanner({ onRestore, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <RotateCcw className="text-blue-600" size={20} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-gray-900 mb-1">
              Resume Your Checkout
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              We found your previous checkout information. Would you like to
              continue where you left off?
            </p>

            <div className="flex gap-2">
              <button
                onClick={onRestore}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm"
              >
                <RotateCcw size={14} />
                Restore My Info
              </button>

              <button
                onClick={onDismiss}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-all"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
      </div>
    </motion.div>
  );
}

DraftRecoveryBanner.displayName = "DraftRecoveryBanner";
