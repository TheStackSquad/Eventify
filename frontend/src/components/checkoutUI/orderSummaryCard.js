// frontend/src/components/checkoutUI/orderSummaryCard.js

"use client";

import { memo, useId, useState } from "react";
import { Receipt, ChevronDown, Check } from "lucide-react";
import InfoTip from "@/components/checkoutUI/infoTip";

const naira = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

const OrderSummaryCard = memo(
  ({ customerInfo, itemCount, orderBreakdown, items }) => {
    const [ticketsOpen, setTicketsOpen] = useState(false);
    const panelId = useId();

    const { subtotal, serviceFee, vat, finalTotal } = orderBreakdown;
    const itemsBreakdown = orderBreakdown.itemsBreakdown || [];
    const hasSmall = itemsBreakdown.some((b) => b.tier === "small");
    const hasPremium = itemsBreakdown.some((b) => b.tier !== "small");

    // Summary line shown while the ticket list is collapsed
    const eventCount = new Set(items.map((i) => i.eventTitle)).size;
    const single = items.length === 1 ? items[0] : null;
    const summaryTitle = single
      ? single.eventTitle
      : `${eventCount} ${eventCount === 1 ? "event" : "events"}`;
    const summarySub = single
      ? `${single.tierName} × ${single.quantity}`
      : `${itemCount} ${itemCount === 1 ? "ticket" : "tickets"}`;

    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:sticky lg:top-24">
        <div className="mb-4 flex items-center gap-2">
          <Receipt size={20} className="text-gray-700" aria-hidden="true" />
          <h2 className="text-lg font-bold text-gray-900">Order summary</h2>
        </div>

        {customerInfo.firstName && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2">
            <Check
              size={14}
              className="mt-1 shrink-0 text-green-600"
              aria-hidden="true"
            />
            <div className="min-w-0 text-xs">
              <p className="truncate font-semibold text-green-900">
                {customerInfo.firstName} {customerInfo.lastName}
              </p>
              {customerInfo.email && (
                <p className="truncate text-green-800">{customerInfo.email}</p>
              )}
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {/* Tickets: always shows a summary line, even when closed */}
          <section className="pb-4">
            <button
              type="button"
              onClick={() => setTicketsOpen((o) => !o)}
              aria-expanded={ticketsOpen}
              aria-controls={panelId}
              className="flex w-full items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900">
                  {summaryTitle}
                </span>
                <span className="block truncate text-xs text-gray-500">
                  {summarySub}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-gray-900">
                {naira(subtotal)}
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-300 ${
                    ticketsOpen ? "rotate-180" : ""
                  }`}
                />
              </span>
            </button>

            <div
              id={panelId}
              aria-hidden={!ticketsOpen}
              className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                ticketsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <ul className="mt-3 max-h-56 space-y-3 overflow-y-auto border-t border-gray-100 pt-3">
                  {items.map((item) => (
                    <li
                      key={item.cartId}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {item.eventTitle}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.tierName} × {item.quantity} ·{" "}
                          {naira(item.price)} each
                        </p>
                      </div>
                      <span className="shrink-0 font-medium text-gray-700">
                        {naira(Number(item.price) * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Fees */}
          <section className="space-y-3 py-4 text-sm text-gray-700">
            <div className="relative flex items-center justify-between">
              <span className="flex items-center">Tickets subtotal</span>
              <span className="font-medium">{naira(subtotal)}</span>
            </div>

            <div className="relative flex items-center justify-between">
              <span className="flex items-center">
                Service fee
                <InfoTip label="What does the service fee cover?">
                  <p className="font-medium text-white">
                    What you’re paying for
                  </p>
                  <p className="mt-1">
                    Secure payment processing, instant ticket delivery and
                    customer support for your order.
                  </p>
                  {hasSmall && !hasPremium && (
                    <p className="mt-2">
                      A flat 10% of the ticket price, VAT included.
                    </p>
                  )}
                  {hasPremium && !hasSmall && (
                    <p className="mt-2">
                      7% of the ticket price + ₦50 per ticket. VAT is added
                      separately.
                    </p>
                  )}
                  {hasSmall && hasPremium && (
                    <ul className="mt-2 space-y-1">
                      {itemsBreakdown.map((b, i) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span className="truncate">
                            {b.eventTitle} (
                            {b.tier === "small" ? "10%" : "7% + ₦50"})
                          </span>
                          <span>{naira(b.serviceFee)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </InfoTip>
              </span>
              <span className="font-medium">{naira(serviceFee)}</span>
            </div>

            {vat > 0 && (
              <div className="relative flex items-center justify-between">
                <span className="flex items-center">
                  VAT
                  <InfoTip label="How is VAT calculated?">
                    <p className="font-medium text-white">
                      7.5% VAT on the service fee
                    </p>
                    <p className="mt-1">
                      VAT applies to our fee only, never to the ticket price.
                      It’s worked out per ticket and rounded, so the total can
                      differ by a few naira from 7.5% of the combined fee.
                    </p>
                    <p className="mt-2 text-gray-400">
                      Tickets up to ₦5,000 have VAT included in their 10% fee.
                    </p>
                  </InfoTip>
                </span>
                <span className="font-medium">{naira(vat)}</span>
              </div>
            )}
          </section>

          {/* Total */}
          <section className="flex items-baseline justify-between pt-4">
            <span className="text-base font-bold text-gray-900">Total due</span>
            <span className="text-xl font-extrabold text-red-600">
              {naira(finalTotal)}
            </span>
          </section>
        </div>
      </div>
    );
  },
);

OrderSummaryCard.displayName = "OrderSummaryCard";

export default OrderSummaryCard;