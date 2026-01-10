//components/dashboard/emptyState.js
"use client";

import React from "react";
import { motion } from "framer-motion";
import { CalendarPlus } from "lucide-react";

export default function EmptyState() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-20 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-20 h-20 flex items-center justify-center rounded-full bg-gray-100 mb-6 shadow-sm">
        <CalendarPlus className="w-10 h-10 text-gray-500" />
      </div>

      <h2 className="text-2xl font-bold text-gray-800 mb-2">No Events Yet</h2>

      <p className="text-gray-500 max-w-md mb-8">
        You haven&apos;t created any events. When you do, they will appear here on
        your dashboard.
      </p>

      <a
        href="/dashboard/create"
        className="px-5 py-3 bg-indigo-600 text-white rounded-lg font-medium shadow hover:bg-indigo-700 transition-colors"
      >
        Create Your First Event
      </a>
    </motion.div>
  );
}
