// src/components/dashboard/DashboardQuickActions.js

import { motion } from "framer-motion";

// This component expects the 'quickActions' array to be pre-calculated
export default function DashboardQuickActions({ quickActions }) {
  // FIX: Check if quickActions is falsy (null or undefined) OR an empty array
  if (!Array.isArray(quickActions) || quickActions.length === 0) {
    return null; // Don't render if there are no actions
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-6 sm:p-8 text-white overflow-hidden relative"
    >
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -ml-24 -mb-24 pointer-events-none"></div>

      <div className="relative">
        <div className="text-center sm:text-left mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">
            Ready to Take Action?
          </h2>
          <p className="text-indigo-100 text-sm sm:text-base">
            Manage your events, view analytics, and grow your reach.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={action.label || index} // Use label for a better key if available
              onClick={action.onClick}
              className="bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-xl p-4 text-left transition-all duration-200 border border-white/20 hover:border-white/40 group focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-purple-600"
            >
              {/* Note: action.icon should be a Lucide-React component */}
              <action.icon className="h-6 w-6 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-lg mb-1">{action.label}</h3>
              <p className="text-sm text-indigo-100">{action.description}</p>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
