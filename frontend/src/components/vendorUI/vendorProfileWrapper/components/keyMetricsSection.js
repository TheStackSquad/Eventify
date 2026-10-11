// frontend/src/components/vendorUI/vendorProfileWrapper/components/keyMetricsSection.js
import React from "react";
import { MapPin, Star, Wallet, Calendar, TrendingUp } from "lucide-react";
import { formatPrice } from "@/utils/currency";

const KeyMetricsSection = ({ vendor }) => {
  const rawMinPrice = vendor?.minPrice?.Valid
    ? vendor.minPrice.Int32
    : typeof vendor?.minPrice === "number"
      ? vendor.minPrice
      : 0;

  const city = vendor?.city || "Unknown City";
  const state = vendor?.state || "Unknown State";
  const createdAt = vendor?.createdAt;
  const pvsScore = vendor?.pvsScore || 0;
  const reviewCount = vendor?.reviewCount || 0;

  // Format member since date
  const formatMemberSince = (dateString) => {
    if (!dateString) return "Unknown";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "long" 
      });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="p-5 border rounded-xl bg-gradient-to-br from-gray-50 to-white">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Key Metrics</h2>
      <ul className="space-y-3" role="list">
        
        {/* Location Row */}
        <li
          className="flex items-center justify-between p-3 bg-white rounded-lg border"
          role="listitem"
        >
          <div className="flex items-center text-gray-700">
            <MapPin
              size={20}
              className="mr-3 text-indigo-500"
              aria-hidden="true"
            />
            <span>Location</span>
          </div>
          <span
            className="font-semibold text-gray-900"
            aria-label={`Location: ${city}, ${state}`}
          >
            {city}, {state}
          </span>
        </li>

        {/* Trust Score Row */}
        <li
          className="flex items-center justify-between p-3 bg-white rounded-lg border"
          role="listitem"
        >
          <div className="flex items-center text-gray-700">
            <TrendingUp
              size={20}
              className="mr-3 text-blue-500"
              aria-hidden="true"
            />
            <span>Trust Score</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${pvsScore}%` }}
                aria-hidden="true"
              />
            </div>
            <span
              className="font-bold text-indigo-700"
              aria-label={`Trust score: ${pvsScore} out of 100`}
            >
              {pvsScore}/100
            </span>
          </div>
        </li>

        {/* Reviews Row */}
        <li
          className="flex items-center justify-between p-3 bg-white rounded-lg border"
          role="listitem"
        >
          <div className="flex items-center text-gray-700">
            <Star
              size={20}
              className="mr-3 text-amber-500"
              aria-hidden="true"
            />
            <span>Reviews</span>
          </div>
          <span
            className="font-semibold text-amber-700"
            aria-label={`${reviewCount} reviews`}
          >
            {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
          </span>
        </li>

        {/* Starting Price Row */}
        <li
          className="flex items-center justify-between p-3 bg-white rounded-lg border"
          role="listitem"
        >
          <div className="flex items-center text-gray-700">
            <Wallet
              size={20}
              className="mr-3 text-green-500"
              aria-hidden="true"
            />
            <span>Starting Price</span>
          </div>
          <span
            className="font-bold text-green-700 text-xl"
            aria-label={`Starting price: ₦${rawMinPrice / 100}`}
          >
            {formatPrice(rawMinPrice)}
          </span>
        </li>

        {/* Member Since Row */}
        <li
          className="flex items-center justify-between p-3 bg-white rounded-lg border"
          role="listitem"
        >
          <div className="flex items-center text-gray-700">
            <Calendar
              size={20}
              className="mr-3 text-purple-500"
              aria-hidden="true"
            />
            <span>Member Since</span>
          </div>
          <span
            className="font-semibold text-gray-900"
            aria-label={`Member since ${formatMemberSince(createdAt)}`}
          >
            {formatMemberSince(createdAt)}
          </span>
        </li>
      </ul>
    </div>
  );
};

export default KeyMetricsSection;
