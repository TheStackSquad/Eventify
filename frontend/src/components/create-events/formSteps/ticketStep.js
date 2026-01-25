import { createInputField } from "@/components/common/createInputFields";

export default function TicketTier({
  index,
  ticket,
  errors = {},
  onChange,
  onRemove,
  showRemove,
}) {
  // 1. Safety Guard
  if (!ticket) return null;

  // 2. Integrity Logic:
  // Identify if this is a pre-existing ticket and if it has sales.
  // We use a prefix check for IDs to distinguish between DB UUIDs and temp frontend IDs.
  const isExistingTicket =
    ticket.id && !ticket.id.toString().startsWith("temp-");
  const soldCount = ticket.soldCount || 0;
  const isLocked = isExistingTicket && soldCount > 0;

  return (
    <div
      className={`p-6 bg-gray-800 rounded-lg border relative transition-all ${
        isLocked
          ? "border-amber-900/50 bg-gray-800/40 shadow-inner"
          : "border-gray-700 hover:border-gray-600"
      }`}
    >
      {/* Remove Button: Disabled if the tier has sales to protect historical data */}
      {showRemove && !isLocked && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-4 right-4 text-red-400 hover:text-red-300 transition-colors p-2"
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
        <div className="flex items-center gap-3">
          <h4 className="text-lg font-semibold text-white">Tier {index + 1}</h4>
          {isLocked && (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-amber-900/30 text-amber-500 px-2 py-0.5 rounded border border-amber-800/50">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              Locked: {soldCount} Sold
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Tier Name: Locked if sales exist */}
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
            ? "opacity-70 cursor-not-allowed grayscale-[0.5]"
            : "",
        })}

        <div className="grid grid-cols-2 gap-4">
          {/* Price: Locked if sales exist to prevent financial discrepancies */}
          {createInputField({
            label: `Price (₦)`,
            type: "number",
            name: `price_${index}`,
            value: ticket.price || 0,
            onChange: (e) =>
              onChange(index, "price", parseFloat(e.target.value) || 0),
            placeholder: "5000",
            error: errors[`ticket_${index}_price`],
            required: true,
            disabled: isLocked,
            className: isLocked
              ? "opacity-70 cursor-not-allowed grayscale-[0.5]"
              : "",
          })}

          {/* Capacity: Always editable, but min-bounded by sold tickets */}
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
            min: soldCount || 1,
          })}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={ticket.description || ""}
            onChange={(e) => onChange(index, "description", e.target.value)}
            rows={2}
            placeholder="What's included in this tier?"
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 resize-none transition-all placeholder:text-gray-600"
          />
        </div>
      </div>
    </div>
  );
}
