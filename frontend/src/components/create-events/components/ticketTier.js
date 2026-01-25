//frontend/src/components/create-events/components/ticketTier.js

import { createInputField } from "@/components/common/createInputFields";

export default function TicketTier({
  
  index,
  ticket,
  errors,
  onChange,
  onRemove,
  showRemove,
}) {
  if (!ticket) return null;
  return (
    <div className="p-6 bg-gray-800 rounded-lg border border-gray-700 relative">
      {showRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-4 right-4 text-red-400 hover:text-red-300"
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

      <h4 className="text-lg font-semibold text-white mb-4">
        Tier {index + 1}
      </h4>

      <div className="space-y-4">
        {createInputField({
          label: "Tier Name",
          type: "text",
          name: `tierName_${index}`,
          value: ticket.tierName,
          onChange: (e) => onChange(index, "tierName", e.target.value),
          placeholder: "e.g., VIP, Early Bird, General",
          error: errors[`ticket_${index}_tierName`],
          required: true,
        })}
        <div className="grid grid-cols-2 gap-4">
          {createInputField({
            label: "Price (₦)",
            type: "number",
            name: `price_${index}`,
            value: ticket.price,
            onChange: (e) =>
              onChange(index, "price", parseFloat(e.target.value) || 0),
            placeholder: "5000",
            error: errors[`ticket_${index}_price`],
            required: true,
          })}

          {createInputField({
            label: "Quantity",
            type: "number",
            name: `quantity_${index}`,
            value: ticket.quantity,
            onChange: (e) =>
              onChange(index, "quantity", parseInt(e.target.value, 10) || 0),
            placeholder: "100",
            error: errors[`ticket_${index}_quantity`],
            required: true,
          })}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tier Description
          </label>
          <textarea
            value={ticket.description}
            onChange={(e) => onChange(index, "description", e.target.value)}
            rows={2}
            placeholder="What's included in this tier?"
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>
      </div>
    </div>
  );
}
