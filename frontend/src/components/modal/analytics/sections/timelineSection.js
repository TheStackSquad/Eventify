// frontend/src/components/modal/analytics/sections/timelineSection.js

import React, { useMemo } from "react";
import { TrendingUp, Calendar } from "lucide-react";
import CollapsibleSection from "../shared/collapsibleSection";
// Assuming formatCurrency is imported but not shown in this snippet

export default function TimelineSection({ timeline, isExpanded, onToggle }) {
  
  // --- All Hooks must be called unconditionally at the top level ---
  
  // Calculate peak day
  const peakDay = useMemo(() => {
    // Provide a safe default object if the timeline is empty.
    if (!timeline || timeline.length === 0) {
        return { ticketsSold: 0, date: new Date().toISOString() };
    }
    
    // The reduce function is now safe because we checked for length > 0
    return timeline.reduce(
      (max, day) => (day.ticketsSold > max.ticketsSold ? day : max),
      timeline[0] // Since timeline.length > 0, timeline[0] is guaranteed to exist.
    );
  }, [timeline]);

  // Calculate average daily sales
  const avgDailySales = useMemo(() => {
    // Provide a safe default of 0 if the timeline is empty.
    if (!timeline || timeline.length === 0) {
        return 0;
    }
    const total = timeline.reduce((sum, day) => sum + day.ticketsSold, 0);
    return Math.round(total / timeline.length);
  }, [timeline]);
  
  // --- Now the conditional return is safe ---
  if (!timeline || timeline.length === 0) return null;


  return (
    <CollapsibleSection
      title="Sales Timeline"
      icon={TrendingUp}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={`${timeline.length} days`}
      color="text-blue-600"
    >
      <div className="space-y-6">
        {/* Timeline Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-medium text-gray-600">Peak Day</p>
            </div>
            <p className="text-2xl font-bold text-blue-700 mb-1">
              {peakDay.ticketsSold} tickets
            </p>
            <p className="text-sm text-gray-600">
              {new Date(peakDay.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <p className="text-sm font-medium text-gray-600">Daily Average</p>
            </div>
            <p className="text-2xl font-bold text-purple-700 mb-1">
              {avgDailySales} tickets
            </p>
            <p className="text-sm text-gray-600">Per day</p>
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
          <h5 className="text-base font-bold text-gray-900 mb-4">
            Daily Sales Progress
          </h5>

          {/* Simple Bar Chart */}
          <div className="space-y-2">
            {timeline.slice(-14).map((day, index) => (
              <TimelineBar
                key={index}
                day={day}
                maxValue={peakDay.ticketsSold}
              />
            ))}
          </div>

          {timeline.length > 14 && (
            <p className="text-xs text-gray-500 text-center mt-4">
              Showing last 14 days • {timeline.length} days total
            </p>
          )}
        </div>

        {/* Cumulative Progress */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <h5 className="text-base font-bold text-gray-900 mb-4">
            Cumulative Sales
          </h5>

          <div className="space-y-3">
            {timeline.slice(-7).map((day, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <span className="text-sm font-medium text-gray-700">
                  {new Date(day.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    {day.cumulativeSold} total
                  </p>
                  <p className="text-xs text-gray-500">
                    +{day.ticketsSold} that day
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

const TimelineBar = ({ day, maxValue }) => {
  const percentage = maxValue > 0 ? (day.ticketsSold / maxValue) * 100 : 0;
  const isPeakDay = day.ticketsSold === maxValue;

  return (
    <div className="group">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-600 w-20 flex-shrink-0">
          {new Date(day.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>

        <div className="flex-1 relative">
          <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
            <div
              className={`h-8 rounded-full transition-all duration-700 flex items-center justify-end pr-2 ${
                isPeakDay
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
              style={{ width: `${percentage}%` }}
            >
              <span className="text-xs font-bold text-white leading-none whitespace-nowrap">
                {day.ticketsSold > 0 ? day.ticketsSold : ""}
              </span>
            </div>
          </div>

          {/* Tooltip-like element for when the bar is very small or for hover */}
          {percentage < 15 && day.ticketsSold > 0 && (
            <div
              className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 
                               bg-white border border-gray-300 rounded-md px-2 py-1 shadow-md 
                               text-xs font-bold text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {day.ticketsSold}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};