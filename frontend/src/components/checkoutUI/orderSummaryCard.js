//frontend/src/component/checkoutUI/orderSummaryCard.js

"use client";

import { memo } from "react";
import { CheckCircle, ShoppingBag, Receipt } from "lucide-react";
import { formatCurrency, normalizePrice } from "@/utils/currency";

// Memoized order summary component for optimal performance
const OrderSummaryCard = memo(
  ({
    customerInfo,
    itemCount,
    subtotal,
    serviceFee,
    vatAmount,
    finalTotal,
    items,
  }) => {
    // Calculate item total with normalization
    const getItemTotal = (item) => {
      const normalizedPrice = normalizePrice(item.price);
      return normalizedPrice * item.quantity;
    };

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

        {/* Customer Info Preview - Shows when form is filled */}
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
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center">
              <ShoppingBag
                size={16}
                className="mr-1.5 text-gray-500"
                aria-hidden="true"
              />
              Subtotal ({itemCount} {itemCount === 1 ? "ticket" : "tickets"})
            </span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span>Service Fee</span>
            <span className="font-semibold">{formatCurrency(serviceFee)}</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span>VAT (7.5%)</span>
            <span className="font-semibold">{formatCurrency(vatAmount)}</span>
          </div>

          {/* Total */}
          <div className="border-t-2 border-gray-300 pt-3 flex justify-between items-center">
            <span className="text-base sm:text-lg font-bold text-gray-900">
              Total
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-red-600">
              {formatCurrency(finalTotal)}
            </span>
          </div>
        </div>

        {/* Order Items List */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base flex items-center">
            <CheckCircle
              size={16}
              className="mr-1.5 text-blue-600"
              aria-hidden="true"
            />
            Your Tickets
          </h3>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {items.map((item) => (
              <div
                key={item.cartId}
                className="flex justify-between items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
              >
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
            ))}
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

        {/* Add custom scrollbar styles */}
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
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
        `}</style>
      </div>
    );
  }
);

OrderSummaryCard.displayName = "OrderSummaryCard";

export default OrderSummaryCard;
