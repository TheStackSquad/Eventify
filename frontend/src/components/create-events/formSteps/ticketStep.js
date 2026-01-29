// frontend/src/components/create-events/formSteps/ticketStep.js

import { createInputField } from "@/components/common/createInputFields";
import { Lock, AlertCircle } from "lucide-react";
import {
  isTicketLocked,
  getMinCapacity,
} from "@/app/events/create-events/hooks/useLockFields";

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

  // 🛡️ SAFETY: Ensure price is always a number (not string)
  const safePrice = (() => {
    const raw = ticket.price;

    // If it's already a valid number, use it
    if (typeof raw === "number" && !isNaN(raw)) {
      return raw;
    }

    // If it's a string, try to parse it (removing any non-numeric chars)
    if (typeof raw === "string") {
      const cleaned = raw.replace(/[^0-9.]/g, "");
      const parsed = parseFloat(cleaned) || 0;

      // 🚨 Development warning
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `⚠️ [TicketTier] Price was a string: "${raw}" → converted to ${parsed}`,
        );
      }

      return parsed;
    }

    // Fallback to 0
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `⚠️ [TicketTier] Invalid price type: ${typeof raw}, defaulting to 0`,
      );
    }
    return 0;
  })();

  return (
    <div
      className={`p-6 bg-gray-800 rounded-lg border relative transition-all duration-300 ${
        isLocked
          ? "border-red-900/40 bg-gray-900/40 shadow-[inset_0_0_20px_rgba(153,27,27,0.1)]"
          : "border-gray-700 hover:border-gray-600"
      }`}
    >
      {/* Remove Button - Only show if not locked and removal is allowed */}
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
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h4 className="text-lg font-semibold text-white">Tier {index + 1}</h4>
          {isLocked && (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-red-950/40 text-red-400 px-2 py-0.5 rounded border border-red-800/30 animate-in fade-in zoom-in duration-300">
              <Lock className="w-3 h-3" />
              Locked: {soldCount} Sold
            </span>
          )}
        </div>
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
          {/* PRICE INPUT WITH ENHANCED LOCK UI */}
          <div className="relative group">
            {createInputField({
              label: "Price (₦)",
              type: "number",
              name: `price_${index}`,
              value: safePrice, // ✅ Using sanitized price
              onChange: (e) => {
                const value = parseFloat(e.target.value) || 0;
                onChange(index, "price", value);
              },
              placeholder: "5000",
              error: errors[`ticket_${index}_price`],
              required: true,
              disabled: isLocked,
              step: "0.01",
              min: "0",
              className: isLocked
                ? "border-red-500/30 bg-gray-950/50 text-gray-400 cursor-not-allowed pr-10"
                : "pr-4",
            })}

            {/* Floating Lock Icon */}
            {isLocked && (
              <div className="absolute bottom-[10px] right-3 text-red-500/50 group-hover:text-red-500 transition-colors pointer-events-none">
                <Lock size={16} strokeWidth={2.5} />
              </div>
            )}

            {/* Helper Text */}
            {!isLocked && (
              <p className="text-xs text-gray-500 mt-1">
                Enter amount in Naira
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
              min: minCapacity, // ✅ Can't go below sold count
              className: isLocked ? "border-amber-900/30" : "",
            })}

            {/* Show minimum capacity hint if tickets are sold */}
            {soldCount > 0 && (
              <p className="text-xs text-amber-400/70 mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                Minimum: {minCapacity} (already sold)
              </p>
            )}
          </div>
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
          <div className="flex items-start gap-2 p-3 rounded-md bg-red-900/10 border border-red-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
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
