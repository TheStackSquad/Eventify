// frontend/src/components/create-events/components/ticketTier.js
import { createInputField } from "@/components/common/createInputFields";

export default function TicketTier({
  index,
  ticket,
  errors,
  onChange,
  onRemove,
  showRemove,
}) {
  // HARDENING LOGIC: A tier is locked if it has existing sales
  const isLocked = ticket.soldCount > 0;

  return (
    <div
      className={`p-6 bg-gray-800 rounded-lg border relative ${isLocked ? "border-amber-900/50" : "border-gray-700"}`}
    >
      {/* 1. Conditional Remove Button: Block removal if sales exist */}
      {showRemove && !isLocked && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-4 right-4 text-red-400 hover:text-red-300 transition-colors"
          title="Remove Tier"
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

      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-white">Tier {index + 1}</h4>
        {isLocked && (
          <span className="text-xs font-medium text-amber-500 bg-amber-950/30 px-2 py-1 rounded border border-amber-900/50">
            Locked: {ticket.soldCount} tickets sold
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* 2. Tier Name: Disabled if locked */}
        {createInputField({
          label: "Tier Name",
          type: "text",
          name: `tierName_${index}`,
          value: ticket.tierName,
          onChange: (e) => onChange(index, "tierName", e.target.value),
          placeholder: "e.g., VIP, Early Bird",
          error: errors[`ticket_${index}_tierName`],
          required: true,
          disabled: isLocked, // Gray out if sold > 0
          className: isLocked
            ? "opacity-60 cursor-not-allowed bg-gray-950"
            : "",
        })}

        <div className="grid grid-cols-2 gap-4">
          {/* 3. Price: Disabled if locked */}
          {createInputField({
            label: `Price (₦) ${isLocked ? "(Locked)" : ""}`,
            type: "number",
            name: `price_${index}`,
            value: ticket.price,
            onChange: (e) =>
              onChange(index, "price", parseFloat(e.target.value) || 0),
            placeholder: "5000",
            error: errors[`ticket_${index}_price`],
            required: true,
            disabled: isLocked,
            className: isLocked
              ? "opacity-60 cursor-not-allowed bg-gray-950"
              : "",
          })}

          {/* 4. Quantity: ALWAYS enabled, but min value restricted to soldCount */}
          {createInputField({
            label: "Total Capacity",
            type: "number",
            name: `quantity_${index}`,
            value: ticket.quantity,
            onChange: (e) =>
              onChange(index, "quantity", parseInt(e.target.value, 10) || 0),
            placeholder: "100",
            error: errors[`ticket_${index}_quantity`],
            required: true,
            min: ticket.soldCount || 1, // Logic: Cannot reduce capacity below what is already sold
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
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 resize-none transition-all"
          />
        </div>
      </div>
    </div>
  );
}
