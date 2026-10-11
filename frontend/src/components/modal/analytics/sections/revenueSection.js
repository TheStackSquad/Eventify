// frontend/src/components/modal/analytics/sections/RevenueSection.js

import React from "react";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import CollapsibleSection from "../shared/collapsibleSection";
import { formatCurrency } from "../utils/analyticsFormatter";

export default function RevenueSection({ revenue, isExpanded, onToggle }) {
  if (!revenue) return null;

  return (
    <CollapsibleSection
      title="Revenue Breakdown"
      icon={Wallet}
      isExpanded={isExpanded}
      onToggle={onToggle}
      color="text-green-600"
    >
      <div className="space-y-6">
        {/* Net Revenue Highlight */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
          <p className="text-sm font-medium text-gray-600 mb-1">
            Your Net Revenue
          </p>
          <p className="text-4xl font-bold text-green-700 mb-2">
            {formatCurrency(revenue.net)}
          </p>
          <p className="text-sm text-gray-600">
            Amount you receive after fees and VAT
          </p>
        </div>

        {/* Revenue Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RevenueItem
            label="Gross Revenue"
            value={formatCurrency(revenue.gross)}
            icon={TrendingUp}
            description="Total ticket sales"
          />
          <RevenueItem
            label="Service Fees"
            value={formatCurrency(revenue.serviceFees)}
            icon={TrendingDown}
            isDeduction
            description="Platform fees"
          />
          <RevenueItem
            label="VAT"
            value={formatCurrency(revenue.vat)}
            icon={TrendingDown}
            isDeduction
            description="Value Added Tax"
          />
          <RevenueItem
            label="Avg. Order Value"
            value={formatCurrency(revenue.averageOrderValue)}
            icon={TrendingUp}
            description="Per transaction"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}

const RevenueItem = ({
  label,
  value,
  icon: Icon,
  isDeduction,
  description,
}) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4">
    <div className="flex items-start justify-between mb-2">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      {Icon && (
        <Icon
          className={`h-4 w-4 ${
            isDeduction ? "text-red-500" : "text-green-500"
          }`}
        />
      )}
    </div>
    <p
      className={`text-2xl font-bold ${
        isDeduction ? "text-red-600" : "text-gray-900"
      }`}
    >
      {isDeduction && "- "}
      {value}
    </p>
    {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
  </div>
);
