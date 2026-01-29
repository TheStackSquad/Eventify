// frontend/src/components/create-events/components/ticketTier.js

import { createInputField } from "@/components/common/createInputFields";

export default function TicketTier({
  index,
  ticket,
  errors,
  onChange,
  onRemove,
  showRemove,
  isLocked = false, // Add lock status
}) {
  if (!ticket) return null;

  // Format price for display (with proper comma separation)
  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price || 0);
  };

  // Check if this specific ticket is locked
  const ticketLocked = isLocked && (ticket.soldCount || 0) > 0;

  return (
    <div className="p-6 bg-gray-800 rounded-lg border border-gray-700 relative">
      {/* Remove Button */}
      {showRemove && !ticketLocked && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-4 right-4 text-red-400 hover:text-red-300 transition-colors"
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

      {/* Tier Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-white">Tier {index + 1}</h4>
        {ticketLocked && (
          <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full">
            <svg
              className="w-3.5 h-3.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            {ticket.soldCount} sold
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Tier Name */}
        {createInputField({
          label: "Tier Name",
          type: "text",
          name: `tierName_${index}`,
          value: ticket.tierName || "",
          onChange: (e) => onChange(index, "tierName", e.target.value),
          placeholder: "e.g., VIP, Early Bird, General Admission",
          error: errors[`ticket_${index}_tierName`],
          required: true,
          disabled: ticketLocked,
        })}

        {/* Price and Quantity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Price Field with ₦ Symbol */}
          <div>
            {createInputField({
              label: "Price",
              type: "number",
              name: `price_${index}`,
              value: ticket.price || "", // Should be 5000 (naira)
              onChange: (e) => {
                const value = e.target.value;
                // Allow empty string for clearing, otherwise parse as float
                onChange(
                  index,
                  "price",
                  value === "" ? "" : parseFloat(value) || 0,
                );
              },
              placeholder: "5000",
              prefix: "₦", // Naira symbol
              description: `${formatPrice(ticket.price)}`,
              error: errors[`ticket_${index}_price`],
              required: true,
              min: "0",
              step: "0.01",
              disabled: ticketLocked,
            })}
          </div>

          {/* Quantity Field */}
          <div>
            {createInputField({
              label: "Quantity",
              type: "number",
              name: `quantity_${index}`,
              value: ticket.quantity || "",
              onChange: (e) => {
                const value = e.target.value;
                onChange(
                  index,
                  "quantity",
                  value === "" ? "" : parseInt(value, 10) || 0,
                );
              },
              placeholder: "100",
              description: ticketLocked
                ? `${ticket.quantity - (ticket.soldCount || 0)} remaining`
                : "Total tickets available",
              error: errors[`ticket_${index}_quantity`],
              required: true,
              min: ticketLocked ? ticket.soldCount : "1",
              disabled: ticketLocked,
            })}
          </div>
        </div>

        {/* Tier Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tier Description
          </label>
          <textarea
            value={ticket.description || ""}
            onChange={(e) => onChange(index, "description", e.target.value)}
            rows={3}
            placeholder="What's included in this tier? (e.g., 'Includes early access, backstage pass, and VIP lounge')"
            disabled={ticketLocked}
            className={`w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 resize-none transition-colors ${
              ticketLocked ? "opacity-60 cursor-not-allowed" : ""
            }`}
          />
          {errors[`ticket_${index}_description`] && (
            <p className="text-red-400 text-sm mt-1">
              {errors[`ticket_${index}_description`]}
            </p>
          )}
        </div>

        {/* Lock Warning */}
        {ticketLocked && (
          <div className="flex items-start gap-2 p-3 bg-amber-400/5 border border-amber-400/20 rounded-lg">
            <svg
              className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs text-amber-400">
              This tier cannot be modified because {ticket.soldCount}{" "}
              {ticket.soldCount === 1 ? "ticket has" : "tickets have"} already
              been sold.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
