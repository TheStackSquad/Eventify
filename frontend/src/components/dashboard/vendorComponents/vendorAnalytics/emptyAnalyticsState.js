// frontend/src/components/dashboard/vendorComponents/vendorAnalytics/EmptyAnalyticsState.js

import React from "react";
import { Eye, MessageSquare, Star, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export default function EmptyAnalyticsState({ userEmail, vendorName }) {
  return (
    <div className="min-h-[600px] flex items-center justify-center px-4 py-12 animate-in fade-in duration-700">
      <div className="max-w-3xl w-full">
        {/* Welcome Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-semibold">
            <Sparkles size={16} />
            <span>Welcome to Your Analytics Dashboard</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
            {vendorName ? `Hi, ${vendorName}!` : "Let's Get Started"}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Your analytics dashboard will come alive once customers start
            discovering your business. Here&apos;s what you&apos;ll see:
          </p>
        </div>

        {/* Metrics Preview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <MetricPreviewCard
            icon={<Eye className="text-blue-600" size={24} />}
            bg="bg-blue-50"
            title="Profile Views"
            description="Track how many people discover your business"
            comingSoon="Live tracking"
          />
          <MetricPreviewCard
            icon={<MessageSquare className="text-purple-600" size={24} />}
            bg="bg-purple-50"
            title="Customer Inquiries"
            description="Manage event requests and quote opportunities"
            comingSoon="Response tracking"
          />
          <MetricPreviewCard
            icon={<Star className="text-amber-600" size={24} />}
            bg="bg-amber-50"
            title="Reviews & Ratings"
            description="Build trust with authentic customer feedback"
            comingSoon="Rating insights"
          />
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-8 sm:p-10 border border-indigo-100">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Boost Your Visibility
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Complete your vendor profile to start appearing in customer
              searches and attract your first inquiries.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/vendor/profile/setup">
              <button className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group">
                Complete Your Profile
                <ArrowRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
            </Link>
            <Link to="/vendor/help">
              <button className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold transition-all">
                View Setup Guide
              </button>
            </Link>
          </div>
        </div>

        {/* User Info Footer */}
        {userEmail && (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Logged in as{" "}
              <span className="font-semibold text-gray-700">{userEmail}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Metric Preview Card Component
// ============================================================================

function MetricPreviewCard({ icon, bg, title, description, comingSoon }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
      <div className={`inline-flex p-3 ${bg} rounded-xl mb-4`}>{icon}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      <span className="inline-block text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
        {comingSoon}
      </span>
    </div>
  );
}
