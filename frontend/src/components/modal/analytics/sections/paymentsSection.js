// frontend/src/components/modal/analytics/sections/paymentsSection.js

import React from "react";
import { CreditCard, TrendingUp, CheckCircle } from "lucide-react";
import CollapsibleSection from "../shared/collapsibleSection";
import { formatCurrency, formatPercentage } from "../utils/analyticsFormatter";

export default function PaymentsSection({ payments, isExpanded, onToggle }) {
  if (!payments || !payments.channels || payments.channels.length === 0) {
    return null;
  }

  return (
    <CollapsibleSection
      title="Payment Methods"
      icon={CreditCard}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={`${payments.channels.length} channels`}
      color="text-indigo-600"
    >
      <div className="space-y-6">
        {/* Most Popular Channel Highlight */}
        {payments.mostPopularChannel && (
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Most Popular Channel
                </p>
                <p className="text-2xl font-bold text-indigo-700 capitalize">
                  {payments.mostPopularChannel}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Channels Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {payments.channels.map((channel, index) => (
            <PaymentChannelCard key={index} channel={channel} />
          ))}
        </div>

        {/* Payment Method Distribution */}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
          <h5 className="text-base font-bold text-gray-900 mb-4">
            Revenue Distribution
          </h5>
          <div className="space-y-3">
            {payments.channels
              .sort((a, b) => b.revenue - a.revenue)
              .map((channel, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700 capitalize">
                      {channel.channel}
                    </span>
                    <span className="text-gray-600">
                      {formatPercentage(channel.percentOfTotal)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2.5 rounded-full transition-all duration-700"
                      style={{ width: `${channel.percentOfTotal}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

const PaymentChannelCard = ({ channel }) => {
  // Map channel names to icons/emojis
  const getChannelIcon = (channelName) => {
    const icons = {
      card: "💳",
      bank_transfer: "🏦",
      bank: "🏦",
      ussd: "📱",
      mobile_money: "📲",
      qr: "📸",
    };
    return icons[channelName.toLowerCase()] || "💰";
  };

  const isHighSuccess = channel.successRate >= 95;

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:border-indigo-300 transition-all hover:shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{getChannelIcon(channel.channel)}</span>
        <div className="flex-1 min-w-0">
          <h6 className="font-bold text-gray-900 capitalize truncate">
            {channel.channel.replace(/_/g, " ")}
          </h6>
          {isHighSuccess && (
            <div className="flex items-center gap-1 text-xs text-green-600 font-semibold mt-0.5">
              <CheckCircle className="w-3 h-3" />
              <span>Reliable</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* Revenue */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Revenue</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(channel.revenue)}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {formatPercentage(channel.percentOfTotal)} of total
          </p>
        </div>

        {/* Orders */}
        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Orders</span>
            <span className="font-bold text-gray-900">
              {channel.orderCount}
            </span>
          </div>
        </div>

        {/* Success Rate */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Success Rate</span>
            <span
              className={`font-bold ${
                isHighSuccess ? "text-green-600" : "text-yellow-600"
              }`}
            >
              {formatPercentage(channel.successRate)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-700 ${
                isHighSuccess
                  ? "bg-green-500"
                  : channel.successRate >= 80
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${channel.successRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
