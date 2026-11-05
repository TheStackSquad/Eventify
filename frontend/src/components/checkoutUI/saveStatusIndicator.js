// frontend/src/components/checkoutUI/saveStatusIndicator.js

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, CloudOff, Loader2 } from "lucide-react";

// Static class strings so Tailwind can see them (dynamic border-${...} classes get purged).
const STATUS_CONFIG = {
  saving: {
    icon: Loader2,
    text: "Saving…",
    classes: "text-blue-700 bg-blue-50 border-blue-200",
    spin: true,
  },
  saved: {
    icon: Check,
    text: "Saved",
    classes: "text-green-700 bg-green-50 border-green-200",
  },
  error: {
    icon: CloudOff,
    text: "Couldn’t save",
    classes: "text-red-700 bg-red-50 border-red-200",
  },
  offline: {
    icon: CloudOff,
    text: "Offline · saved on this device",
    classes: "text-amber-800 bg-amber-50 border-amber-200",
  },
};

export default function SaveStatusIndicator({ status, isOffline = false }) {
  const key = isOffline ? "offline" : status;
  const config = STATUS_CONFIG[key];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        role="status"
        aria-live="polite"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.classes}`}
      >
        <Icon size={13} className={config.spin ? "animate-spin" : ""} />
        <span>{config.text}</span>
      </motion.div>
    </AnimatePresence>
  );
}

SaveStatusIndicator.displayName = "SaveStatusIndicator";