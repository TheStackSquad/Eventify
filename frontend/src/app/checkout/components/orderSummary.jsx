"use client";

import { memo, useMemo } from "react";
import { CheckCircle } from "lucide-react";

/**
 * Standard Price Formatter for Naira
 * Assumes input is already in Naira.
 */
const formatPrice = (price) => {
  if (price === 0) return "FREE";
  if (!price || price < 0) return "Price TBD";

  // Ensure we are working with a clean number (handles strings with commas/symbols)
  const cleanPrice =
    typeof price === "string"
      ? parseFloat(price.replace(/[^0-9.]/g, ""))
      : price;

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cleanPrice);
};

const OrderSummary = memo(
  ({ customerInfo, itemCount, orderBreakdown, items }) => {
    const itemsWithTotals = useMemo(() => {
      // 'items' here should be the 'itemsBreakdown' array from your JSON
      const processed = items.map((item) => {
        /**
         * FIX: Your JSON uses 'pricePerTicket' and 'subtotal'.
         * We prioritize the subtotal calculated by the backend.
         */
        const unitPrice = parseFloat(item.pricePerTicket) || 0;
        const lineSubtotal =
          parseFloat(item.subtotal) || unitPrice * item.quantity;

        return {
          ...item,
          itemSubtotal: lineSubtotal,
          formattedPrice: formatPrice(unitPrice),
          formattedSubtotal: formatPrice(lineSubtotal),
        };
      });

      console.group("🛒 Order Summary Processing");
      console.table(processed, [
        "eventTitle",
        "quantity",
        "pricePerTicket",
        "itemSubtotal",
        "formattedSubtotal",
      ]);
      console.groupEnd();

      return processed;
    }, [items]);

    // Memoize formatted totals from the orderBreakdown object
    const formattedSubtotal = useMemo(
      () => formatPrice(orderBreakdown.subtotal),
      [orderBreakdown.subtotal],
    );
    const formattedServiceFee = useMemo(
      () => formatPrice(orderBreakdown.serviceFee),
      [orderBreakdown.serviceFee],
    );
    const formattedVAT = useMemo(
      () => formatPrice(orderBreakdown.vat),
      [orderBreakdown.vat],
    );
    const formattedFinalTotal = useMemo(
      () => formatPrice(orderBreakdown.finalTotal),
      [orderBreakdown.finalTotal],
    );

    return (
      <aside
        className="sticky top-24 bg-gray-50 p-6 rounded-xl shadow-sm border border-gray-200"
        role="complementary"
        aria-label="Order summary"
      >
        <header className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <CheckCircle className="mr-2" size={20} aria-hidden="true" />
            Order Summary
          </h2>
        </header>

        {/* Customer Info Preview */}
        {customerInfo?.firstName && (
          <section
            className="mb-6 p-3 bg-white rounded-lg border border-green-200"
            aria-label="Customer information"
          >
            <p className="text-sm font-medium text-green-800 mb-1">
              {customerInfo.firstName} {customerInfo.lastName}
            </p>
            <p className="text-xs text-green-600">{customerInfo.email}</p>
            {customerInfo.phone && (
              <p className="text-xs text-green-600">{customerInfo.phone}</p>
            )}
          </section>
        )}

        {/* Order Items List */}
        <section
          className="mb-6 pb-6 border-b border-gray-300"
          aria-label="Order items"
        >
          <h3 className="font-medium text-gray-800 mb-3 text-lg">
            Your Tickets
          </h3>
          <div className="space-y-4 max-h-60 overflow-y-auto" role="list">
            {itemsWithTotals.map((item) => (
              <div
                key={item.cartId || item.id}
                className="flex justify-between items-start text-sm"
                role="listitem"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 line-clamp-1">
                    {item.eventTitle}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {item.tierName} × {item.quantity}
                  </p>
                  <p className="text-gray-400 text-xs italic">
                    {item.formattedPrice} each
                  </p>
                </div>
                <span className="font-bold text-gray-700 ml-2 whitespace-nowrap">
                  {item.formattedSubtotal}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Price Breakdown */}
        <section
          className="space-y-3 text-gray-700 text-sm"
          aria-label="Price breakdown"
        >
          <div className="flex justify-between">
            <span>
              Tickets Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"}
              )
            </span>
            <span className="font-medium">{formattedSubtotal}</span>
          </div>

          <div className="flex justify-between">
            <span>Service Fee</span>
            <span className="font-medium">{formattedServiceFee}</span>
          </div>

          {orderBreakdown.vat > 0 && (
            <div className="flex justify-between">
              <span>VAT (7.5%)</span>
              <span className="font-medium">{formattedVAT}</span>
            </div>
          )}

          <div className="border-t border-gray-300 pt-4 mt-3">
            <div className="flex justify-between text-lg font-extrabold text-red-600">
              <span>Total Due</span>
              <span>{formattedFinalTotal}</span>
            </div>
          </div>
        </section>

        <footer className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            All fees and VAT are calculated above. You will confirm payment
            details on the next page.
          </p>
        </footer>
      </aside>
    );
  },
);

OrderSummary.displayName = "OrderSummary";

export default OrderSummary;
