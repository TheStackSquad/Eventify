// frontend/src/components/dashboard/vendorComponents/vendorAnalytics/vendorAnalyticsDashboard.js

"use client";

import React, { useState } from "react";
import {
  Download,
  Eye,
  MessageSquare,
  Star,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Edit,
} from "lucide-react";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import EmptyAnalyticsState from "./emptyAnalyticsState";
import VendorTrustScoreCard from "./vendorTrustScoreCard";
import VendorReviewsCard from "./vendorReviewsCard";
import VendorInquiriesCard from "./vendorInquiriesCard";
import VendorActivityCard from "./vendorActivityCard";
import { useVendorAnalytics } from "@/utils/hooks/useVendorAnalytics";

// ✅ UPDATED: Accept vendorId prop
export default function VendorAnalyticsDashboard({
  vendorId,
  userId,
  userEmail,
  onViewChange,
}) {
  const [timeRange, setTimeRange] = useState("7days");

  console.log("📊 [VendorAnalyticsDashboard] Props", {
    vendorId,
    userId,
    userEmail,
  });

  // ✅ FIXED: Use vendorId instead of userId
  const {
    data: vendorData,
    isLoading,
    isError,
    error,
    refetch,
  } = useVendorAnalytics(vendorId);

  // ================================================================
  // RENDER: Loading State
  // ================================================================
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
        <LoadingSpinner
          message="Loading your analytics..."
          subMessage="Gathering insights from your profile"
          size="md"
          color="indigo"
        />
      </div>
    );
  }

  // ================================================================
  // RENDER: Error State
  // ================================================================
  if (isError) {
    console.error("❌ [VendorAnalyticsDashboard] Error loading analytics", {
      error,
      vendorId,
    });

    return (
      <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 bg-white rounded-2xl shadow-sm border border-red-100 text-center mx-4">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
          <AlertCircle size={28} />
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
          Failed to Load Analytics
        </h3>
        <p className="text-sm sm:text-base text-gray-500 max-w-sm mb-4 px-4">
          {error?.message ||
            "We couldn't fetch your analytics data. Please try again."}
        </p>
        <button
          onClick={() => refetch()}
          className="px-6 sm:px-8 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          Retry
        </button>
      </div>
    );
  }

  // ================================================================
  // RENDER: Empty State (New Vendor)
  // ================================================================
  const hasNoActivity =
    vendorData &&
    (vendorData.overview?.totalInquiries === 0 ||
      vendorData.overview?.totalViews === 0);

  if (hasNoActivity) {
    return (
      <EmptyAnalyticsState
        userEmail={userEmail}
        vendorName={vendorData?.vendorName}
      />
    );
  }

  // ================================================================
  // RENDER: Full Dashboard (Has Data)
  // ================================================================
  const currentTrends =
    timeRange === "7days"
      ? vendorData?.trends?.last7Days
      : vendorData?.trends?.last30Days;

  const viewsTrend = "+12.5%"; // TODO: Calculate from actual data

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 px-4 sm:px-0">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Business Overview
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {vendorData.vendorName} •{" "}
            <span className="text-indigo-600 font-medium">
              {vendorData.category}
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex p-1 bg-gray-100 rounded-xl">
            {["7days", "30days"].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 text-xs font-bold rounded-lg transition-all ${
                  timeRange === range
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {range === "7days" ? "7D" : "30D"}
              </button>
            ))}
          </div>

          {/* 🆕 EDIT PROFILE BUTTON */}
          {onViewChange && (
            <button
              onClick={() => onViewChange("vendor-register")}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              title="Edit your vendor profile"
            >
              <Edit size={16} />
              <span className="hidden sm:inline">Edit Profile</span>
            </button>
          )}

          {/* Download Button */}
          <button
            onClick={() => alert("Download feature coming soon!")}
            className="p-2.5 text-gray-500 hover:text-indigo-600 bg-white border border-gray-200 rounded-xl transition-colors self-end sm:self-auto"
            title="Download analytics report"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* High-Level Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <VendorTrustScoreCard
          // Core trust score data
          score={vendorData.overview.currentPvsScore}
          tier={vendorData.performance.pvsScoreTrend}
          pvsScoreTrend={vendorData.performance.pvsScoreTrend}
          // Verification status
          isVerified={vendorData.overview.isVerified}
          isIdentityVerified={vendorData.overview.isIdentityVerified}
          isBusinessVerified={vendorData.overview.isBusinessVerified}
          isFullyVerified={vendorData.overview.isFullyVerified}
          // Additional metrics
          profileCompletion={vendorData.overview.profileCompletion}
          totalReviews={vendorData.reviews.totalReviews}
          daysOnPlatform={vendorData.performance.daysOnPlatform}
          accountStatus={vendorData.performance.accountStatus}
        />

        <StatCard
          icon={<Eye className="text-blue-600" size={20} />}
          bg="bg-blue-50"
          label="Profile Views"
          value={vendorData.overview.totalViews.toLocaleString()}
          trend={viewsTrend}
          trendType="up"
          subLabel="Total visibility"
        />

        <StatCard
          icon={<MessageSquare className="text-purple-600" size={20} />}
          bg="bg-purple-50"
          label="Inquiries"
          value={currentTrends?.inquiryCount || 0}
          trend={vendorData.inquiries.inquiryTrend}
          trendType="up"
          subLabel={`Last ${timeRange === "7days" ? "7" : "30"} days`}
        />

        <StatCard
          icon={<Star className="text-amber-600" size={20} />}
          bg="bg-amber-50"
          label="New Reviews"
          value={currentTrends?.newReviews || 0}
          trend="Active"
          trendType="stable"
          subLabel={`Avg: ${currentTrends?.averageRating?.toFixed(1) || 0} ⭐`}
        />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <VendorReviewsCard
            // Reviews data from API
            reviews={vendorData.reviews.recentReviews}
            totalReviews={vendorData.reviews.totalReviews}
            averageRating={vendorData.reviews.averageRating}
            ratingDistribution={vendorData.reviews.ratingDistribution}
            approvedReviews={vendorData.reviews.approvedReviews}
            pendingReviews={vendorData.reviews.pendingReviews}
            sentimentTrend={vendorData.reviews.sentimentTrend}
            timeRange={timeRange}
          />
          <VendorInquiriesCard
            inquiries={vendorData.inquiries.recentInquiries}
            inquiryTrend={vendorData.inquiries.inquiryTrend}
          />
        </div>

        <div className="space-y-4 sm:space-y-6">
          <VendorActivityCard
            // Basic vendor info
            vendorName={vendorData.vendorName}
            category={vendorData.category}
            profileCompletion={vendorData.overview.profileCompletion}
            isVerified={vendorData.performance.isIdentityVerified}
            profileViews={vendorData.overview.totalViews}
            // Performance metrics
            daysOnPlatform={vendorData.performance.daysOnPlatform}
            accountStatus={vendorData.performance.accountStatus}
            lastProfileUpdate={vendorData.performance.lastProfileUpdate}
            // Trends data
            last7Days={vendorData.trends.last7Days}
            pvsScoreTrend={vendorData.performance.pvsScoreTrend}
            // Optional - from reviews data
            totalReviews={vendorData.reviews.totalReviews}
            averageRating={vendorData.reviews.averageRating}
            // Optional - you'll need to add these to your API or set defaults
            location="Lagos, Nigeria" // Default or from vendor profile
            createdAt={vendorData.performance?.createdAt} // Add to API if needed
          />
        </div>
      </div>
    </div>
  );
}

// ================================================================
// STAT CARD COMPONENT
// ================================================================
function StatCard({ icon, bg, label, value, trend, trendType, subLabel }) {
  const getTrendIcon = () => {
    if (trendType === "up") return <TrendingUp className="w-3 h-3" />;
    if (trendType === "down") return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (trendType === "up") return "bg-green-50 text-green-700";
    if (trendType === "down") return "bg-red-50 text-red-700";
    return "bg-gray-50 text-gray-700";
  };

  return (
    <article className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className={`p-2 sm:p-2.5 ${bg} rounded-xl`}>{icon}</div>
        <span
          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${getTrendColor()}`}
        >
          {getTrendIcon()}
          {trend}
        </span>
      </div>
      <h3 className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
        {label}
      </h3>
      <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
        {value}
      </p>
      <p className="text-[10px] sm:text-[11px] text-gray-500 mt-1">
        {subLabel}
      </p>
    </article>
  );
}