// frontend/src/components/subscription/tierComparisonTable.jsx
"use client";

import { Shield, Zap, Star, Sparkles } from "lucide-react";
import MobileTierCards from "./mobileTierCards";
import DesktopTierTable from "./desktopTierTable";
import { getPaidTiers } from "@/utils/constants/subscriptionTiers";

export default function TierComparisonTable({
  onSelectTier,
  currentTier = "free",
}) {
  const paidTiers = getPaidTiers(); // Only show Basic, Premium, Featured

  return (
    <div className="mt-12 md:mt-24 mb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <header className="text-center mb-12 md:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            Value-Based Pricing
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
            Choose Your Growth Plan
          </h2>

          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Compare features across all tiers. Each plan is designed to grow
            your business with proven ROI metrics and transparent pricing.
          </p>

          {/* Value Proposition - Quick Wins */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-semibold">Track real metrics</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="font-semibold">Rank in top 10</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              <span className="font-semibold">3x-10x more visibility</span>
            </div>
          </div>
        </header>

        {/* Mobile View - Card Carousel */}
        <MobileTierCards
          tiers={paidTiers}
          onSelectTier={onSelectTier}
          currentTier={currentTier}
        />

        {/* Desktop View - Comparison Table */}
        <DesktopTierTable
          tiers={paidTiers}
          onSelectTier={onSelectTier}
          currentTier={currentTier}
        />

        {/* Trust Indicators */}
        <footer className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
            <Shield className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 mb-1">Secure Payments</h3>
            <p className="text-sm text-gray-600">
              Powered by Paystack with bank-level encryption
            </p>
          </div>

          <div className="text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
            <Zap className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 mb-1">Instant Activation</h3>
            <p className="text-sm text-gray-600">
              Features unlock immediately after payment
            </p>
          </div>

          <div className="text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
            <Star className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 mb-1">Cancel Anytime</h3>
            <p className="text-sm text-gray-600">
              No contracts - downgrade or cancel anytime
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
