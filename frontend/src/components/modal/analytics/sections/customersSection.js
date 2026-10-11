// frontend/src/components/modal/analytics/sections/CustomersSection.js

import React from "react";
import { Users, UserCheck, MapPin, Globe } from "lucide-react";
import CollapsibleSection from "../shared/collapsibleSection";
import {
  formatCurrency,
  formatCompactNumber,
} from "../utils/analyticsFormatter";

export default function CustomersSection({ customers, isExpanded, onToggle }) {
  if (!customers) return null;

  const repeatRate =
    customers.uniqueCustomers > 0
      ? (customers.repeatCustomers / customers.uniqueCustomers) * 100
      : 0;

  return (
    <CollapsibleSection
      title="Customer Analytics"
      icon={Users}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={`${customers.uniqueCustomers} customers`}
      color="text-orange-600"
    >
      <div className="space-y-6">
        {/* Customer Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-6 h-6 text-orange-600" />
              <p className="text-sm font-medium text-gray-600">
                Unique Customers
              </p>
            </div>
            <p className="text-4xl font-bold text-orange-700 mb-1">
              {formatCompactNumber(customers.uniqueCustomers)}
            </p>
            <p className="text-sm text-gray-600">Individual buyers</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="w-6 h-6 text-green-600" />
              <p className="text-sm font-medium text-gray-600">
                Repeat Customers
              </p>
            </div>
            <p className="text-4xl font-bold text-green-700 mb-1">
              {customers.repeatCustomers}
            </p>
            <p className="text-sm text-gray-600">
              {repeatRate.toFixed(1)}% return rate
            </p>
          </div>
        </div>

        {/* Top Countries */}
        {customers.topCountries && customers.topCountries.length > 0 && (
          <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-gray-600" />
              <h5 className="text-base font-bold text-gray-900">
                Top Countries
              </h5>
            </div>

            <div className="space-y-3">
              {customers.topCountries.slice(0, 5).map((country, index) => (
                <CountryRow key={index} country={country} rank={index + 1} />
              ))}
            </div>
          </div>
        )}

        {/* Geographic Distribution Map Placeholder */}
        {customers.topCountries && customers.topCountries.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-gray-600" />
              <h5 className="text-base font-bold text-gray-900">
                Geographic Distribution
              </h5>
            </div>

            {/* Simple bar chart representation */}
            <div className="space-y-3">
              {customers.topCountries.map((country, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {country.country}
                    </span>
                    <span className="text-gray-600">
                      {country.percentOfTotal.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-orange-400 to-orange-600 h-2 rounded-full transition-all duration-700"
                      style={{ width: `${country.percentOfTotal}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

const CountryRow = ({ country, rank }) => {
  // Simple flag emoji mapping (extend as needed)
  const getFlagEmoji = (countryName) => {
    const flags = {
      Nigeria: "🇳🇬",
      Ghana: "🇬🇭",
      Kenya: "🇰🇪",
      "South Africa": "🇿🇦",
      "United Kingdom": "🇬🇧",
      "United States": "🇺🇸",
      Canada: "🇨🇦",
    };
    return flags[countryName] || "🌍";
  };

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0 border-gray-200">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-2xl flex-shrink-0">
          {getFlagEmoji(country.country)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">
              {country.country}
            </span>
            {rank <= 3 && (
              <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-bold">
                #{rank}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{country.orderCount} orders</p>
        </div>
      </div>

      <div className="text-right flex-shrink-0 ml-4">
        <p className="font-bold text-gray-900">
          {formatCurrency(country.revenue)}
        </p>
        <p className="text-xs text-gray-500">
          {country.percentOfTotal.toFixed(1)}% of total
        </p>
      </div>
    </div>
  );
};
