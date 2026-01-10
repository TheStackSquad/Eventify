// src/components/dashboard/dashboardEmptyState.js
"use client";

import React from "react";
import { Calendar } from "lucide-react";

export default function EventsEmptyState() {
  return (
    <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-indigo-50 rounded-xl border-2 border-dashed border-gray-300">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Calendar className="w-10 h-10 text-indigo-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Events Yet</h3>
        <p className="text-gray-600 mb-1">
          Start creating amazing events and reach thousands of attendees!
        </p>
        <p className="text-sm text-gray-500">
          Click{" "}
          <span className="font-semibold text-indigo-600">
            &quot;New Event&quot;
          </span>{" "}
          to get started.
        </p>
      </div>
    </div>
  );
}
