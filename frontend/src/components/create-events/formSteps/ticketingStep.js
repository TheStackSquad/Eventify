// ============================================================
// 1. MISSING COMPONENT: TicketingStep
// frontend/src/components/create-events/formSteps/ticketingStep.js
// ============================================================

import TicketTier from "../components/ticketTier";

export default function TicketingStep({
  formData,
  errors,
  handleTicketChange,
  addTicketTier,
  removeTicketTier,
}) {
  const tickets = formData.tickets || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white">Ticket Tiers</h3>
        <button
          type="button"
          onClick={addTicketTier}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Tier
        </button>
      </div>

      <p className="text-gray-400 text-sm">
        Create different ticket types with varying prices and benefits. At least
        one tier is required.
      </p>

      {tickets.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
          <svg
            className="w-16 h-16 text-gray-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
            />
          </svg>
          <p className="text-gray-400 mb-4">No ticket tiers yet</p>
          <button
            type="button"
            onClick={addTicketTier}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Create Your First Tier
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket, index) => (
            <TicketTier
              key={ticket.id || index}
              index={index}
              ticket={ticket}
              errors={errors}
              onChange={handleTicketChange}
              onRemove={removeTicketTier}
              showRemove={tickets.length > 1}
            />
          ))}
        </div>
      )}

      {errors.tickets && (
        <p className="text-red-500 text-sm mt-2">{errors.tickets}</p>
      )}
    </div>
  );
}
