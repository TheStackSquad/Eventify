// frontend/src/components/dashboard/vendorAnalytics/vendorActivityCard.js
"use client";

import React from "react";
import { Calendar, MapPin, Clock, TrendingUp, Users } from "lucide-react";

export default function VendorActivityCard({ basicInfo, metrics }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        Vendor Profile
      </h3>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Member Since</p>
            <p className="font-medium text-gray-900">
              {formatDate(basicInfo.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <MapPin className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Location</p>
            <p className="font-medium text-gray-900">{basicInfo.location}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg">
            <Users className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Reviews</p>
            <p className="font-medium text-gray-900">{metrics.totalReviews}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-lg">
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Average Rating</p>
            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-900">
                {metrics.averageRating.toFixed(1)}
              </span>
              <span className="text-xs text-gray-500">/ 5.0</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Performance Trends
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-600">Response Rate</p>
            <p className="font-semibold text-green-600">92%</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-600">Engagement</p>
            <p className="font-semibold text-blue-600">High</p>
          </div>
        </div>
      </div>
    </div>
  );
}
