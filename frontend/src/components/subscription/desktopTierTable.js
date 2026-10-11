// frontend/src/components/subscription/DesktopTierTable.jsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Star, Check, X, TrendingUp, Zap, Sparkles } from "lucide-react";
import { COMPARISON_FEATURES } from "@/utils/constants/subscriptionTiers";

export default function DesktopTierTable({ tiers, onSelectTier, currentTier }) {
  const [isSticky, setIsSticky] = useState(false);
  const tableRef = useRef(null);

  // Sticky header detection
  useEffect(() => {
    const handleScroll = () => {
      if (tableRef.current) {
        const rect = tableRef.current.getBoundingClientRect();
        setIsSticky(rect.top <= 0);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Badge gradient mapping
  const getBadgeGradient = (badge) => {
    if (!badge?.show) return null;

    const colorMap = {
      "#CD7F32": "from-amber-600 to-amber-700",
      "#C0C0C0": "from-gray-400 to-gray-500",
      "#FFD700": "from-yellow-400 to-yellow-500",
    };

    return colorMap[badge.color] || "from-gray-400 to-gray-500";
  };

  // Parse feature value to determine if it should show as check/cross or text
  const renderFeatureValue = (value, isRecommended) => {
    if (!value || value === "") {
      return (
        <div className="flex justify-center">
          <span className="text-gray-300 text-lg">—</span>
        </div>
      );
    }

    const valueStr = String(value).trim();

    // Check if value starts with ✓ (check mark)
    if (valueStr.startsWith("✓")) {
      const text = valueStr.substring(1).trim();

      return (
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shadow-sm">
            <Check className="w-5 h-5 text-emerald-600 stroke-[3]" />
          </div>
          {text && (
            <span className="text-xs text-gray-600 font-medium mt-1">
              {text}
            </span>
          )}
        </div>
      );
    }

    // Check if value starts with ✗ (cross mark)
    if (valueStr.startsWith("✗")) {
      return (
        <div className="flex justify-center">
          <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center">
            <X className="w-5 h-5 text-red-400 stroke-[3]" />
          </div>
        </div>
      );
    }

    // Regular text value
    return (
      <span
        className={`inline-flex items-center text-sm font-semibold px-3 py-1.5 rounded-lg border ${
          isRecommended
            ? "text-indigo-700 bg-indigo-50 border-indigo-200"
            : "text-gray-700 bg-gray-100 border-gray-200"
        }`}
      >
        {valueStr}
      </span>
    );
  };

  return (
    <div className="hidden md:block overflow-x-auto pb-12" ref={tableRef}>
      <table
        className="w-full text-left border-collapse bg-white rounded-2xl shadow-xl overflow-hidden"
        role="grid"
        aria-label="Subscription tier comparison table"
      >
        {/* Table Header - Tier Names & Prices */}
        <thead
          className={`transition-all duration-300 ${
            isSticky ? "sticky top-0 z-10 shadow-lg" : ""
          }`}
        >
          <tr className="border-b-2 border-gray-200">
            <th className="p-8 text-gray-800 font-bold bg-gradient-to-br from-gray-50 to-gray-100 text-lg w-1/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <span>Features</span>
              </div>
            </th>

            {tiers.map((tier) => {
              const badgeGradient = getBadgeGradient(tier.badge);
              const isCurrentPlan =
                tier.id.toLowerCase() === currentTier.toLowerCase();

              return (
                <th
                  key={tier.id}
                  className={`p-8 text-center border-x border-gray-100 relative ${
                    tier.recommended
                      ? "bg-gradient-to-b from-indigo-50 via-white to-purple-50"
                      : "bg-white"
                  }`}
                >
                  {/* Recommended Glow Effect */}
                  {tier.recommended && (
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-100/50 to-purple-100/50 animate-pulse opacity-50" />
                  )}

                  <div className="relative flex flex-col items-center space-y-3">
                    {/* Tier Badge */}
                    {tier.badge.show && (
                      <div
                        className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${badgeGradient} text-white rounded-full text-sm font-bold shadow-md`}
                      >
                        <span className="text-xl">{tier.badge.icon}</span>
                        <span>{tier.badge.text}</span>
                      </div>
                    )}

                    {/* Tier Name */}
                    <h3 className="text-2xl font-bold text-gray-900">
                      {tier.name}
                    </h3>

                    {/* Recommended Badge */}
                    {tier.recommended && (
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-lg animate-pulse">
                        <Star className="w-4 h-4 fill-current" />
                        POPULAR
                      </span>
                    )}

                    {/* Price */}
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-bold text-gray-900">
                        {tier.priceDisplay}
                      </span>
                      <span className="text-sm text-gray-600 mt-1">
                        per {tier.billingCycle}
                      </span>
                    </div>

                    {/* Value Proposition */}
                    {tier.valueProp && (
                      <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="font-semibold">
                          {tier.valueProp.metric}
                        </span>
                      </div>
                    )}

                    {/* Current Plan Indicator */}
                    {isCurrentPlan && (
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-200">
                        ✓ Current Plan
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Table Body - Features by Category */}
        <tbody>
          {COMPARISON_FEATURES?.map((section, sectionIdx) => (
            <React.Fragment key={sectionIdx}>
              {/* Category Header Row */}
              <tr className="bg-gradient-to-r from-indigo-50 to-purple-50 border-y border-indigo-100">
                <td
                  colSpan={tiers?.length + 1}
                  className="p-4 text-xs font-bold text-indigo-900 uppercase tracking-wider"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    {section.category}
                  </div>
                </td>
              </tr>

              {/* Feature Rows */}
              {section.features?.map((feature, featureIdx) => (
                <tr
                  key={featureIdx}
                  className="hover:bg-gray-50/80 transition-all duration-200 group border-b border-gray-100"
                  role="row"
                >
                  {/* Feature Label */}
                  <td
                    className="p-5 text-gray-800 font-medium text-sm bg-gradient-to-br from-gray-50/50 to-white"
                    role="cell"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-1.5 h-8 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <span>{feature.label}</span>
                    </div>
                  </td>

                  {/* Feature Values for Each Tier */}
                  {tiers.map((tier) => {
                    const tierKey = tier.id.toLowerCase();
                    const value = feature[tierKey];

                    return (
                      <td
                        key={tier.id}
                        className={`p-5 text-center border-x border-gray-100 transition-all ${
                          tier.recommended
                            ? "bg-indigo-50/30 group-hover:bg-indigo-50/50"
                            : "group-hover:bg-gray-50"
                        }`}
                        role="cell"
                      >
                        {renderFeatureValue(value, tier.recommended)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}

          {/* CTA Row */}
          <tr className="border-t-2 border-gray-200 bg-gradient-to-b from-gray-50 to-white">
            <td className="p-8 text-gray-700 font-semibold text-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Ready to upgrade?
              </div>
            </td>

            {tiers.map((tier) => {
              const isCurrentPlan =
                tier.id.toLowerCase() === currentTier.toLowerCase();

              return (
                <td
                  key={tier.id}
                  className={`p-8 text-center border-x border-gray-100 ${
                    tier.recommended
                      ? "bg-gradient-to-b from-indigo-50/30 to-purple-50/30"
                      : "bg-white"
                  }`}
                >
                  <button
                    onClick={() => onSelectTier(tier.id)}
                    disabled={isCurrentPlan}
                    className={`min-w-[180px] px-8 py-4 rounded-xl font-bold text-base transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2 ${
                      isCurrentPlan
                        ? "bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200"
                        : tier.recommended
                          ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 focus:ring-indigo-300"
                          : "bg-white text-indigo-600 border-2 border-indigo-200 hover:bg-indigo-50 shadow-md hover:shadow-lg focus:ring-indigo-200"
                    }`}
                    aria-label={
                      isCurrentPlan ? "Current plan" : `Upgrade to ${tier.name}`
                    }
                  >
                    {isCurrentPlan ? "✓ Current Plan" : `Get started now`}
                  </button>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
