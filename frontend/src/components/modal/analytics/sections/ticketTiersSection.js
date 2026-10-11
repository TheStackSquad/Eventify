// frontend/src/components/modal/analytics/sections/ticketTiersSection.js

import React from "react";
import { Ticket } from "lucide-react";
import CollapsibleSection from "../shared/collapsibleSection";
import ProgressBar from "../shared/progressBar";
import { formatCurrency } from "../utils/analyticsFormatter";
import { getPopularityBadge } from "../utils/analyticsHelpers";

export default function TicketTiersSection({
  tiers,
  tickets,
  isExpanded,
  onToggle,
}) {
  if (!tiers || tiers.length === 0) return null;

  return (
    <CollapsibleSection
      title="Ticket Tiers Performance"
      icon={Ticket}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={`${tiers.length} ${tiers.length === 1 ? "tier" : "tiers"}`}
      color="text-blue-600"
    >
      <div className="space-y-4">
        {/* Overall Progress */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-gray-700 mb-3">
            Overall Sales Progress
          </h5>
          <ProgressBar
            value={tickets.totalSold}
            max={tickets.totalInventory}
            label={`${tickets.totalSold} sold of ${tickets.totalInventory} tickets`}
            size="lg"
          />
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Remaining:{" "}
              <span className="font-bold">{tickets.totalRemaining}</span>
            </span>
            <span className="text-gray-600">
              Velocity:{" "}
              <span className="font-bold">
                {tickets.velocityPerDay.toFixed(1)}
              </span>{" "}
              per day
            </span>
          </div>
        </div>

        {/* Individual Tiers */}
        {tiers.map((tier, index) => (
          <TierCard key={index} tier={tier} />
        ))}
      </div>
    </CollapsibleSection>
  );
}

const TierCard = ({ tier }) => (
  <div className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:border-indigo-300 transition-colors">
    <div className="flex items-start justify-between mb-3">
      <div>
        <h5 className="font-bold text-gray-900 text-lg">{tier.tierName}</h5>
        <p className="text-sm text-gray-600">
          {formatCurrency(tier.priceKobo)} per ticket
        </p>
      </div>
      {getPopularityBadge(tier.popularity)}
    </div>

    <ProgressBar
      value={tier.sold}
      max={tier.totalStock}
      label={`${tier.sold} sold • ${tier.available} available`}
      size="md"
    />

    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-500">Revenue from tier</p>
        <p className="text-xl font-bold text-gray-900">
          {formatCurrency(tier.revenue)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500">Sell-through rate</p>
        <p className="text-xl font-bold text-indigo-600">
          {tier.sellThroughRate.toFixed(1)}%
        </p>
      </div>
    </div>
  </div>
);
