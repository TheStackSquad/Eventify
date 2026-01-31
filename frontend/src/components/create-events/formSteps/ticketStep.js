// frontend/src/components/create-events/formSteps/ticketStep.js

import { createInputField } from "@/components/common/createInputFields";
import { Lock, AlertCircle, TrendingUp } from "lucide-react";
import {
  isTicketLocked,
  getMinCapacity,
} from "@/app/events/create-events/hooks/useLockFields";

/**
 * Format Naira currency with proper locale formatting
 */
const formatNaira = (amount) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

/**
 * Individual Ticket Tier Component
 * ✅ Enhanced with better price handling and display
 */
export default function TicketTier({
  index,
  ticket,
  errors = {},
  onChange,
  onRemove,
  showRemove,
}) {
  if (!ticket) return null;

  // 🔒 Determine lock status using centralized logic
  const isLocked = isTicketLocked(ticket);
  const minCapacity = getMinCapacity(ticket);
  const soldCount = ticket.soldCount || 0;

  // 🛡️ SAFETY: Ensure price is always a valid number
  const safePrice = (() => {
    const raw = ticket.price;

    // If it's already a valid number, use it
    if (typeof raw === "number" && !isNaN(raw) && isFinite(raw)) {
      return raw;
    }

    // If it's a string, try to parse it
    if (typeof raw === "string") {
      const cleaned = raw.replace(/[^0-9.]/g, "");
      const parsed = parseFloat(cleaned) || 0;

      if (process.env.NODE_ENV === "development") {
        console.warn(
          `⚠️ [TicketTier ${index}] Price was a string: "${raw}" → ${parsed} NGN`,
        );
      }

      return parsed;
    }

    // Fallback to 0
    if (
      process.env.NODE_ENV === "development" &&
      raw !== 0 &&
      raw !== undefined
    ) {
      console.error(`❌ [TicketTier ${index}] Invalid price:`, {
        type: typeof raw,
        value: raw,
      });
    }

    return 0;
  })();

  // Calculate revenue potential
  const potentialRevenue = safePrice * (ticket.quantity || 0);

  return (
    <div
      className={`p-6 bg-gray-800 rounded-lg border relative transition-all duration-300 ${
        isLocked
          ? "border-red-900/40 bg-gray-900/40 shadow-[inset_0_0_20px_rgba(153,27,27,0.1)]"
          : "border-gray-700 hover:border-gray-600"
      }`}
    >
      {/* Remove Button */}
      {showRemove && !isLocked && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-4 right-4 text-red-400 hover:text-red-300 transition-colors p-2 rounded-lg hover:bg-red-900/20"
          aria-label="Remove ticket tier"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* Header with Lock Badge */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <h4 className="text-lg font-semibold text-white">Tier {index + 1}</h4>
          {isLocked && (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-red-950/40 text-red-400 px-2 py-0.5 rounded border border-red-800/30">
              <Lock className="w-3 h-3" />
              Locked: {soldCount} Sold
            </span>
          )}
        </div>

        {/* Price Badge */}
        {!ticket.isFree && safePrice > 0 && (
          <div className="text-right">
            <div className="text-sm font-medium text-green-400 bg-green-900/20 px-3 py-1 rounded-full inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {formatNaira(safePrice)}
            </div>
            {potentialRevenue > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Potential: {formatNaira(potentialRevenue)}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Tier Name */}
        {createInputField({
          label: "Tier Name",
          name: `tierName_${index}`,
          value: ticket.tierName || "",
          onChange: (e) => onChange(index, "tierName", e.target.value),
          placeholder: "e.g., VIP, General Admission",
          error: errors[`ticket_${index}_tierName`],
          required: true,
          disabled: isLocked,
          className: isLocked
            ? "opacity-60 cursor-not-allowed bg-gray-950/50"
            : "",
        })}

        {/* Price and Capacity Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* PRICE INPUT */}
          <div className="relative group">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Price (₦){" "}
              {!ticket.isFree && <span className="text-red-400">*</span>}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                ₦
              </span>
              <input
                type="number"
                name={`price_${index}`}
                value={safePrice}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  onChange(index, "price", value);
                }}
                placeholder="5000"
                disabled={isLocked || ticket.isFree}
                step="0.01"
                min="0"
                className={`w-full pl-8 pr-10 py-2.5 bg-gray-900 border rounded-lg text-white transition-all ${
                  isLocked || ticket.isFree
                    ? "border-gray-800 opacity-60 cursor-not-allowed"
                    : "border-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                } ${errors[`ticket_${index}_price`] ? "border-red-500" : ""}`}
              />

              {/* Lock Icon */}
              {isLocked && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500/50 group-hover:text-red-500 transition-colors">
                  <Lock size={16} strokeWidth={2.5} />
                </div>
              )}
            </div>

            {/* Helper Text */}
            {!isLocked && !ticket.isFree && (
              <p className="text-xs text-gray-500 mt-1">
                Amount in Naira (e.g., 5000 for ₦5,000)
              </p>
            )}
            {ticket.isFree && (
              <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <span>🎁</span> Free ticket
              </p>
            )}
            {errors[`ticket_${index}_price`] && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                {errors[`ticket_${index}_price`]}
              </p>
            )}
          </div>

          {/* CAPACITY INPUT */}
          <div>
            {createInputField({
              label: "Total Capacity",
              type: "number",
              name: `quantity_${index}`,
              value: ticket.quantity || 0,
              onChange: (e) =>
                onChange(index, "quantity", parseInt(e.target.value, 10) || 0),
              placeholder: "100",
              error: errors[`ticket_${index}_quantity`],
              required: true,
              min: minCapacity,
              className: isLocked ? "border-amber-900/30" : "",
            })}

            {soldCount > 0 && (
              <p className="text-xs text-amber-400/70 mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                Minimum: {minCapacity} (already sold)
              </p>
            )}
          </div>
        </div>

        {/* FREE TICKET CHECKBOX */}
        <div className="flex items-center gap-2 p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
          <input
            type="checkbox"
            id={`isFree_${index}`}
            checked={ticket.isFree || false}
            onChange={(e) => {
              onChange(index, "isFree", e.target.checked);
              if (e.target.checked) {
                onChange(index, "price", 0);
              }
            }}
            disabled={isLocked}
            className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-green-500 focus:ring-green-500 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label
            htmlFor={`isFree_${index}`}
            className={`text-sm ${isLocked ? "text-gray-500" : "text-gray-300"} select-none cursor-pointer`}
          >
            🎁 This is a free ticket (no charge)
          </label>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description (Optional)
          </label>
          <textarea
            value={ticket.description || ""}
            onChange={(e) => onChange(index, "description", e.target.value)}
            rows={2}
            className={`w-full px-4 py-2 bg-gray-900 border rounded-lg text-white resize-none transition-all ${
              isLocked
                ? "border-gray-800 opacity-60 cursor-not-allowed"
                : "border-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            }`}
            placeholder="What's included in this tier?"
            disabled={isLocked}
          />
        </div>

        {/* Lock Warning Banner */}
        {isLocked && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-red-900/10 border border-red-800/20">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-red-300/90 leading-relaxed">
              <strong>Price and name locked:</strong> {soldCount} ticket
              {soldCount === 1 ? "" : "s"} already sold. You can still increase
              capacity or update the description.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
