// src/components/events/filters/activeFilters.js
"use client";

import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ActiveFilters({
  searchTerm,
  selectedCategory,
  selectedLocation,
  sortBy,
  onClearSearch,
  onClearCategory,
  onClearLocation,
  onClearSort,
  onClearAll,
}) {
  const badges = [];

  if (searchTerm) {
    badges.push({
      id: "search",
      label: `"${searchTerm}"`,
      onClear: onClearSearch,
    });
  }
  if (selectedCategory !== "All") {
    badges.push({
      id: "cat",
      label: selectedCategory,
      onClear: onClearCategory,
    });
  }
  if (selectedLocation !== "All Locations") {
    badges.push({
      id: "loc",
      label: selectedLocation,
      onClear: onClearLocation,
    });
  }
  if (sortBy !== "date-asc") {
    const labels = {
      "date-desc": "Latest",
      "price-asc": "Price: Low-High",
      "price-desc": "Price: High-Low",
      location: "A-Z",
    };
    badges.push({ id: "sort", label: labels[sortBy], onClear: onClearSort });
  }

  if (badges.length === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 px-1">
      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">
        Filters:
      </span>

      <AnimatePresence>
        {badges.map((badge) => (
          <motion.button
            key={badge.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={badge.onClear}
            aria-label={`Remove filter: ${badge.label}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 border border-orange-100 rounded-lg text-sm font-bold hover:bg-orange-100 transition-all active:scale-95 group min-h-[40px]"
          >
            <span className="max-w-[120px] truncate">{badge.label}</span>
            <X className="w-4 h-4 text-orange-400 group-hover:text-orange-700" />
          </motion.button>
        ))}
      </AnimatePresence>

      <button
        onClick={onClearAll}
        className="text-sm font-bold text-gray-500 hover:text-red-600 transition-colors py-2 px-3"
      >
        Clear all
      </button>
    </div>
  );
}
