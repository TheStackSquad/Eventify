// frontend/src/components/checkoutUI/saveStatusIndicator.js
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Cloud, CloudOff, Loader2 } from "lucide-react";

export default function SaveStatusIndicator({ status }) {
  const statusConfig = {
    idle: null,
    saving: {
      icon: Loader2,
      text: "Saving...",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      animate: true,
    },
    saved: {
      icon: Check,
      text: "Saved",
      color: "text-green-600",
      bgColor: "bg-green-50",
      animate: false,
    },
    error: {
      icon: CloudOff,
      text: "Save failed",
      color: "text-red-600",
      bgColor: "bg-red-50",
      animate: false,
    },
  };

  const config = statusConfig[status];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bgColor} border border-${config.color.split("-")[1]}-200`}
      >
        <Icon
          size={14}
          className={`${config.color} ${config.animate ? "animate-spin" : ""}`}
        />
        <span className={`text-xs font-semibold ${config.color}`}>
          {config.text}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

SaveStatusIndicator.displayName = "SaveStatusIndicator";
