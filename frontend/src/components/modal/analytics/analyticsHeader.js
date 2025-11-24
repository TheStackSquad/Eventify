// frontend/src/components/modal/analytics/analyticsHeader.js

import React from "react";
import { X, BarChart3 } from "lucide-react";
import { getStatusBadge } from "./utils/analyticsHelpers";

export default function AnalyticsHeader({ eventTitle, status, onClose }) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
            <BarChart3 className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
              {eventTitle}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-600">Sales Analytics</p>
              {status && getStatusBadge(status)}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
