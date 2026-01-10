// frontend/src/components/dashboard/vendorAnalytics/vendorTrustScoreCard.js
"use client";

import React from "react";
import { TrendingUp, AlertCircle, CheckCircle } from "lucide-react";

export default function VendorTrustScoreCard({ data }) {
  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 60) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  const getScoreStatus = (score) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    return "Needs Improvement";
  };

  const getScoreIcon = (score) => {
    if (score >= 80) return <CheckCircle className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
        </div>
        <span className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full">
          Trust Score
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-end gap-2 mb-2">
          <span className="text-3xl font-bold text-gray-900">{data.score}</span>
          <span className="text-sm text-gray-500">/100</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
          <div
            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full"
            style={{ width: `${data.score}%` }}
          ></div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getScoreColor(
            data.score
          )}`}
        >
          {getScoreIcon(data.score)}
          {getScoreStatus(data.score)}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{data.reviewCount} reviews</p>
          <p className="text-xs text-gray-400">Updated recently</p>
        </div>
      </div>
    </div>
  );
}
