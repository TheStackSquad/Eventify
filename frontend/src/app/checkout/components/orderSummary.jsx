//frontend/src/app/checkout/components/orderSummary.js
"use client";

import { memo } from "react";
import { CheckCircle } from "lucide-react";

const OrderSummary = memo(
  ({ customerInfo, itemCount, orderBreakdown, items }) => {
    const formatPrice = (amount) => {
      return `₦${amount.toLocaleString("en-NG")}`;
    };

    return (
      <div className="sticky top-24 bg-gray-50 p-6 rounded-xl shadow-inner border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <CheckCircle className="mr-2" size={20} />
          Order Summary
        </h2>

        {customerInfo.firstName && (
          <div className="mb-4 p-3 bg-white rounded-lg border border-green-200">
            <p className="text-sm font-medium text-green-800 mb-1">
              {customerInfo.firstName} {customerInfo.lastName}
            </p>
            <p className="text-xs text-green-600">{customerInfo.email}</p>
            {customerInfo.phone && (
              <p className="text-xs text-green-600">{customerInfo.phone}</p>
            )}
          </div>
        )}

        <div className="mb-4 pb-4 border-b border-gray-300">
          <h4 className="font-medium text-gray-800 mb-3">Your Tickets</h4>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {items.map((item) => {
              const itemSubtotal = Number(item.price) * item.quantity;
              return (
                <div
                  key={item.cartId}
                  className="flex justify-between items-start text-sm"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 line-clamp-1">
                      {item.eventTitle}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {item.tierName} × {item.quantity}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {formatPrice(item.price)} each
                    </p>
                  </div>
                  <span className="font-medium text-gray-700 ml-2">
                    {formatPrice(itemSubtotal)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 text-gray-700 text-sm">
          <div className="flex justify-between">
            <span>
              Tickets Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"}
              )
            </span>
            <span className="font-medium">
              {formatPrice(orderBreakdown.subtotal)}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Service Fee</span>
            <span className="font-medium">
              {formatPrice(orderBreakdown.serviceFee)}
            </span>
          </div>

          {orderBreakdown.vat > 0 && (
            <div className="flex justify-between">
              <span>Value Added Tax (VAT)</span>
              <span className="font-medium">
                {formatPrice(orderBreakdown.vat)}
              </span>
            </div>
          )}

          <div className="border-t border-gray-300 pt-3 flex justify-between text-lg font-extrabold text-red-600">
            <span>Total Due</span>
            <span>{formatPrice(orderBreakdown.finalTotal)}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            All fees and VAT are calculated above. You will confirm payment
            details on the next page.
          </p>
        </div>
      </div>
    );
  },
);

OrderSummary.displayName = "OrderSummary";

export default OrderSummary;
