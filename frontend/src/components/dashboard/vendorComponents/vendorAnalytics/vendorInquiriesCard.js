// frontend/src/components/dashboard/vendorAnalytics/vendorInquiriesCard.js
"use client";

import React from "react";
import {
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

export default function VendorInquiriesCard({ inquiries, metrics, timeRange }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case "responded":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "declined":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "responded":
        return "Responded";
      case "pending":
        return "Pending";
      case "declined":
        return "Declined";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Customer Inquiries
          </h3>
          <p className="text-sm text-gray-500">
            Recent customer messages and requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {metrics.inquiryCountLast7Days} new this week
          </span>
          <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            View All
          </button>
        </div>
      </div>

      {/* Inquiry List */}
      <div className="space-y-3">
        {inquiries.length > 0 ? (
          inquiries.map((inquiry) => (
            <div
              key={inquiry.id}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(inquiry.status)}
                  <div>
                    <p className="font-medium text-gray-900">
                      {inquiry.customerName}
                    </p>
                    <p className="text-xs text-gray-500">{inquiry.eventType}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    {getStatusText(inquiry.status)}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{inquiry.date}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">
                {inquiry.message}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-8 border border-gray-200 rounded-lg">
            <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No inquiries yet</p>
            <p className="text-sm text-gray-500">
              Customer inquiries will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
