// frontend/src/components/dashboard/vendorAnalytics/vendorAnalyticsDashboard.js
"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Users,
  MessageSquare,
  Star,
  Eye,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Filter,
} from "lucide-react";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import VendorTrustScoreCard from "./vendorTrustScoreCard";
import VendorReviewsCard from "./vendorReviewsCard";
import VendorInquiriesCard from "./vendorInquiriesCard";
import VendorActivityCard from "./vendorActivityCard";

// Mock data - to be replaced with API calls
const MOCK_VENDOR_DATA = {
  trustScore: {
    score: 87.5,
    reviewCount: 24,
    lastUpdated: "2024-01-15T10:30:00Z",
  },
  basicInfo: {
    name: "Premium Catering Services",
    category: "Food & Catering",
    profileViews: 1245,
    createdAt: "2023-06-15",
    location: "Lagos, Nigeria",
  },
  metrics: {
    inquiryCountLast7Days: 12,
    inquiryCountLast30Days: 45,
    reviewCountLast7Days: 8,
    reviewCountLast30Days: 24,
    averageRatingLast7Days: 4.7,
    averageRatingLast30Days: 4.6,
    totalReviews: 24,
    averageRating: 4.6,
  },
  recentInquiries: [
    {
      id: "1",
      customerName: "John Adebayo",
      eventType: "Wedding",
      date: "2024-01-20",
      status: "pending",
      message: "Looking for catering for 200 guests...",
    },
    {
      id: "2",
      customerName: "Sarah Johnson",
      eventType: "Corporate",
      date: "2024-01-19",
      status: "responded",
      message: "Requesting quote for office party...",
    },
  ],
  recentReviews: [
    {
      id: "1",
      customerName: "Michael Chen",
      rating: 5,
      date: "2024-01-18",
      comment: "Excellent service! Food was amazing.",
    },
    {
      id: "2",
      customerName: "Funke Adeola",
      rating: 4,
      date: "2024-01-15",
      comment: "Good quality but delivery was late.",
    },
  ],
};

export default function VendorAnalyticsDashboard({ userId }) {
  const [loading, setLoading] = useState(true);
  const [vendorData, setVendorData] = useState(null);
  const [timeRange, setTimeRange] = useState("7days");

  useEffect(() => {
    // Simulate API call
    const fetchVendorData = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/vendor/analytics/${userId}`);
        // const data = await response.json();
        await new Promise((resolve) => setTimeout(resolve, 800));
        setVendorData(MOCK_VENDOR_DATA);
      } catch (error) {
        console.error("Error fetching vendor data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchVendorData();
    }
  }, [userId]);

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    // TODO: Refetch data based on time range
  };

  if (loading) {
    return (
      <LoadingSpinner
        message="Loading vendor analytics..."
        subMessage="Fetching your performance data"
        size="md"
        color="indigo"
        fullScreen={false}
        className="bg-white rounded-xl shadow-sm border border-gray-100"
      />
    );
  }

  if (!vendorData) {
    return (
      <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Vendor Profile Found
        </h3>
        <p className="text-gray-600 mb-4">
          You need to register as a vendor to access analytics.
        </p>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          Register as Vendor
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vendor Analytics</h2>
          <p className="text-gray-600">
            {vendorData.basicInfo.name} • {vendorData.basicInfo.category}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => handleTimeRangeChange("7days")}
              className={`px-3 py-1.5 text-sm font-medium ${
                timeRange === "7days"
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => handleTimeRangeChange("30days")}
              className={`px-3 py-1.5 text-sm font-medium ${
                timeRange === "30days"
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => handleTimeRangeChange("all")}
              className={`px-3 py-1.5 text-sm font-medium ${
                timeRange === "all"
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              All Time
            </button>
          </div>

          <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Export</span>
          </button>
        </div>
      </div>

      {/* Core Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Trust Score Card */}
        <VendorTrustScoreCard data={vendorData.trustScore} />

        {/* Profile Views */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-green-50 text-green-700 rounded-full">
              +12.5%
            </span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Profile Views
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {vendorData.basicInfo.profileViews.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Total views</p>
        </div>

        {/* Inquiries */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-green-50 text-green-700 rounded-full">
              +{vendorData.metrics.inquiryCountLast7Days}
            </span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Recent Inquiries
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {vendorData.metrics.inquiryCountLast7Days}
          </p>
          <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
        </div>

        {/* Reviews */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Star className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-green-50 text-green-700 rounded-full">
              +{vendorData.metrics.reviewCountLast7Days}
            </span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Recent Reviews
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {vendorData.metrics.reviewCountLast7Days}
          </p>
          <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
        </div>
      </div>

      {/* Detailed Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Reviews & Activity */}
        <div className="lg:col-span-2 space-y-6">
          <VendorReviewsCard
            reviews={vendorData.recentReviews}
            metrics={vendorData.metrics}
            timeRange={timeRange}
          />

          <VendorInquiriesCard
            inquiries={vendorData.recentInquiries}
            metrics={vendorData.metrics}
            timeRange={timeRange}
          />
        </div>

        {/* Right Column - Activity & Stats */}
        <div className="space-y-6">
          <VendorActivityCard
            basicInfo={vendorData.basicInfo}
            metrics={vendorData.metrics}
          />

          {/* Quick Stats */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Performance Summary
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Response Rate</span>
                  <span className="font-semibold text-green-600">92%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full"
                    style={{ width: "92%" }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Booking Conversion</span>
                  <span className="font-semibold text-blue-600">45%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: "45%" }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Customer Satisfaction</span>
                  <span className="font-semibold text-amber-600">4.6/5</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full"
                    style={{ width: "92%" }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
