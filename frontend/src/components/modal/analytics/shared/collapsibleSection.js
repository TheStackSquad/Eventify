// frontend/src/components/modal/analytics/shared/collapsibleSection.js

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export default function CollapsibleSection({
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
  badge,
  color = "text-gray-700",
}) {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors">
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className={`h-5 w-5 ${color}`} />}
          <h4 className="text-base sm:text-lg font-bold text-gray-900">
            {title}
          </h4>
          {badge && (
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
              {badge}
            </span>
          )}
        </div>

        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-gray-500" />
        </motion.div>
      </button>

      {/* Section Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
