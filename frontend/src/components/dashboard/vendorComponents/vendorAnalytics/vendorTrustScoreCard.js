// frontend/src/components/dashboard/vendorAnalytics/vendorTrustScoreCard.js

"use client";

import React, { memo, useMemo, useCallback } from "react";
import {
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Shield,
  Award,
  Clock,
} from "lucide-react";

const VendorTrustScoreCard = memo(
  ({
    // Direct props from API - no nested data object
    score = 0,
    tier = "improving",
    isVerified = false,
    isIdentityVerified = false,
    isBusinessVerified = false,
    isFullyVerified = false,
    profileCompletion = 0,
    daysOnPlatform = 0,
    totalReviews = 0,
    accountStatus = "new",
    pvsScoreTrend = "improving",
  }) => {
    // Memoize score tier calculations
    const scoreTier = useMemo(() => {
      if (score >= 80)
        return {
          label: "Excellent",
          color: "text-green-700 bg-green-50 border-green-200",
          progress: "from-green-500 to-emerald-500",
          icon: CheckCircle,
        };
      if (score >= 60)
        return {
          label: "Good",
          color: "text-amber-700 bg-amber-50 border-amber-200",
          progress: "from-amber-500 to-orange-500",
          icon: Award,
        };
      if (score >= 40)
        return {
          label: "Fair",
          color: "text-blue-700 bg-blue-50 border-blue-200",
          progress: "from-blue-500 to-indigo-500",
          icon: TrendingUp,
        };
      return {
        label: "Needs Improvement",
        color: "text-red-700 bg-red-50 border-red-200",
        progress: "from-red-500 to-pink-500",
        icon: AlertCircle,
      };
    }, [score]);

    // Memoize verification status
    const verificationStatus = useMemo(() => {
      if (isFullyVerified)
        return {
          label: "Fully Verified",
          color: "bg-purple-100 text-purple-700 border-purple-200",
          icon: Shield,
        };
      if (isIdentityVerified && isBusinessVerified)
        return {
          label: "Verified",
          color: "bg-blue-100 text-blue-700 border-blue-200",
          icon: Shield,
        };
      if (isIdentityVerified || isBusinessVerified)
        return {
          label: "Partially Verified",
          color: "bg-amber-100 text-amber-700 border-amber-200",
          icon: AlertCircle,
        };
      return {
        label: "Not Verified",
        color: "bg-gray-100 text-gray-700 border-gray-200",
        icon: AlertCircle,
      };
    }, [isFullyVerified, isIdentityVerified, isBusinessVerified]);

    // Memoize score trend
    const trendStatus = useMemo(() => {
      const trends = {
        improving: {
          label: "↑ Improving",
          color: "text-green-600 bg-green-50",
        },
        declining: { label: "↓ Declining", color: "text-red-600 bg-red-50" },
        stable: { label: "→ Stable", color: "text-blue-600 bg-blue-50" },
      };
      return trends[pvsScoreTrend?.toLowerCase()] || trends.stable;
    }, [pvsScoreTrend]);

    // Memoize account status
    const accountStatusDisplay = useMemo(() => {
      const statuses = {
        new: { label: "New Vendor", color: "bg-indigo-100 text-indigo-700" },
        active: { label: "Active", color: "bg-green-100 text-green-700" },
        suspended: { label: "Suspended", color: "bg-red-100 text-red-700" },
        pending: { label: "Pending", color: "bg-amber-100 text-amber-700" },
      };
      return statuses[accountStatus?.toLowerCase()] || statuses.new;
    }, [accountStatus]);

    const ScoreIcon = scoreTier.icon;
    const VerificationIcon = verificationStatus.icon;

    return (
      <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-sm">
                <TrendingUp
                  className="w-5 h-5 text-indigo-600"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  PVS Trust Score
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Performance & Verification
                </p>
              </div>
            </div>

            {/* Account Status Badge - Only if available */}
            {accountStatus && (
              <span
                className={`text-[10px] font-medium px-2 py-1 rounded-full ${accountStatusDisplay.color}`}
              >
                {accountStatusDisplay.label}
              </span>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 flex-1 flex flex-col">
          {/* Score Display */}
          <div className="mb-4">
            <div className="flex items-end justify-between mb-2">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-gray-900">
                  {score}
                </span>
                <span className="text-sm font-medium text-gray-500">/100</span>
              </div>

              {/* Trend Indicator */}
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${trendStatus.color}`}
              >
                {trendStatus.label}
              </span>
            </div>

            {/* Progress Bar - Optimized for CLS */}
            <div className="relative">
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${scoreTier.progress} transition-all duration-500 ease-out`}
                  style={{ width: `${Math.min(score, 100)}%` }}
                  role="progressbar"
                  aria-valuenow={score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Trust score: ${score} out of 100`}
                />
              </div>
            </div>
          </div>

          {/* Trust Score Tier */}
          <div className="flex items-center justify-between mb-4">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${scoreTier.color}`}
            >
              <ScoreIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{scoreTier.label}</span>
            </div>

            {/* Profile Completion */}
            {profileCompletion > 0 && (
              <div className="text-right">
                <span className="text-xs font-medium text-gray-900">
                  {profileCompletion}%
                </span>
                <p className="text-[10px] text-gray-500">Profile Complete</p>
              </div>
            )}
          </div>

          {/* Verification & Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-gray-100">
            {/* Verification Status */}
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <VerificationIcon
                  className="w-3.5 h-3.5 text-gray-600"
                  aria-hidden="true"
                />
                <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                  Verification
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-semibold ${verificationStatus.color.split(" ")[0]}`}
                >
                  {verificationStatus.label}
                </span>
                {isFullyVerified && (
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                    ✓ All
                  </span>
                )}
              </div>
            </div>

            {/* Reviews Count */}
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Award
                  className="w-3.5 h-3.5 text-gray-600"
                  aria-hidden="true"
                />
                <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                  Reviews
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-gray-900">
                  {totalReviews || 0}
                </span>
                <span className="text-[10px] text-gray-500">total</span>
              </div>
            </div>

            {/* Days on Platform */}
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock
                  className="w-3.5 h-3.5 text-gray-600"
                  aria-hidden="true"
                />
                <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                  Member
                </span>
              </div>
              <span className="text-xs font-semibold text-gray-900">
                {daysOnPlatform || 0} {daysOnPlatform === 1 ? "day" : "days"}
              </span>
            </div>

            {/* Business Verification */}
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Shield
                  className="w-3.5 h-3.5 text-gray-600"
                  aria-hidden="true"
                />
                <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                  Business
                </span>
              </div>
              <span
                className={`text-xs font-semibold ${isBusinessVerified ? "text-green-600" : "text-gray-500"}`}
              >
                {isBusinessVerified ? "Verified" : "Unverified"}
              </span>
            </div>
          </div>

          {/* Last Updated - Micro-optimization */}
          <p className="text-[10px] text-gray-400 text-right mt-3 pt-2 border-t border-gray-50">
            Updated real-time
          </p>
        </div>
      </article>
    );
  },
);

// Add display name for better debugging
VendorTrustScoreCard.displayName = "VendorTrustScoreCard";

export default VendorTrustScoreCard;