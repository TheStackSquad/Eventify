// frontend/src/components/dashboard/vendorAnalytics/vendorReviewsCard.js

"use client";

import React, { memo, useMemo, useCallback } from "react";
import {
  Star,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle,
} from "lucide-react";

const VendorReviewsCard = memo(
  ({
    // Required props from API
    reviews = [],
    totalReviews = 0,
    averageRating = 0,
    ratingDistribution = {
      fiveStar: 0,
      fourStar: 0,
      threeStar: 0,
      twoStar: 0,
      oneStar: 0,
      avgRating: 0,
    },
    approvedReviews = 0,
    pendingReviews = 0,
    sentimentTrend = "neutral",
    timeRange = "30days",
  }) => {
    // Memoize formatted rating distribution
    const ratingBreakdown = useMemo(() => {
      const total = totalReviews || 1; // Prevent division by zero
      return [
        {
          stars: 5,
          count: ratingDistribution.fiveStar || 0,
          percentage: ((ratingDistribution.fiveStar || 0) / total) * 100,
        },
        {
          stars: 4,
          count: ratingDistribution.fourStar || 0,
          percentage: ((ratingDistribution.fourStar || 0) / total) * 100,
        },
        {
          stars: 3,
          count: ratingDistribution.threeStar || 0,
          percentage: ((ratingDistribution.threeStar || 0) / total) * 100,
        },
        {
          stars: 2,
          count: ratingDistribution.twoStar || 0,
          percentage: ((ratingDistribution.twoStar || 0) / total) * 100,
        },
        {
          stars: 1,
          count: ratingDistribution.oneStar || 0,
          percentage: ((ratingDistribution.oneStar || 0) / total) * 100,
        },
      ];
    }, [ratingDistribution, totalReviews]);

    // Memoize date formatter
    const formatDate = useCallback((dateString) => {
      if (!dateString || dateString === "0001-01-01T00:00:00Z")
        return "Recently";
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return "Recently";
      }
    }, []);

    // Memoize sentiment badge color
    const getSentimentColor = useCallback((trend) => {
      const colors = {
        improving: "bg-green-100 text-green-700 border-green-200",
        declining: "bg-red-100 text-red-700 border-red-200",
        stable: "bg-blue-100 text-blue-700 border-blue-200",
        neutral: "bg-gray-100 text-gray-700 border-gray-200",
      };
      return colors[trend?.toLowerCase()] || colors.neutral;
    }, []);

    // Memoize star rating component to prevent re-renders
    const StarRating = useCallback(({ rating, size = "sm" }) => {
      const starSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
      return (
        <div
          className="flex items-center gap-0.5"
          aria-label={`${rating} out of 5 stars`}
        >
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`${starSize} ${
                i < rating ? "text-amber-500 fill-amber-500" : "text-gray-300"
              }`}
              aria-hidden="true"
            />
          ))}
        </div>
      );
    }, []);

    // If no reviews, show empty state
    if (!totalReviews || totalReviews === 0) {
      return (
        <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <MessageSquare
                className="w-8 h-8 text-gray-400"
                aria-hidden="true"
              />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Reviews Yet
            </h3>
            <p className="text-sm text-gray-500 max-w-sm">
              Customers haven&apos;t reviewed your services yet. Reviews will
              appear here once customers leave feedback.
            </p>
          </div>
        </article>
      );
    }

    return (
      <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                Customer Reviews
                {sentimentTrend && (
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full border ${getSentimentColor(sentimentTrend)}`}
                  >
                    {sentimentTrend}
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Based on {totalReviews}{" "}
                {totalReviews === 1 ? "review" : "reviews"}
              </p>
            </div>

            {/* Approval Status - Only show if data exists */}
            {(approvedReviews > 0 || pendingReviews > 0) && (
              <div className="flex items-center gap-3 text-xs">
                {approvedReviews > 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {approvedReviews} Approved
                  </span>
                )}
                {pendingReviews > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Clock className="w-3.5 h-3.5" />
                    {pendingReviews} Pending
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Grid Layout for Performance */}
        <div className="p-5">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Average Rating Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Star
                    className="w-5 h-5 text-amber-600 fill-amber-600"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {averageRating.toFixed(1)}
                  </p>
                  <div className="flex items-center gap-2">
                    <StarRating rating={Math.round(averageRating)} size="sm" />
                    <span className="text-xs text-gray-500">/5.0</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Overall rating from customers
              </p>
            </div>

            {/* Total Reviews Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <MessageSquare
                    className="w-5 h-5 text-blue-600"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {totalReviews.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600">Total Reviews</p>
                </div>
              </div>

              {/* Time range indicator */}
              {timeRange && (
                <p className="text-xs text-gray-500 mt-2">
                  Last {timeRange === "7days" ? "7" : "30"} days
                </p>
              )}
            </div>
          </div>

          {/* Rating Distribution - Optimized Layout */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" aria-hidden="true" />
              Rating Breakdown
            </h4>
            <div className="space-y-2">
              {ratingBreakdown.map(({ stars, count, percentage }) => (
                <div key={stars} className="flex items-center gap-2 group">
                  <span className="text-xs font-medium text-gray-600 w-8">
                    {stars} ★
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300 group-hover:from-amber-500 group-hover:to-amber-600"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                      role="progressbar"
                      aria-valuenow={percentage}
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-label={`${stars} star: ${count} reviews`}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-12 text-right">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Reviews Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-700">
                Recent Reviews
              </h4>
              {reviews.length > 3 && (
                <button
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  aria-label="View all reviews"
                >
                  View All →
                </button>
              )}
            </div>

            <div className="space-y-3">
              {reviews.slice(0, 3).map((review) => (
                <div
                  key={review.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">
                          {review.userName || "Anonymous"}
                        </p>
                        {review.isApproved && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-medium rounded-full border border-green-200">
                            <CheckCircle className="w-2.5 h-2.5" />
                            Verified
                          </span>
                        )}
                      </div>
                      <StarRating rating={review.rating} size="sm" />
                    </div>
                    <time className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {formatDate(review.createdAt)}
                    </time>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}

              {/* Show empty state if no recent reviews */}
              {reviews.length === 0 && (
                <div className="text-center py-6 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">No recent reviews</p>
                  <p className="text-xs text-gray-500 mt-1">
                    New reviews will appear here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  },
);

// Add display name for better debugging
VendorReviewsCard.displayName = "VendorReviewsCard";

export default VendorReviewsCard;