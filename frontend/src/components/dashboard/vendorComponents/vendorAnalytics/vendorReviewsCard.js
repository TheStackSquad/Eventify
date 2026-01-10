// frontend/src/components/dashboard/vendorAnalytics/vendorReviewsCard.js
"use client";

import React from "react";
import { Star, MessageSquare, TrendingUp, Clock } from "lucide-react";

export default function VendorReviewsCard({ reviews, metrics, timeRange }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Customer Reviews
          </h3>
          <p className="text-sm text-gray-500">
            Feedback and ratings from customers
          </p>
        </div>
        <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          View All
        </button>
      </div>

      {/* Review Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-lg font-bold text-gray-900">
              {metrics.averageRating.toFixed(1)}
            </span>
          </div>
          <p className="text-xs text-gray-600">Average Rating</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-lg font-bold text-gray-900 mb-1">
            {metrics.totalReviews}
          </div>
          <p className="text-xs text-gray-600">Total Reviews</p>
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700">Recent Reviews</h4>

        {reviews.length > 0 ? (
          reviews.map((review) => (
            <div
              key={review.id}
              className="border border-gray-200 rounded-lg p-3"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium text-gray-900">
                    {review.customerName}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < review.rating
                            ? "text-amber-500 fill-amber-500"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-gray-500">{review.date}</span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">
                {review.comment}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-8 border border-gray-200 rounded-lg">
            <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No reviews yet</p>
            <p className="text-sm text-gray-500">
              Customer reviews will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
