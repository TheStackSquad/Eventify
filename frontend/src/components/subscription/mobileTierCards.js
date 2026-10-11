// frontend/src/components/subscription/mobileTierCards.jsx
"use client";

import { useState } from "react";
import { Star, Check, X, TrendingUp } from "lucide-react";

export default function MobileTierCards({ tiers, onSelectTier, currentTier }) {
  const [activeCard, setActiveCard] = useState(0);

  // Badge color mapping
  const getBadgeStyles = (badge) => {
    if (!badge?.show) return null;

    const colorMap = {
      "#CD7F32": "from-amber-600 to-amber-700", // Bronze
      "#C0C0C0": "from-gray-400 to-gray-500", // Silver
      "#FFD700": "from-yellow-400 to-yellow-500", // Gold
    };

    return colorMap[badge.color] || "from-gray-400 to-gray-500";
  };

  return (
    <div
      className="md:hidden space-y-4"
      role="region"
      aria-label="Mobile tier cards"
    >
      {/* Carousel Indicators */}
      <div className="flex justify-center gap-2 mb-6">
        {tiers.map((tier, idx) => (
          <button
            key={tier.id}
            onClick={() => setActiveCard(idx)}
            className={`h-2 rounded-full transition-all duration-300 ${
              activeCard === idx ? "w-8 bg-indigo-600" : "w-2 bg-gray-300"
            }`}
            aria-label={`View ${tier.name} plan`}
            aria-current={activeCard === idx ? "true" : "false"}
          />
        ))}
      </div>

      {/* Cards Container */}
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeCard * 100}%)` }}
        >
          {tiers.map((tier, idx) => {
            const badgeGradient = getBadgeStyles(tier.badge);
            const isCurrentPlan =
              tier.id.toLowerCase() === currentTier.toLowerCase();

            return (
              <div
                key={tier.id}
                className="w-full flex-shrink-0 px-2"
                style={{ minWidth: "100%" }}
              >
                <article
                  className={`border-2 rounded-2xl p-6 shadow-lg ${
                    tier.recommended
                      ? "border-indigo-400 ring-4 ring-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  {/* Recommended Badge */}
                  {tier.recommended && (
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1.5 rounded-bl-2xl rounded-tr-xl text-xs font-bold flex items-center gap-1.5 shadow-lg">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      RECOMMENDED
                    </div>
                  )}

                  {/* Header */}
                  <header className="mb-6 mt-2">
                    {/* Badge Icon */}
                    {tier.badge.show && (
                      <div
                        className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${badgeGradient} text-white rounded-full text-sm font-bold mb-4 shadow-md`}
                      >
                        <span className="text-lg">{tier.badge.icon}</span>
                        <span>{tier.badge.text}</span>
                      </div>
                    )}

                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {tier.name}
                    </h3>

                    <p className="text-sm text-gray-600 mb-4">{tier.tagline}</p>

                    {/* Price */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-gray-900">
                        {tier.priceDisplay}
                      </span>
                      <span className="text-sm text-gray-600">
                        /{tier.billingCycle}
                      </span>
                    </div>

                    {/* ROI Metric */}
                    {tier.roi && (
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="font-semibold text-green-700">
                          {tier.roi.metric}
                        </span>
                      </div>
                    )}
                  </header>

                  {/* Features by Category */}
                  <div className="border-t-2 border-gray-100 pt-6 mb-6 space-y-6">
                    {Object.entries(tier.features).map(
                      ([category, features]) => (
                        <div key={category}>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                            {category === "visibility" && "Visibility"}
                            {category === "analytics" && "Analytics"}
                            {category === "credibility" && "Credibility"}
                            {category === "profile" && "Profile"}
                          </h4>
                          <ul className="space-y-2">
                            {features.map((feature, featureIdx) => (
                              <li
                                key={featureIdx}
                                className="flex items-start gap-2 text-sm"
                              >
                                {feature.included ? (
                                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                )}
                                <span
                                  className={
                                    feature.included
                                      ? "text-gray-700"
                                      : "text-gray-400 line-through"
                                  }
                                >
                                  {feature.name}
                                </span>
                                {feature.highlight && (
                                  <span className="ml-auto px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">
                                    NEW
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ),
                    )}
                  </div>

                  {/* Benefits */}
                  {tier.benefits && tier.benefits.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-6">
                      <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">
                        Key Benefits
                      </h4>
                      <ul className="space-y-1 text-xs text-gray-600">
                        {tier.benefits.slice(0, 3).map((benefit, idx) => (
                          <li key={idx}>{benefit}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* CTA Button */}
                  <button
                    onClick={() => onSelectTier(tier.id)}
                    disabled={isCurrentPlan}
                    className={`w-full py-4 px-6 rounded-xl font-bold text-base transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2 shadow-lg ${
                      isCurrentPlan
                        ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                        : tier.recommended
                          ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                          : "bg-white text-indigo-600 border-2 border-indigo-200 hover:bg-indigo-50"
                    }`}
                    aria-label={
                      isCurrentPlan ? "Current plan" : `Upgrade to ${tier.name}`
                    }
                  >
                    {isCurrentPlan ? "Current Plan" : `Upgrade to ${tier.name}`}
                  </button>
                </article>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Arrows */}
      <nav
        className="flex justify-center gap-4 mt-6"
        aria-label="Card navigation"
      >
        <button
          onClick={() => setActiveCard(Math.max(0, activeCard - 1))}
          disabled={activeCard === 0}
          className="px-6 py-2 bg-white border-2 border-gray-300 rounded-lg font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
          aria-label="Previous plan"
        >
          ← Previous
        </button>
        <button
          onClick={() =>
            setActiveCard(Math.min(tiers.length - 1, activeCard + 1))
          }
          disabled={activeCard === tiers.length - 1}
          className="px-6 py-2 bg-white border-2 border-gray-300 rounded-lg font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
          aria-label="Next plan"
        >
          Next →
        </button>
      </nav>
    </div>
  );
}
