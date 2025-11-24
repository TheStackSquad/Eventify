// frontend/src/components/modal/analytics/shared/StatCard.js

import React from "react";
import { TrendingUp } from "lucide-react";

export default function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = "bg-gray-50 text-gray-600",
  trend,
  highlight,
  progress,
}) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-xl p-5 
        ${color} 
        shadow-md hover:shadow-xl 
        transition-all duration-300 
        transform hover:-translate-y-1
        border-2 border-transparent hover:border-current/20
      `}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative">
        {/* Icon and Trend */}
        <div className="flex items-start justify-between mb-3">
          <div className={`p-3 rounded-xl ${color} bg-opacity-80 shadow-md`}>
            <Icon className="w-6 h-6" />
          </div>

          {trend && (
            <div className="flex items-center gap-1 text-xs font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Active</span>
            </div>
          )}

          {highlight && (
            <div className="flex items-center gap-1 text-xs font-semibold">
              <span className="text-lg">🔥</span>
            </div>
          )}
        </div>

        {/* Label */}
        <h3 className="text-sm font-medium opacity-90 mb-1">{label}</h3>

        {/* Value */}
        <p className="text-3xl font-bold mb-1 tracking-tight break-words">
          {value}
        </p>

        {/* Subtext */}
        {subtext && <p className="text-xs opacity-75 font-medium">{subtext}</p>}

        {/* Progress Bar (optional) */}
        {progress != null && (
          <div className="mt-3">
            <div className="w-full bg-white/30 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-current h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Decorative element */}
      <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/10 blur-2xl pointer-events-none" />
    </div>
  );
}
