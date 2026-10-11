// frontend/src/components/modal/analytics/sections/OrdersSection.js

import React from "react";
import {
  ShoppingCart,
  CheckCircle,
  Clock,
  XCircle,
  Shield,
} from "lucide-react";
import CollapsibleSection from "../shared/collapsibleSection";
import { formatPercentage } from "../utils/analyticsFormatter";

export default function OrdersSection({ orders, isExpanded, onToggle }) {
  if (!orders) return null;

  const orderStats = [
    {
      icon: ShoppingCart,
      label: "Total Orders",
      value: orders.total,
      color: "bg-gray-100 text-gray-700",
      count: orders.total,
    },
    {
      icon: CheckCircle,
      label: "Successful",
      value: orders.successful,
      color: "bg-green-100 text-green-700",
      count: orders.successful,
      percentage:
        orders.total > 0 ? (orders.successful / orders.total) * 100 : 0,
    },
    {
      icon: Clock,
      label: "Pending",
      value: orders.pending,
      color: "bg-yellow-100 text-yellow-700",
      count: orders.pending,
      percentage: orders.total > 0 ? (orders.pending / orders.total) * 100 : 0,
    },
    {
      icon: XCircle,
      label: "Failed",
      value: orders.failed,
      color: "bg-red-100 text-red-700",
      count: orders.failed,
      percentage: orders.total > 0 ? (orders.failed / orders.total) * 100 : 0,
    },
  ];

  return (
    <CollapsibleSection
      title="Order Analytics"
      icon={ShoppingCart}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={`${orders.total} total`}
      color="text-purple-600"
    >
      <div className="space-y-6">
        {/* Conversion Rate Highlight */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Conversion Rate
              </p>
              <p className="text-4xl font-bold text-purple-700">
                {formatPercentage(orders.conversionRate)}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {orders.successful} of {orders.total} orders succeeded
              </p>
            </div>

            {/* Donut Chart Placeholder or Icon */}
            <div className="relative w-24 h-24">
              <svg className="transform -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="3"
                  strokeDasharray={`${orders.conversionRate}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Order Status Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {orderStats.map((stat, index) => (
            <OrderStatCard key={index} {...stat} />
          ))}
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm font-medium text-gray-600">
                Abandonment Rate
              </p>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {formatPercentage(orders.abandonmentRate)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {orders.pending + orders.failed} incomplete orders
            </p>
          </div>

          {orders.fraud > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-orange-600" />
                <p className="text-sm font-medium text-gray-600">
                  Fraud Detected
                </p>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {orders.fraud}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Flagged by payment processor
              </p>
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
}

const OrderStatCard = ({ icon: Icon, label, value, color, percentage }) => (
  <div className={`${color} rounded-lg p-4 flex flex-col`}>
    <Icon className="w-5 h-5 mb-2" />
    <p className="text-xs font-medium opacity-80 mb-1">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
    {percentage != null && (
      <p className="text-xs opacity-70 mt-1">
        {formatPercentage(percentage, 1)}
      </p>
    )}
  </div>
);
