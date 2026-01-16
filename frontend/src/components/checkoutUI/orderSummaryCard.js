// frontend/src/components/checkoutUI/orderSummaryCard.js
"use client";

import { memo, useState } from "react";
import {
  CheckCircle,
  ShoppingBag,
  Receipt,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { koboToNaira } from "@/utils/currency";

// Memoized order summary component for optimal performance
const OrderSummaryCard = memo(
  ({
    customerInfo,
    itemCount,
    orderBreakdown,
    items,
  }) => {
    const [showFeeBreakdown, setShowFeeBreakdown] = useState(false);

    // Format currency helper
    const formatCurrency = (amount) => {
      return `₦${amount.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    };

    // Calculate item total
    const getItemTotal = (item) => {
      const priceInNaira = koboToNaira(item.price);
      return priceInNaira * item.quantity;
    };

    // Determine if we should show VAT separately
    const hasVAT = orderBreakdown.vat > 0;
    const hasMixedTiers = orderBreakdown.hasMixedTiers;

    return (
      <div className="bg-gradient-to-br from-gray-50 to-white p-4 sm:p-6 rounded-xl shadow-xl border border-gray-200 lg:sticky lg:top-24">
        {/* Header */}
        <div className="flex items-center mb-4 md:mb-6 pb-3 border-b border-gray-200">
          <Receipt
            className="mr-2 text-blue-600"
            size={22}
            aria-hidden="true"
          />
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">
            Order Summary
          </h2>
        </div>

        {/* Customer Info Preview */}
        {customerInfo.firstName && (
          <div className="mb-4 p-3 sm:p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 animate-fadeIn">
            <div className="flex items-start">
              <CheckCircle
                className="mr-2 text-green-600 flex-shrink-0 mt-0.5"
                size={18}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800 truncate">
                  {customerInfo.firstName} {customerInfo.lastName}
                </p>
                <p className="text-xs text-green-700 truncate">
                  {customerInfo.email}
                </p>
                {customerInfo.phone && (
                  <p className="text-xs text-green-700">{customerInfo.phone}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Price Breakdown */}
        <div className="space-y-3 text-gray-700 mb-4 md:mb-6">
          {/* Subtotal */}
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center">
              <ShoppingBag
                size={16}
                className="mr-1.5 text-gray-500"
                aria-hidden="true"
              />
              Tickets Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"}
              )
            </span>
            <span className="font-semibold">
              {formatCurrency(orderBreakdown.subtotal)}
            </span>
          </div>

          {/* Service Fee with Info */}
          <div className="flex justify-between items-start text-sm">
            <div className="flex items-start flex-1">
              <span>Service Fee</span>
              {hasMixedTiers && (
                <button
                  onClick={() => setShowFeeBreakdown(!showFeeBreakdown)}
                  className="ml-1 text-blue-600 hover:text-blue-700 focus:outline-none"
                  aria-label="Toggle fee breakdown"
                >
                  <Info size={14} />
                </button>
              )}
            </div>
            <span className="font-semibold">
              {formatCurrency(orderBreakdown.serviceFee)}
            </span>
          </div>

          {/* Expandable Fee Breakdown for Mixed Tiers */}
          {hasMixedTiers && showFeeBreakdown && (
            <div className="ml-4 p-3 bg-blue-50 rounded-lg text-xs space-y-1.5 animate-slideDown">
              <p className="font-medium text-blue-900 mb-2">Fee Breakdown:</p>
              {orderBreakdown.itemsBreakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between text-blue-800">
                  <span className="truncate max-w-[60%]">
                    {item.eventTitle} (
                    {item.tier === "small" ? "10%" : "7% + ₦50"})
                  </span>
                  <span>{formatCurrency(item.serviceFee)}</span>
                </div>
              ))}
            </div>
          )}

          {/* VAT - Only show if amount > 0 */}
          {hasVAT && (
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center">
                <span>Value Added Tax (VAT)</span>
                <div className="group relative ml-1">
                  <Info size={14} className="text-gray-400 cursor-help" />
                  <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                    VAT (7.5%) applies only to service fees on tickets over
                    ₦5,000
                  </div>
                </div>
              </div>
              <span className="font-semibold">
                {formatCurrency(orderBreakdown.vat)}
              </span>
            </div>
          )}

          {/* Show info if NO VAT (all tickets ≤₦5k) */}
          {!hasVAT && itemCount > 0 && (
            <div className="flex items-start gap-2 p-2 bg-green-50 rounded text-xs text-green-800">
              <Info size={14} className="flex-shrink-0 mt-0.5 text-green-600" />
              <p>
                <span className="font-medium">10% flat fee</span> - VAT included
                for tickets ≤₦5,000
              </p>
            </div>
          )}

          {/* Total */}
          <div className="border-t-2 border-gray-300 pt-3 flex justify-between items-center">
            <span className="text-base sm:text-lg font-bold text-gray-900">
              Total Due
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-red-600">
              {formatCurrency(orderBreakdown.finalTotal)}
            </span>
          </div>
        </div>

        {/* Order Items List */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowFeeBreakdown(!showFeeBreakdown)}
            className="w-full flex items-center justify-between font-semibold text-gray-800 mb-3 text-sm sm:text-base hover:text-blue-600 transition-colors"
          >
            <span className="flex items-center">
              <CheckCircle
                size={16}
                className="mr-1.5 text-blue-600"
                aria-hidden="true"
              />
              Your Tickets
            </span>
            {showFeeBreakdown ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>

          <div
            className={`space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar transition-all ${
              showFeeBreakdown ? "opacity-100" : "opacity-0 max-h-0"
            }`}
          >
            {items.map((item, idx) => {
              const itemBreakdown = orderBreakdown.itemsBreakdown?.[idx];
              return (
                <div
                  key={item.cartId}
                  className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm line-clamp-1 mb-1">
                        {item.eventTitle}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {item.tierName} × {item.quantity}
                      </p>
                    </div>
                    <span className="font-semibold text-gray-800 text-sm whitespace-nowrap">
                      {formatCurrency(getItemTotal(item))}
                    </span>
                  </div>

                  {/* Show fee tier for this item */}
                  {itemBreakdown && (
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          itemBreakdown.tier === "small"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {itemBreakdown.tier === "small"
                          ? "10% fee"
                          : "7% + ₦50 + VAT"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center text-xs text-gray-600">
            <CheckCircle
              size={14}
              className="mr-1.5 text-green-600"
              aria-hidden="true"
            />
            <span>Secure checkout powered by Paystack</span>
          </div>
        </div>

        {/* Styles */}
        <style jsx>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e0;
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #a0aec0;
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes slideDown {
            from {
              opacity: 0;
              max-height: 0;
            }
            to {
              opacity: 1;
              max-height: 200px;
            }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
          .animate-slideDown {
            animation: slideDown 0.3s ease-out;
          }
        `}</style>
      </div>
    );
  }
);

OrderSummaryCard.displayName = "OrderSummaryCard";

export default OrderSummaryCard;
