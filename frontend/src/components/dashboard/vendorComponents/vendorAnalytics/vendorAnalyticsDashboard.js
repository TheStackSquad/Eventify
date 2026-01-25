"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  Eye,
  MessageSquare,
  Star,
  LayoutDashboard,
  AlertCircle,
} from "lucide-react";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import VendorTrustScoreCard from "./vendorTrustScoreCard";
import VendorReviewsCard from "./vendorReviewsCard";
import VendorInquiriesCard from "./vendorInquiriesCard";
import VendorActivityCard from "./vendorActivityCard";

// NOTE: In production, MOCK_VENDOR_DATA would be replaced by your actual API response.

export default function VendorAnalyticsDashboard({
  userId,
  onNavigateToRegister,
}) {
  const [loading, setLoading] = useState(true);
  const [vendorData, setVendorData] = useState(null);
  const [timeRange, setTimeRange] = useState("7days");

  useEffect(() => {
    /**
     * Fetches vendor-specific analytics.
     * The userId prop acts as the single source of truth for the request.
     */
    const fetchVendorData = async () => {
      if (!userId) return;

      setLoading(true);
      try {
        // --- 🚀 FUTURE API CALL ---
        // const response = await frontendInstance.get(`/api/vendor/analytics/${userId}`);
        // setVendorData(response.data);

        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate lag
        // For now, we assume this user has a profile for testing
        // setVendorData(MOCK_VENDOR_DATA);
      } catch (error) {
        console.error("❌ Error fetching vendor analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVendorData();
  }, [userId]);

  // --- Handlers ---
  const handleTimeRangeChange = (range) => setTimeRange(range);

  // --- Render: Loading State ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner
          message="Analyzing performance..."
          subMessage="Syncing your latest inquiries and reviews"
          size="md"
          color="indigo"
        />
      </div>
    );
  }

  // --- Render: Missing Profile State (Call to Action) ---
  if (!vendorData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl shadow-sm border border-gray-100 text-center">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
          <LayoutDashboard size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Activate Your Vendor Dashboard
        </h3>
        <p className="text-gray-500 max-w-sm mb-8">
          It looks like you haven&apos;t set up a vendor profile yet. Register
          your business to start tracking profile views and managing bookings.
        </p>
        <button
          onClick={onNavigateToRegister}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          Get Started Now
        </button>
      </div>
    );
  }

  // --- Render: Main Dashboard ---
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Business Overview
          </h2>
          <p className="text-sm text-gray-500">
            {vendorData.basicInfo.name} •{" "}
            <span className="text-indigo-600 font-medium">
              {vendorData.basicInfo.category}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-gray-100 rounded-xl">
            {["7days", "30days", "all"].map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  timeRange === range
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {range === "7days" ? "7D" : range === "30days" ? "30D" : "All"}
              </button>
            ))}
          </div>
          <button className="p-2.5 text-gray-500 hover:text-indigo-600 bg-white border border-gray-200 rounded-xl transition-colors">
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Grid: High-Level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <VendorTrustScoreCard data={vendorData.trustScore} />

        {/* Profile Views Card */}
        <StatCard
          icon={<Eye className="text-blue-600" size={20} />}
          bg="bg-blue-50"
          label="Profile Views"
          value={vendorData.basicInfo.profileViews.toLocaleString()}
          trend="+12.5%"
          subLabel="Total visibility"
        />

        {/* Inquiries Card */}
        <StatCard
          icon={<MessageSquare className="text-purple-600" size={20} />}
          bg="bg-purple-50"
          label="Inquiries"
          value={vendorData.metrics.inquiryCountLast7Days}
          trend={`+${vendorData.metrics.inquiryCountLast7Days}`}
          subLabel="Last 7 days"
        />

        {/* Reviews Card */}
        <StatCard
          icon={<Star className="text-amber-600" size={20} />}
          bg="bg-amber-50"
          label="New Reviews"
          value={vendorData.metrics.reviewCountLast7Days}
          trend="Active"
          subLabel="Customer feedback"
        />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <VendorReviewsCard
            reviews={vendorData.recentReviews}
            metrics={vendorData.metrics}
          />
          <VendorInquiriesCard inquiries={vendorData.recentInquiries} />
        </div>
        <div className="space-y-6">
          <VendorActivityCard
            basicInfo={vendorData.basicInfo}
            metrics={vendorData.metrics}
          />
          {/* Performance Summary UI... */}
        </div>
      </div>
    </div>
  );
}

// Reusable Stat Component
function StatCard({ icon, bg, label, value, trend, subLabel }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 ${bg} rounded-xl`}>{icon}</div>
        <span className="text-[10px] font-bold px-2 py-1 bg-green-50 text-green-700 rounded-lg">
          {trend}
        </span>
      </div>
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
        {label}
      </h3>
      <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
      <p className="text-[11px] text-gray-500 mt-1">{subLabel}</p>
    </div>
  );
}
