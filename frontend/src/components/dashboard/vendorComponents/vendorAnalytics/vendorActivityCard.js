// frontend/src/components/dashboard/vendorAnalytics/vendorActivityCard.js

"use client";

import React, { memo } from "react";
import {
  Calendar,
  MapPin,
  Clock,
  TrendingUp,
  Users,
  Award,
  Shield,
} from "lucide-react";

const VendorActivityCard = memo(
  ({
    // Basic vendor info
    vendorName,
    category,
    profileCompletion,
    isVerified,
    profileViews,

    // Performance metrics
    daysOnPlatform,
    accountStatus,
    lastProfileUpdate,

    // Trends data
    last7Days,
    pvsScoreTrend,

    // Optional with defaults
    location = "Not specified",
    createdAt,
    totalReviews = 0,
    averageRating = 0,
  }) => {
    // Memoized date formatting to prevent recalculation
    const formatDate = React.useCallback((dateString) => {
      if (!dateString || dateString === "0001-01-01T00:00:00Z")
        return "Recently";

      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return "Unknown";
      }
    }, []);

    // Memoized status color mapping
    const getStatusColor = React.useCallback((status) => {
      const colors = {
        new: "bg-green-100 text-green-700 border-green-200",
        active: "bg-blue-100 text-blue-700 border-blue-200",
        suspended: "bg-red-100 text-red-700 border-red-200",
        pending: "bg-amber-100 text-amber-700 border-amber-200",
      };
      return (
        colors[status?.toLowerCase()] ||
        "bg-gray-100 text-gray-700 border-gray-200"
      );
    }, []);

    // Calculate days since last update
    const daysSinceUpdate = React.useMemo(() => {
      if (!lastProfileUpdate || lastProfileUpdate === "0001-01-01T00:00:00Z")
        return 0;
      const updateDate = new Date(lastProfileUpdate);
      const now = new Date();
      const diffTime = Math.abs(now - updateDate);
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }, [lastProfileUpdate]);

    return (
      <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        {/* Header Section */}
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {vendorName || "Vendor Profile"}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-600 truncate">
                  {category || "General"}
                </span>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
                    <Shield className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
            </div>

            {/* Profile Completion Badge - Optimized for Core Web Vitals */}
            <div
              className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm"
              aria-label={`Profile ${profileCompletion || 0}% complete`}
            >
              <span className="text-lg font-bold text-white">
                {profileCompletion || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Main Content - Grid Layout for better performance */}
        <div className="p-5 space-y-4">
          {/* Account Status Badge */}
          {accountStatus && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Account Status
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(accountStatus)}`}
              >
                {accountStatus.charAt(0).toUpperCase() + accountStatus.slice(1)}
              </span>
            </div>
          )}

          {/* Metrics Grid - Optimized with CSS Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Days on Platform */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-xs font-medium">Member</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {daysOnPlatform || 0} days
              </p>
            </div>

            {/* Profile Views */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-xs font-medium">Views</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {profileViews?.toLocaleString() || 0}
              </p>
            </div>

            {/* Location */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-xs font-medium">Location</span>
              </div>
              <p
                className="text-sm font-semibold text-gray-900 truncate"
                title={location}
              >
                {location}
              </p>
            </div>

            {/* Last Update */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-xs font-medium">Updated</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {daysSinceUpdate === 0 ? "Today" : `${daysSinceUpdate}d ago`}
              </p>
            </div>
          </div>

          {/* Reviews Summary - Conditionally rendered */}
          {(totalReviews > 0 || averageRating > 0) && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Reviews & Rating</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-gray-900">
                        {averageRating.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-500">/ 5.0</span>
                      <span className="text-xs text-gray-500 ml-1">
                        ({totalReviews}{" "}
                        {totalReviews === 1 ? "review" : "reviews"})
                      </span>
                    </div>
                  </div>
                </div>

                {/* PVS Score Trend Indicator */}
                {pvsScoreTrend && (
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      pvsScoreTrend === "improving"
                        ? "bg-green-100 text-green-700"
                        : pvsScoreTrend === "declining"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {pvsScoreTrend}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 7-Day Activity Stats - Lightweight */}
          {last7Days && (
            <div className="pt-2">
              <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Last 7 Days Activity
              </h4>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-600">Inquiries:</span>
                  <span className="ml-1 font-semibold text-gray-900">
                    {last7Days.inquiryCount || 0}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Reviews:</span>
                  <span className="ml-1 font-semibold text-gray-900">
                    {last7Days.newReviews || 0}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Rating:</span>
                  <span className="ml-1 font-semibold text-gray-900">
                    {last7Days.averageRating?.toFixed(1) || 0}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </article>
    );
  },
);

// Add display name for better debugging
VendorActivityCard.displayName = "VendorActivityCard";

export default VendorActivityCard;